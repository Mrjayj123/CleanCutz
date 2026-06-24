import React, { useEffect, useState, useRef } from 'react'
import { apiJson } from '../lib/api'

export default function VideoLibrary({ onSelectVideo, activeFilename }) {
  const [videos, setVideos] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadLibrary()
  }, [])

  const loadLibrary = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiJson('/api/videos')
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
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // apiJson doesn't support multipart bodies; use fetch but attach Authorization
      const token = sessionStorage.getItem('cleancutz_token') || ''

      const response = await fetch(`http://localhost:3001/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })


      const contentType = response.headers.get('content-type') || ''
      const responseText = await response.text()
      const data = contentType.includes('application/json')
        ? JSON.parse(responseText)
        : { error: responseText }

      if (!response.ok) throw new Error(data.error || 'Upload failed')


      // Select the newly uploaded video
      onSelectVideo(data.url, data.filename)
      await loadLibrary()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Upload Error:', err)
      setError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return

    setImporting(true)
    setError(null)

    try {
      const data = await apiJson('/api/import-url', {
        method: 'POST',
        body: { url: importUrl.trim() }
      })


      onSelectVideo(data.url, data.filename)
      await loadLibrary()
      setImportUrl('')
    } catch (err) {
      console.error('Import Error:', err)
      setError(`Import failed: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleImportKeyDown = (e) => {
    if (e.key === 'Enter') handleImportUrl()
  }

  const handleDeleteVideo = async (e, filename) => {
    e.stopPropagation()
    if (!confirm(`Delete "${filename}"?`)) return

    try {
      const token = sessionStorage.getItem('cleancutz_token') || ''

      const response = await fetch(`http://localhost:3001/api/videos/${filename}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!response.ok) throw new Error('Delete failed')

      await loadLibrary()
    } catch (err) {
      console.error('Delete Error:', err)
      setError('Failed to delete video')
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <aside className="sidebar glass">
      <div className="sidebar-header">
        <div className="sidebar-label">Library</div>
        <button className="btn-outline" onClick={loadLibrary} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <label className="upload-btn">
          {uploading ? (
            <><span className="spinner"></span> Uploading...</>
          ) : (
            <>📤 Upload Video</>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>

        <div className="divider">or paste a link</div>

        <div className="url-import">
          <input
            type="url"
            placeholder="https://example.com/video.mp4"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={handleImportKeyDown}
            disabled={importing}
          />
          <button
            className="url-import-btn"
            onClick={handleImportUrl}
            disabled={importing || !importUrl.trim()}
          >
            {importing ? '...' : '⬇'}
          </button>
        </div>
      </div>

      {/* Video List */}
      <div className="video-list">
        {loading && (
          <div className="loading">Loading assets...</div>
        )}

        {error && (
          <div className="status-msg error" style={{ margin: 0 }}>{error}</div>
        )}

        {!loading && videos.length === 0 && !error && (
          <div className="empty-state">
            No videos yet. Upload a file or paste a URL to get started!
          </div>
        )}

        {!loading && videos.map((video) => (
          <div
            key={video.id}
            className={`video-card${activeFilename === video.name ? ' active' : ''}`}
            onClick={() => onSelectVideo(video.url, video.name)}
          >
            <div className="video-card-name" title={video.name}>
              🎞️ {video.name}
            </div>
            <div className="video-card-meta">
              {formatSize(video.size)}
            </div>
            <div className="video-card-actions">
              <button
                className="btn-danger"
                onClick={(e) => handleDeleteVideo(e, video.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
