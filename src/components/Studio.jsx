import React, { useState } from 'react'
import VideoLibrary from './VideoLibrary'
import VideoEditor from './VideoEditor'

export default function Studio({ onLogout }) {
  const [activeSource, setActiveSource] = useState('')
  const [mainVideoSrc, setMainVideoSrc] = useState('')

  const handleSelectVideo = (videoUrl) => {
    setActiveSource(videoUrl)
    setMainVideoSrc(videoUrl)
  }

  return (
    <main className="app-layout">
      <nav className="navbar">
        <div className="logo">CLEAN<span>CUTZ</span></div>
        <button className="btn-outline" onClick={onLogout}>
          Logout
        </button>
      </nav>

      <div className="studio-content">
        <VideoLibrary onSelectVideo={handleSelectVideo} />
        <VideoEditor videoSource={mainVideoSrc} activeSource={activeSource} />
      </div>
    </main>
  )
}
