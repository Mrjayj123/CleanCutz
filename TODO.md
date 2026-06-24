- [ ] Create backend modules auth.js/db.js (done)
- [ ] Add authentication page (email + username) to React UI and wire it to backend token/session
- [ ] Revert UI behavior to use the latest working backend-secured flow
- [ ] Ensure VideoLibrary sends Authorization headers for all API calls (/api/videos, /api/upload, /api/import-url, /api/videos/:filename)
- [ ] Ensure app can fetch and play locally stored videos and imported YouTube/social/direct links
- [ ] Verify trim flow: call /api/trim, preview returned trimmed URL, refresh library
- [ ] Keep CSS intact (no modifications to existing CSS files unless adding minimal styles for new auth UI)
- [ ] Test end-to-end: register/login -> import URL -> trim -> download

