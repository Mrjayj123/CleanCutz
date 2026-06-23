import React, { useState, useCallback } from 'react'
import VideoLibrary from './VideoLibrary'
import VideoEditor from './VideoEditor'

export default function Studio({ onLogout }) {
  const [mainVideoSrc, setMainVideoSrc] = useState('')
  const [activeFilename, setActiveFilename] = useState('')
  const [libraryKey, setLibraryKey] = useState(0)

  const handleSelectVideo = useCallback((videoUrl, filename) => {
    setMainVideoSrc(videoUrl)
    setActiveFilename(filename)
  }, [])

  const handleTrimmed = useCallback((trimmedUrl) => {
    // Preview the trimmed clip in the editor
    setMainVideoSrc(trimmedUrl)
  }, [])

  const handleLibraryRefresh = useCallback(() => {
    // Force library to re-fetch by changing its key
    setLibraryKey(prev => prev + 1)
  }, [])

  return (
    <main className="app-layout">
      <nav className="navbar">
        <div className="logo">CLEAN<span>CUTZ</span></div>
        <button className="btn-outline" onClick={onLogout}>
          Logout
        </button>
      </nav>

      <div className="studio-content">
        <VideoLibrary
          key={libraryKey}
          onSelectVideo={handleSelectVideo}
          activeFilename={activeFilename}
        />
        <VideoEditor
          videoSource={mainVideoSrc}
          activeFilename={activeFilename}
          onTrimmed={handleTrimmed}
          onLibraryRefresh={handleLibraryRefresh}
        />
      </div>
    </main>
  )
}
