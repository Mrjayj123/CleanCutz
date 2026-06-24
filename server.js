import express from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'
import https from 'https'
import http from 'http'

import {
  createUser, getUserByEmail, getUserById, updateUserTheme, updateUserPassword,
  addVideoRecord, getVideosForUser, getVideoByFilename, deleteVideoRecord,
  createPasswordReset, getValidPasswordReset, markPasswordResetUsed
} from './db.js'
import {
  validateRegistration, validatePassword, hashPassword, verifyPassword,
  signToken, publicUser, requireAuth, generateResetToken, hashResetToken
} from './AuthContext.jsx'
import { sendPasswordResetEmail } from './email.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Used to build the reset-password link sent in emails. Set this to your real
// deployed frontend URL in production (e.g. https://cleancutz.app).
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// All video paths relative to project root (where server.js lives).
// Each user gets their own subfolder under VIDEOS_DIR, keyed by user id,
// so one user can never stumble onto (or guess) another user's files.
const VIDEOS_DIR = path.join(__dirname, 'public', 'videos')

// Optional: path to a cookies.txt file (exported from a logged-in YouTube session)
// used to get past YouTube's bot-detection wall. If the file doesn't exist, yt-dlp
// just runs without cookies. See comments near ytDlpDownload() for how to get one.
const YTDLP_COOKIES_FILE = path.join(__dirname, 'cookies.txt')

// Ensure base directory exists on startup (per-user subfolders are created on demand)
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true })

// Check ffmpeg availability on startup
let ffmpegAvailable = false
try {
  execSync('ffmpeg -version', { stdio: 'ignore' })
  ffmpegAvailable = true
  console.log('✅ ffmpeg is available')
} catch {
  console.warn('⚠️  ffmpeg is NOT installed. Trimming will not work.')
  console.warn('   Install with: sudo apt install ffmpeg')
}

// Check yt-dlp availability on startup
let ytDlpAvailable = false
try {
  execSync('yt-dlp --version', { stdio: 'ignore' })
  ytDlpAvailable = true
  console.log('✅ yt-dlp is available')
} catch {
  console.warn('⚠️  yt-dlp is NOT installed. YouTube/social imports will not work.')
  console.warn('   Install with: pip install -U yt-dlp --break-system-packages')
}

// Multer for file uploads (500MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
})

// Middleware
app.use(express.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// NOTE: video files now live under /videos/<userId>/... and /videos/<userId>/trimmed/...
// This static mount still works fine since it just serves whatever's on disk under public/.
app.use(express.static(path.join(__dirname, 'public')))

// ─── PER-USER PATH HELPERS ───────────────────────────────────
function userVideosDir(userId) {
  return path.join(VIDEOS_DIR, String(userId))
}

function userTrimmedDir(userId) {
  return path.join(userVideosDir(userId), 'trimmed')
}

function ensureUserDirs(userId) {
  const dir = userVideosDir(userId)
  const trimmedDir = userTrimmedDir(userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(trimmedDir)) fs.mkdirSync(trimmedDir, { recursive: true })
  return { dir, trimmedDir }
}

// ─── API INFO ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Clean Cutz API Server',
    ffmpeg: ffmpegAvailable,
    ytDlp: ytDlpAvailable,
    ytDlpCookies: fs.existsSync(YTDLP_COOKIES_FILE),
    endpoints: {
      'POST /api/auth/register': 'Create an account { name, email, password }',
      'POST /api/auth/login': 'Log in { email, password }',
      'POST /api/auth/forgot-password': 'Request a password reset email { email }',
      'POST /api/auth/reset-password': 'Set a new password using a reset token { token, newPassword }',
      'GET  /api/auth/me': 'Get the logged-in user (requires Authorization: Bearer <token>)',
      'PATCH /api/auth/theme': 'Update theme preference { theme: "light" | "dark" }',
      'GET  /api/videos': 'List the logged-in user\'s original videos',
      'GET  /api/videos/trimmed': 'List the logged-in user\'s trimmed videos',
      'POST /api/upload': 'Upload a video file (multipart/form-data, field: file)',
      'POST /api/import-url': 'Import video from a direct URL or YouTube/social link { url, filename? }',
      'POST /api/trim': 'Trim a video { filename, start, end }',
      'GET  /api/download/:filename': 'Download a video file',
      'GET  /api/download/:subdir/:filename': 'Download a video file from a subdirectory (e.g. trimmed)',
      'DELETE /api/videos/:filename': 'Delete a video'
    }
  })
})

