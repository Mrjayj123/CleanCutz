import React, { useState, useRef, useEffect, useCallback } from 'react'

const SERVER = 'http://localhost:3001'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoEditor({ videoSource, activeFilename, onTrimmed, onLibraryRefresh }) {
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const animFrameRef = useRef(null)

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [trimResult, setTrimResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(null) // 'start' | 'end' | null

  // Reset trim points when video source changes
  useEffect(() => {
    setStartTime(0)
    setEndTime(0)
    setTrimResult(null)
    setError(null)
    setCurrentTime(0)
    setDuration(0)
  }, [videoSource])

  // Update current time via animation frame for smooth playhead
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const tick = () => {
      if (video && !video.paused) {
        setCurrentTime(video.currentTime)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }

    const onPlay = () => { animFrameRef.current = requestAnimationFrame(tick) }
    const onPause = () => { cancelAnimationFrame(animFrameRef.current) }
    const onSeeked = () => { setCurrentTime(video.currentTime) }
    const onLoaded = () => {
      setDuration(video.duration)
      setEndTime(video.duration)
    }
    const onTimeUpdate = () => { setCurrentTime(video.currentTime) }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [videoSource])

  // Convert mouse X position to time value
  const xToTime = useCallback((clientX) => {
    const track = timelineRef.current
    if (!track || !duration) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }, [duration])

  // Drag handlers
  useEffect(() => {
    if (!dragging) return

    const onMouseMove = (e) => {
      const time = xToTime(e.clientX)
      if (dragging === 'start') {
        setStartTime(Math.min(time, endTime - 0.1))
      } else if (dragging === 'end') {
        setEndTime(Math.max(time, startTime + 0.1))
      }
    }

    const onMouseUp = () => setDragging(null)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, startTime, endTime, xToTime])

  // Click on timeline to seek
  const handleTimelineClick = (e) => {
    if (dragging) return
    const time = xToTime(e.clientX)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Set start/end from current playhead position
  const setStartFromPlayhead = () => {
    const t = videoRef.current?.currentTime || 0
    if (t < endTime) setStartTime(t)
  }

  const setEndFromPlayhead = () => {
    const t = videoRef.current?.currentTime || 0
    if (t > startTime) setEndTime(t)
  }

  // Trim & Save
  const handleTrim = async () => {
    if (!activeFilename) {
      setError('Select a video from the library first.')
      return
    }
    if (startTime >= endTime) {
      setError('End point must be after start point.')
      return
    }

    setTrimming(true)
    setError(null)
    setTrimResult(null)

    try {
      const response = await fetch(`${SERVER}/api/trim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: activeFilename,
          start: Math.round(startTime * 100) / 100,
          end: Math.round(endTime * 100) / 100
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Trim failed')

      setTrimResult(data)

      // Preview the trimmed clip
      if (videoRef.current) {
        videoRef.current.src = data.url
        videoRef.current.play().catch(() => {})
      }

      if (typeof onTrimmed === 'function') onTrimmed(data.url)
      if (typeof onLibraryRefresh === 'function') onLibraryRefresh()
    } catch (e) {
      console.error('Trim error:', e)
      setError(e.message || 'Trim failed')
    } finally {
      setTrimming(false)
    }
  }

  // Percentage helpers for timeline
  const startPct = duration ? (startTime / duration) * 100 : 0
  const endPct = duration ? (endTime / duration) * 100 : 0
  const playheadPct = duration ? (currentTime / duration) * 100 : 0
  const clipDuration = Math.max(0, endTime - startTime)

  return (
    <section className="editor-main">
      {/* Video Preview */}
      <div className="video-preview glass">
        {videoSource ? (
          <video
            ref={videoRef}
            id="main-video"
            controls
            src={videoSource}
          />
        ) : (
          <div className="video-placeholder">
            <div className="video-placeholder-icon">🎬</div>
            <p>Select a video from the library or upload one to start editing</p>
          </div>
        )}
      </div>

      {/* Trim Console */}
      <div className="console glass">
        <div className="console-header">
          <div>
            <div className="console-title">✂️ Trimming Console</div>
            <div className="console-subtitle">
              {videoSource
                ? 'Drag the handles or use buttons to set trim points'
                : 'Load a video to begin trimming'}
            </div>
          </div>
          {duration > 0 && (
            <div className="time-badge duration">
              🕐 {formatTime(clipDuration)} selected
            </div>
          )}
        </div>

        {/* Timeline */}
        {duration > 0 && (
          <div className="timeline-container">
            {/* Time badges row */}
            <div className="timeline-times">
              <span className="time-badge start">● IN {formatTime(startTime)}</span>
              <span className="time-badge current">▶ {formatTime(currentTime)}</span>
              <span className="time-badge end">● OUT {formatTime(endTime)}</span>
            </div>

            {/* The track */}
            <div
              className="timeline-track"
              ref={timelineRef}
              onClick={handleTimelineClick}
            >
              {/* Progress (how much of video has played) */}
              <div
                className="timeline-progress"
                style={{ width: `${playheadPct}%` }}
              />

              {/* Selection highlight */}
              <div
                className="timeline-selection"
                style={{
                  left: `${startPct}%`,
                  width: `${endPct - startPct}%`
                }}
              />

              {/* Start handle */}
              <div
                className="timeline-handle start-handle"
                style={{ left: `${startPct}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDragging('start') }}
              />

              {/* End handle */}
              <div
                className="timeline-handle end-handle"
                style={{ left: `${endPct}%` }}
                onMouseDown={(e) => { e.stopPropagation(); setDragging('end') }}
              />

              {/* Playhead */}
              <div
                className="timeline-playhead"
                style={{ left: `${playheadPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="trim-controls">
          <button
            className="set-point-btn"
            onClick={setStartFromPlayhead}
            disabled={!videoSource || !duration}
            title="Set start from current position"
          >
            <span className="dot green"></span> Set In
          </button>

          <button
            className="set-point-btn"
            onClick={setEndFromPlayhead}
            disabled={!videoSource || !duration}
            title="Set end from current position"
          >
            <span className="dot red"></span> Set Out
          </button>

          <div className="spacer" />

          {trimResult && (
            <a
              className="download-btn"
              href={`${SERVER}/api/download/trimmed/${trimResult.filename}`}
              download={trimResult.filename}
              title="Download trimmed clip"
            >
              ⬇ Download
            </a>
          )}

          <button
            className="trim-btn"
            onClick={handleTrim}
            disabled={trimming || !videoSource || !duration}
          >
            {trimming ? (
              <>
                <span className="spinner"></span>
                Trimming...
              </>
            ) : (
              <>✂️ Trim & Save</>
            )}
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="status-msg error">⚠ {error}</div>
        )}
        {trimResult && !error && (
          <div className="status-msg success">
            ✅ Clip saved as <strong>{trimResult.filename}</strong>
          </div>
        )}
      </div>
    </section>
  )
}
