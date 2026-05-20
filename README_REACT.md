# Clean Cutz - React Video Studio

A modern, glass-morphism styled video editing application built with React and Vite.

## Features

- **User Authentication**: Simple login system with editor names
- **Video Library**: Fetch cinematic videos from Pexels API
- **Video Player**: Built-in video preview with controls
- **Trimming Console**: Set start and end points to clip videos
- **Modern UI**: Glass-morphism design with smooth animations

## Project Structure

```
src/
├── main.jsx              # React entry point
├── App.jsx              # Main app component with login/logout state
├── index.css            # Global styles
└── components/
    ├── LoginScreen.jsx  # Authentication component
    ├── Studio.jsx       # Main studio layout
    ├── VideoLibrary.jsx # Video library sidebar
    └── VideoEditor.jsx  # Video player and trimming console
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

## How to Use

1. **Login**: Enter an editor name and click "Launch Studio"
2. **Browse Videos**: Click on videos in the library to select them
3. **Trim Videos**: 
   - Set start and end times in seconds
   - Click "Capture & Borrow Clip" to create a trimmed version
   - The video player will show the clipped portion

## Technology Stack

- **React 18**: UI framework
- **Vite**: Build tool and development server
- **Pexels API**: Video content source
- **CSS3**: Glass-morphism styling with backdrop filters

## API Configuration

The app uses the Pexels API to fetch cinematic videos. The API key is configured in `src/components/VideoLibrary.jsx`. For production, consider moving this to environment variables.

```javascript
const API_KEY = 'your-pexels-api-key'
```

## Notes

- The trimming feature uses Media Fragments URI (#t=start,end) for preview
- For actual video trimming/download, you would need a backend with FFmpeg
- All styling is responsive and works on different screen sizes
