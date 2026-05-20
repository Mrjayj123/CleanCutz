import express from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } })

// Middleware
app.use(express.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})
app.use(express.static(path.join(__dirname, '../public')))

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Clean Cutz API Server',
    endpoints: {
      'GET /api/videos': 'Get list of all videos',
      'POST /api/upload': 'Upload a new video (send video file in body, filename in x-filename header)',
      'DELETE /api/videos/:filename': 'Delete a video'
    }
  })
})

// Serve videos from public/videos directory
app.get('/api/videos', (req, res) => {
  const videosDir = path.join(__dirname, '../public/videos')
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true })
  }
  
  fs.readdir(videosDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read videos directory' })
    }
    
    // Filter for video files
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
    const videos = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return videoExtensions.includes(ext)
      })
      .map(file => ({
        id: file,
        name: file,
        url: `/videos/${file}`,
        size: fs.statSync(path.join(videosDir, file)).size
      }))
    
    res.json(videos)
  })
})

// Upload video endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'Video file is required' })
    }

    const filename = path.basename(file.originalname)
    const videosDir = path.join(__dirname, '../public/videos')
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true })
    }

    const filepath = path.join(videosDir, filename)

    fs.writeFile(filepath, file.buffer, (err) => {
      if (err) {
        console.error('Write error:', err)
        return res.status(500).json({ error: 'Failed to save video: ' + err.message })
      }
      res.json({ 
        success: true, 
        filename: filename,
        url: `/videos/${filename}`
      })
    })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: 'Upload failed: ' + err.message })
  }
})


// Delete video endpoint
app.delete('/api/videos/:filename', (req, res) => {
  const filename = req.params.filename
  const videosDir = path.join(__dirname, '../public/videos')
  const filepath = path.join(videosDir, filename)
  
  // Prevent directory traversal attacks
  if (!filepath.startsWith(videosDir)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  
  fs.unlink(filepath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete video' })
    }
    res.json({ success: true })
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Videos directory: ${path.join(__dirname, '../public/videos')}`)
})
