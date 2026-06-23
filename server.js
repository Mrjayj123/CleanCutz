import express from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'
import https from 'https'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// All video paths relative to project root (where server.js lives)
const VIDEOS_DIR = path.join(__dirname, 'public', 'videos')
const TRIMMED_DIR = path.join(VIDEOS_DIR, 'trimmed')

// Ensure directories exist on startup
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true })
if (!fs.existsSync(TRIMMED_DIR)) fs.mkdirSync(TRIMMED_DIR, { recursive: true })

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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Serve static files from public/ (including videos)
app.use(express.static(path.join(__dirname, 'public')))

// ─── API INFO ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Clean Cutz API Server',
    ffmpeg: ffmpegAvailable,
    ytDlp: ytDlpAvailable,
    endpoints: {
      'GET  /api/videos': 'List all uploaded videos',
      'GET  /api/videos/trimmed': 'List all trimmed videos',
      'POST /api/upload': 'Upload a video file (multipart/form-data, field: file)',
      'POST /api/import-url': 'Import video from a direct URL or YouTube/social link { url, filename? }',
      'POST /api/trim': 'Trim a video { filename, start, end }',
      'GET  /api/download/:filename': 'Download a video file',
      'GET  /api/download/:subdir/:filename': 'Download a video file from a subdirectory (e.g. trimmed)',
      'DELETE /api/videos/:filename': 'Delete a video'
    }
  })
})

// ─── LIST VIDEOS ─────────────────────────────────────────────
app.get('/api/videos', (req, res) => {
  fs.readdir(VIDEOS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read videos directory' })

    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
    const videos = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return videoExtensions.includes(ext) && !fs.statSync(path.join(VIDEOS_DIR, file)).isDirectory()
      })
      .map(file => ({
        id: file,
        name: file,
        url: `/videos/${file}`,
        size: fs.statSync(path.join(VIDEOS_DIR, file)).size
      }))

    res.json(videos)
  })
})

// ─── LIST TRIMMED VIDEOS ────────────────────────────────────
app.get('/api/videos/trimmed', (req, res) => {
  fs.readdir(TRIMMED_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read trimmed directory' })

    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
    const videos = files
      .filter(file => videoExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => ({
        id: file,
        name: file,
        url: `/videos/trimmed/${file}`,
        size: fs.statSync(path.join(TRIMMED_DIR, file)).size
      }))

    res.json(videos)
  })
})

// ─── UPLOAD VIDEO ────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'Video file is required' })

    const filename = uniqueFilename(VIDEOS_DIR, sanitizeFilename(file.originalname))
    const filepath = path.join(VIDEOS_DIR, filename)

    fs.writeFile(filepath, file.buffer, (err) => {
      if (err) {
        console.error('Write error:', err)
        return res.status(500).json({ error: 'Failed to save video: ' + err.message })
      }
      res.json({ success: true, filename, url: `/videos/${filename}` })
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
app.post('/api/import-url', async (req, res) => {
  const { url, filename: customName } = req.body || {}

  if (!url) return res.status(400).json({ error: 'url is required' })

  try {
    new URL(url) // validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // Derive filename from URL or use custom name
  let filename = customName || path.basename(new URL(url).pathname) || 'imported_video.mp4'
  filename = sanitizeFilename(filename)

  // Ensure it has a video extension
  const ext = path.extname(filename).toLowerCase()
  if (!['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
    filename += '.mp4'
  }

  // Avoid clobbering an existing file with the same name
  filename = uniqueFilename(VIDEOS_DIR, filename)
  const filepath = path.join(VIDEOS_DIR, filename)

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

      return res.json({ success: true, filename, url: `/videos/${filename}` })
    } catch (err) {
      console.error('yt-dlp error:', err)
      fs.unlink(filepath, () => {}) // clean up any partial file
      return res.status(500).json({ error: 'Video import failed: ' + err.message })
    }
  }

  // ── Branch 2: direct file URL ──
  const fileStream = fs.createWriteStream(filepath)
  const client = url.startsWith('https') ? https : http

  client.get(url, (response) => {
    // Follow redirects
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      const redirectClient = response.headers.location.startsWith('https') ? https : http
      redirectClient.get(response.headers.location, (redirectResponse) => {
        redirectResponse.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          res.json({ success: true, filename, url: `/videos/${filename}` })
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
      res.json({ success: true, filename, url: `/videos/${filename}` })
    })
  }).on('error', (err) => {
    fs.unlink(filepath, () => {})
    res.status(500).json({ error: 'Download failed: ' + err.message })
  })
})

// ─── DELETE VIDEO ────────────────────────────────────────────
app.delete('/api/videos/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const filepath = path.join(VIDEOS_DIR, filename)

  if (!filepath.startsWith(VIDEOS_DIR)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  fs.unlink(filepath, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete video' })
    res.json({ success: true })
  })
})

// ─── DOWNLOAD VIDEO ─────────────────────────────────────────
app.get('/api/download/:subdir/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const subdir = req.params.subdir === 'trimmed' ? 'trimmed' : ''
  const dir = subdir ? TRIMMED_DIR : VIDEOS_DIR
  const filepath = path.join(dir, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.download(filepath, filename)
})

app.get('/api/download/:filename', (req, res) => {
  const filename = sanitizeFilename(req.params.filename)
  const filepath = path.join(VIDEOS_DIR, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.download(filepath, filename)
})

// ─── TRIM VIDEO ──────────────────────────────────────────────
app.post('/api/trim', async (req, res) => {
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

    const inputPath = path.join(VIDEOS_DIR, inputFilename)

    if (!inputPath.startsWith(VIDEOS_DIR)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input video not found' })
    }

    const ext = path.extname(inputFilename)
    const base = path.basename(inputFilename, ext)
    const safeStart = String(startNum).replace(/\./g, '-')
    const safeEnd = String(endNum).replace(/\./g, '-')
    const outputFilename = `${base}_trim_${safeStart}-${safeEnd}.mp4`
    const outputPath = path.join(TRIMMED_DIR, outputFilename)

    await ffmpegTrim({ inputPath, outputPath, start: startNum, end: endNum })

    return res.json({
      success: true,
      filename: outputFilename,
      url: `/videos/trimmed/${outputFilename}`
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
function ytDlpDownload({ url, outputPath }) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      '-f', 'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-progress',
      '-o', outputPath
    ]

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
  console.log(`📁 Videos directory: ${VIDEOS_DIR}`)
  console.log(`✂️  Trimmed directory: ${TRIMMED_DIR}\n`)
})