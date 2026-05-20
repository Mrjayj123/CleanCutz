import React, { useState, useRef } from 'react'

export default function VideoEditor({ videoSource, activeSource }) {
  const [startTime, setStartTime] = useState('0')
  const [endTime, setEndTime] = useState('10')
  const videoRef = useRef(null)

  const handleCut = () => {
    const start = parseFloat(startTime)
    const end = parseFloat(endTime)

    if (start >= end) {
      alert('End time must be greater than start time!')
      return
    }

    const clippedUrl = `${videoSource}#t=${start},${end}`
    
    alert(`Clip generated from ${start}s to ${end}s!`)
    console.log('Clipped URL for download:', clippedUrl)
    
    if (videoRef.current) {
      videoRef.current.src = clippedUrl
      videoRef.current.play()
    }
  }

  return (
    <section className="editor-main">
      <div className="video-preview glass">
        <video 
          ref={videoRef}
          id="main-video" 
          controls
          src={videoSource}
        >
        </video>
      </div>

      <div className="console glass">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Trimming Console</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Set points to clip and borrow footage.
        </p>

        <div className="input-grid">
          <div className="input-field">
            <label>START POINT (SEC)</label>
            <input 
              type="number" 
              id="start-time" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              min="0"
            />
          </div>
          <div className="input-field">
            <label>END POINT (SEC)</label>
            <input 
              type="number" 
              id="end-time" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              min="1"
            />
          </div>
        </div>

        <button className="btn-primary" onClick={handleCut}>
          Capture & Borrow Clip
        </button>
      </div>
    </section>
  )
}