// ─── AUTH: REGISTER ───────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {}

  const errors = validateRegistration({ name, email, password })
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('. ') })
  }

  const existing = getUserByEmail(email)
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' })
  }

  try {
    const user = createUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashPassword(password)
    })

    ensureUserDirs(user.id)

    const token = signToken(user)
    res.json({ success: true, token, user: publicUser(user) })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Failed to create account' })
  }
})

// ─── AUTH: LOGIN ──────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = getUserByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) {
    // Same error for "no such user" and "wrong password" -- don't leak which one it was
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  ensureUserDirs(user.id)

  const token = signToken(user)
  res.json({ success: true, token, user: publicUser(user) })
})

// ─── AUTH: FORGOT PASSWORD ─────────────────────────────────────
// Always responds the same way whether or not the email exists, so this
// endpoint can't be used to check which emails have accounts.
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {}

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' })
  }

  const genericResponse = {
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.'
  }

  const user = getUserByEmail(email)
  if (!user) {
    // Don't reveal whether the account exists
    return res.json(genericResponse)
  }

  try {
    const { rawToken, tokenHash, expiresAt } = generateResetToken()
    createPasswordReset({ userId: user.id, tokenHash, expiresAt })

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl })

    res.json(genericResponse)
  } catch (err) {
    console.error('Forgot-password error:', err)
    // Still return the generic response -- don't leak email-sending failures
    // to the client, and don't let this endpoint become an email-existence oracle.
    res.json(genericResponse)
  }
})

// ─── AUTH: RESET PASSWORD ──────────────────────────────────────
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {}

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Reset token is required' })
  }

  const passwordError = validatePassword(newPassword)
  if (passwordError) {
    return res.status(400).json({ error: passwordError })
  }

  const tokenHash = hashResetToken(token)
  const resetRecord = getValidPasswordReset(tokenHash)

  if (!resetRecord) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
  }

  updateUserPassword(resetRecord.user_id, hashPassword(newPassword))
  markPasswordResetUsed(resetRecord.id)

  res.json({ success: true, message: 'Password updated. You can now log in.' })
})

// ─── AUTH: CURRENT USER ───────────────────────────────────────
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: publicUser(user) })
})

// ─── AUTH: UPDATE THEME ───────────────────────────────────────
app.patch('/api/auth/theme', requireAuth, (req, res) => {
  const { theme } = req.body || {}
  if (theme !== 'light' && theme !== 'dark') {
    return res.status(400).json({ error: 'theme must be "light" or "dark"' })
  }

  const user = updateUserTheme(req.userId, theme)
  res.json({ success: true, user: publicUser(user) })
})

// ─── LIST VIDEOS (per-user) ───────────────────────────────────
app.get('/api/videos', requireAuth, (req, res) => {
  const records = getVideosForUser(req.userId, 'original')
  const { dir } = ensureUserDirs(req.userId)

  const videos = records
    .filter(r => fs.existsSync(path.join(dir, r.filename)))
    .map(r => ({
      id: r.filename,
      name: r.filename,
      url: `/videos/${req.userId}/${r.filename}`,
      size: fs.statSync(path.join(dir, r.filename)).size,
      origin: r.origin,
      createdAt: r.created_at
    }))

  res.json(videos)
})

// ─── LIST TRIMMED VIDEOS (per-user) ───────────────────────────
app.get('/api/videos/trimmed', requireAuth, (req, res) => {
  const records = getVideosForUser(req.userId, 'trimmed')
  const { trimmedDir } = ensureUserDirs(req.userId)

  const videos = records
    .filter(r => fs.existsSync(path.join(trimmedDir, r.filename)))
    .map(r => ({
      id: r.filename,
      name: r.filename,
      url: `/videos/${req.userId}/trimmed/${r.filename}`,
      size: fs.statSync(path.join(trimmedDir, r.filename)).size,
      sourceFilename: r.source_filename,
      createdAt: r.created_at
    }))

  res.json(videos)
})

// ─── UPLOAD VIDEO ────────────────────────────────────────────
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'Video file is required' })

    const { dir } = ensureUserDirs(req.userId)
    const filename = uniqueFilename(dir, sanitizeFilename(file.originalname))
    const filepath = path.join(dir, filename)

    fs.writeFile(filepath, file.buffer, (err) => {
      if (err) {
        console.error('Write error:', err)
        return res.status(500).json({ error: 'Failed to save video: ' + err.message })
      }

      addVideoRecord({ userId: req.userId, filename, kind: 'original', origin: 'upload' })
      res.json({ success: true, filename, url: `/videos/${req.userId}/${filename}` })
    })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: 'Upload failed: ' + err.message })
  }
})

