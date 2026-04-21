// data configuration
const API_KEY = 'CmtF1XYNKmwb9Ztzxwd3DsX70qvZ2yEdla7WKV09vVVO5JahlFCfbT4L'; // Pexels API key
const API_URL = 'https://api.pexels.com/videos/search?query=cinematic&per_page=12';
let activeSource = "";

// create selectors
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const videoList = document.getElementById('video-list');
const mainVideo = document.getElementById('main-video');
const cutBtn = document.getElementById('cut-btn');

// Login credentials
loginBtn.addEventListener('click', () => {
    const user = document.getElementById('username').value;
    if (user.trim() !== "") {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadLibrary();
    } else {
        document.getElementById('login-error').classList.remove('hidde');
    }
});

logoutBtn.addEventListener('click', () => {
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});


// The function that fetches the data
async function loadLibrary() {
    videoList.innerHTML = "<p style='padding:20px; color:gray;'>Loading Studio Assets...</p>";
    
    try {
        const response = await fetch(API_URL, {
            headers: {
                Authorization: API_KEY
            }
        });
        const data = await response.json();
        
        // Clear loading text
        videoList.innerHTML = "";

        // Loop through the API results
        data.videos.forEach(video => {
            const div = document.createElement('div');
            div.className = "video-card"; // Using your glass styling
            
            // We take the first high-res file provided by the API
            const videoFile = video.video_files[0].link;

            div.innerHTML = `
                <strong>${video.user.name}'s Footage</strong>
                <div style="font-size:0.7rem; color:#64748b">Duration: ${video.duration}s</div>
            `;

            div.onclick = () => {
                activeSource = videoFile;
                mainVideo.src = videoFile;
                mainVideo.play();
            };
            videoList.appendChild(div);
        });
    } catch (error) {
        videoList.innerHTML = "<p style='color:red;'>Failed to load library.</p>";
        console.error("API Error:", error);
    }
}

function selectVideo(url) {
    mainVideo.src = url;
    mainVideo.load();
}

// --- VIDEO CUTTING LOGIC ---
cutBtn.addEventListener('click', () => {
    const start = document.getElementById('start-time').value;
    const end = document.getElementById('end-time').value;

    if (parseFloat(start) >= parseFloat(end)) {
        alert("End time must be greater than start time!");
        return;
    }

    // In a real app, you would send these timestamps to a backend (like FFmpeg)
    // For a simple front-end version, we "cut" using Media Fragments URI
    const currentSrc = mainVideo.querySelector('source').src || mainVideo.src;
    const clippedUrl = `${currentSrc}#t=${start},${end}`;
    
    alert(`Clip generated from ${start}s to ${end}s!`);
    console.log("Clipped URL for download:", clippedUrl);
    
    // Preview the cut
    mainVideo.src = clippedUrl;
    mainVideo.play();
});