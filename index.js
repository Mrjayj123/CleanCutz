// --- CONFIG & DATA ---
const MOCK_VIDEOS = [
    { id: 1, title: "Nature B-Roll", url: "https://www.w3schools.com/html/mov_bbb.mp4" },
    { id: 2, title: "Urban Drone", url: "https://www.w3schools.com/html/horse.ogv" } // Placeholder
];

// --- SELECTORS ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const videoList = document.getElementById('video-list');
const mainVideo = document.getElementById('main-video');
const cutBtn = document.getElementById('cut-btn');

// --- AUTH LOGIC ---
loginBtn.addEventListener('click', () => {
    const user = document.getElementById('username').value;
    if (user.trim() !== "") {
        loginContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadLibrary();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});

// --- API / DATA FETCHING ---
function loadLibrary() {
    videoList.innerHTML = "";
    MOCK_VIDEOS.forEach(video => {
        const div = document.createElement('div');
        div.className = "video-thumb";
        div.textContent = video.title;
        div.onclick = () => selectVideo(video.url);
        videoList.appendChild(div);
    });
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