// ─── IMPORT FROM URL ─────────────────────────────────────────
// Handles two cases:
//   1. yt-dlp-supported links (YouTube, etc.) -> shells out to yt-dlp
//   2. Direct file URLs (e.g. link ending in .mp4) -> streams the response to disk
app.post('/api/import-url', requireAuth, async (req, res) => {
  const { url, filename: customName } = req.body || {}

  if (!url) return res.status(400).json({ error: 'url is required' })

  try {
    new URL(url) // validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const { dir } = ensureUserDirs(req.userId)

  // Derive filename from URL or use custom name
  let filename = customName || path.basename(new URL(url).pathname) || 'imported_video.mp4'
  filename = sanitizeFilename(filename)

  // Ensure it has a video extension
  const ext = path.extname(filename).toLowerCase()
  if (!['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
    filename += '.mp4'
  }

  // Avoid clobbering an existing file with the same name
  filename = uniqueFilename(dir, filename)
  const filepath = path.join(dir, filename)

  // ── Branch 1: yt-dlp-supported site (YouTube, etc.) ──
  if (isYtDlpUrl(url)) {
    if (!ytDlpAvailable) {
      return res.status(500).json({
        error: 'yt-dlp is not installed on the server. Run: pip install -U yt-dlp --break-system-packages'
      })
    }

    try {
      await ytDlpDownload({ url, outputPath: filepath })

      if (!fs.existsSync(filepath)) {
        return res.status(500).json({ error: 'yt-dlp finished but no output file was produced' })
      }

      addVideoRecord({ userId: req.userId, filename, kind: 'original', origin: 'import-ytdlp' })
      return res.json({ success: true, filename, url: `/videos/${req.userId}/${filename}` })
    } catch (err) {
      console.error('yt-dlp error:', err)
      fs.unlink(filepath, () => {}) // clean up any partial file
      return res.status(500).json({ error: 'Video import failed: ' + err.message })
    }
  }

  // ── Branch 2: direct file URL ──
  const fileStream = fs.createWriteStream(filepath)
  const client = url.startsWith('https') ? https : http

  const finishImport = () => {
    addVideoRecord({ userId: req.userId, filename, kind: 'original', origin: 'import-url' })
    res.json({ success: true, filename, url: `/videos/${req.userId}/${filename}` })
  }

  client.get(url, (response) => {
    // Follow redirects
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      const redirectClient = response.headers.location.startsWith('https') ? https : http
      redirectClient.get(response.headers.location, (redirectResponse) => {
        redirectResponse.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          finishImport()
        })
      }).on('error', (err) => {
        fs.unlink(filepath, () => {})
        res.status(500).json({ error: 'Download failed: ' + err.message })
      })
      return
    }

    if (response.statusCode !== 200) {
      fs.unlink(filepath, () => {})
      return res.status(400).json({ error: `URL returned status ${response.statusCode}` })
    }

    response.pipe(fileStream)
    fileStream.on('finish', () => {
      fileStream.close()
      finishImport()
    })
  }).on('error', (err) => {
    fs.unlink(filepath, () => {})
    res.status(500).json({ error: 'Download failed: ' + err.message })
  })
})

// ─── DELETE VIDEO ────────────────────────────────────────────
app.delete('/api/videos/:filename', requireAuth, (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const { dir } = ensureUserDirs(req.userId)
  const filepath = path.join(dir, filename)

  if (!filepath.startsWith(dir)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  fs.unlink(filepath, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete video' })
    deleteVideoRecord(req.userId, filename)
    res.json({ success: true })
  })
})

