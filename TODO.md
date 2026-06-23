- [ ] Add backend endpoint POST /api/trim using FFmpeg to generate a saved trimmed file (note: ffmpeg not currently installed on system) 

- [ ] Update VideoEditor to call /api/trim and preview the returned trimmed URL
- [ ] Refresh VideoLibrary after trimming (likely via a callback)
- [ ] Ensure output folder exists (public/videos/trimmed)
- [ ] Test: upload video -> trim -> confirm trimmed file is saved and playable

