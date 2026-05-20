import React, { useEffect, useState } from 'react'

const API_URL = 'http://localhost:3001/api/videos'

export default function VideoLibrary({ onSelectVideo }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadLibrary()
  }, [])

  const loadLibrary = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error('Failed to load videos')
      
      const data = await response.json()
      setVideos(data)
    } catch (err) {
      console.error('API Error:', err)
      setError('Failed to load library. Make sure the server is running on port 3001.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      })

      const contentType = response.headers.get('content-type') || ''
      const responseText = await response.text()
      const data = contentType.includes('application/json') ? JSON.parse(responseText) : { error: responseText }

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      await loadLibrary()
      event.target.value = '' // Reset file input
    } catch (err) {
      console.error('Upload Error:', err)
      alert(`Failed to upload video: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteVideo = async (filename) => {
    if (!confirm(`Delete "${filename}"?`)) return

    try {
      const response = await fetch(`http://localhost:3001/api/videos/${filename}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Delete failed')
      
      await loadLibrary()
    } catch (err) {
      console.error('Delete Error:', err)
      alert('Failed to delete video')
    }
  }

  return (
    <aside className="sidebar glass">
      <div className="sidebar-label">LIBRARY</div>
      
      <label className="upload-btn">
        📤 Upload Video
        <input 
          type="file" 
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
      </label>

      <div id="video-list">
        {loading && <p style={{ padding: '20px', color: 'gray' }}>Loading Studio Assets...</p>}
        {uploading && <p style={{ padding: '20px', color: 'var(--accent-blue)' }}>Uploading...</p>}
        {error && <p style={{ color: '#ff4b4b', padding: '20px', fontSize: '0.8rem' }}>{error}</p>}
        {!loading && videos.length === 0 && !error && (
          <p style={{ padding: '20px', color: 'gray', fontSize: '0.8rem' }}>No videos yet. Upload one to get started!</p>
        )}
        {!loading && videos.length > 0 && (
          videos.map((video) => (
            <div 
              key={video.id}
              className="video-card"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div onClick={() => onSelectVideo(video.url)}>
                <strong>{video.name}</strong>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Size: {(video.size / 1024 / 1024).toFixed(2)}MB
                </div>
              </div>
              <button 
                onClick={() => handleDeleteVideo(video.id)}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  background: 'rgba(255, 75, 75, 0.2)',
                  border: '1px solid rgba(255, 75, 75, 0.5)',
                  color: '#ff4b4b',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