// ─── DOWNLOAD VIDEO ─────────────────────────────────────────
app.get('/api/download/:subdir/:filename', requireAuth, (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const subdir = req.params.subdir === 'trimmed' ? 'trimmed' : ''
  const { dir, trimmedDir } = ensureUserDirs(req.userId)
  const baseDir = subdir ? trimmedDir : dir
  const filepath = path.join(baseDir, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.download(filepath, filename)
})

app.get('/api/download/:filename', requireAuth, (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const { dir } = ensureUserDirs(req.userId)
  const filepath = path.join(dir, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.download(filepath, filename)
})

// ─── TRIM VIDEO ──────────────────────────────────────────────
app.post('/api/trim', requireAuth, async (req, res) => {
  if (!ffmpegAvailable) {
    return res.status(500).json({ error: 'ffmpeg is not installed on the server. Run: sudo apt install ffmpeg' })
  }

  try {
    const { filename, start, end } = req.body || {}

    if (!filename) return res.status(400).json({ error: 'filename is required' })

    const inputFilename = sanitizeFilename(filename)
    const startNum = Number(start)
    const endNum = Number(end)

    if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
      return res.status(400).json({ error: 'start and end must be numbers' })
    }
    if (startNum < 0) return res.status(400).json({ error: 'start must be >= 0' })
    if (endNum <= startNum) return res.status(400).json({ error: 'end must be greater than start' })

    const { dir, trimmedDir } = ensureUserDirs(req.userId)
    const inputPath = path.join(dir, inputFilename)

    if (!inputPath.startsWith(dir)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input video not found' })
    }

    const ext = path.extname(inputFilename)
    const base = path.basename(inputFilename, ext)
    const safeStart = String(startNum).replace(/\./g, '-')
    const safeEnd = String(endNum).replace(/\./g, '-')
    const outputFilename = uniqueFilename(trimmedDir, `${base}_trim_${safeStart}-${safeEnd}.mp4`)
    const outputPath = path.join(trimmedDir, outputFilename)

    await ffmpegTrim({ inputPath, outputPath, start: startNum, end: endNum })

    addVideoRecord({
      userId: req.userId,
      filename: outputFilename,
      sourceFilename: inputFilename,
      kind: 'trimmed',
      origin: 'trim'
    })

    return res.json({
      success: true,
      filename: outputFilename,
      url: `/videos/${req.userId}/trimmed/${outputFilename}`
    })
  } catch (err) {
    console.error('Trim error:', err)
    const msg = err?.message || 'Trim failed'
    return res.status(500).json({ error: msg })
  }
})

// ─── HELPERS ─────────────────────────────────────────────────
function sanitizeFilename(name) {
  return path.basename(name)
}

// Appends "(1)", "(2)", etc. before the extension if the filename already exists,
// so imports/uploads never silently overwrite an existing file.
function uniqueFilename(dir, filename) {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = filename
  let counter = 1

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${counter})${ext}`
    counter += 1
  }

  return candidate
}

// Returns true if the URL points to a site yt-dlp knows how to handle
// (YouTube and friends). Add more hostnames here as needed.
function isYtDlpUrl(url) {
  const ytDlpHosts = [
    'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
    'music.youtube.com'
  ]
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ytDlpHosts.some(h => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

// Downloads a video via yt-dlp to an exact output path.
// Requires ffmpeg on the system for muxing separate video/audio streams.
//
// YouTube's bot-detection ("Sign in to confirm you're not a bot") is the most common
// failure here. The two best mitigations:
//   1. Cookies from a real logged-in YouTube session (most reliable). Export with a
//      browser extension like "Get cookies.txt LOCALLY" and place the file at
//      YTDLP_COOKIES_FILE (project root, cookies.txt). Used automatically if present.
//   2. Spoofing the Android client, which sometimes sidesteps the check entirely for
//      public videos. Applied automatically as a fallback if no cookies file exists.
// Also worth doing regardless: keep yt-dlp updated (`pip install -U yt-dlp --break-system-packages`),
// since YouTube and yt-dlp are in a constant back-and-forth and an outdated version is
// the single most common cause of this error.
function ytDlpDownload({ url, outputPath }) {
  return new Promise((resolve, reject) => {
    const hasCookies = fs.existsSync(YTDLP_COOKIES_FILE)

    const args = [
      url,
      '-f', 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-progress',
      '-o', outputPath
    ]

    if (hasCookies) {
      args.push('--cookies', YTDLP_COOKIES_FILE)
    } else {
      // No cookies available — try spoofing the Android client as a fallback.
      // Less reliable than cookies, but works for many public videos without
      // needing a logged-in session at all.
      args.push('--extractor-args', 'youtube:player_client=android')
    }

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`yt-dlp exited with code ${code}. ${stderr.trim()}`))
    })
  })
}

function ffmpegTrim({ inputPath, outputPath, start, end }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', String(start),
      '-to', String(end),
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath
    ]

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`ffmpeg exited with code ${code}. ${stderr}`))
    })
  })
}

// ─── START ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 Clean Cutz API running on http://localhost:${PORT}`)
  console.log(`📁 Videos directory: ${VIDEOS_DIR}\n`)
})