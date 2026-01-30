const API_URL = '/api'; // Relative path for Vercel
let currentBookId = null;

// DOM Elements
const homeView = document.getElementById('home-view');
const playerView = document.getElementById('player-view');
const searchOverlay = document.getElementById('search-overlay');
const loader = document.getElementById('loader');

// --- Initialization ---
async function init() {
    try {
        const res = await fetch(`${API_URL}?type=home`);
        const data = await res.json();
        renderHome(data);
    } catch (e) {
        alert('Gagal memuat data. Periksa koneksi internet.');
    } finally {
        loader.classList.add('hidden');
    }
}

// --- Rendering Home ---
function renderHome(data) {
    // Render Hero (Ambil item pertama dari Latest)
    const heroItem = data.latest[0];
    const hero = document.getElementById('hero-section');
    hero.style.backgroundImage = `url('${heroItem.image}')`;
    hero.innerHTML = `
        <div class="hero-content">
            <h1 class="hero-title">${heroItem.title}</h1>
            <button class="btn-play" onclick="openDetail('${heroItem.book_id}')">
                <i class="fas fa-play"></i> Putar
            </button>
        </div>
    `;

    // Render Trending
    const trendingRow = document.getElementById('trending-row');
    data.trending.forEach(item => trendingRow.appendChild(createCard(item)));

    // Render Latest (Skip first item coz it's in Hero)
    const latestRow = document.getElementById('latest-row');
    data.latest.slice(1).forEach(item => latestRow.appendChild(createCard(item)));
}

function createCard(item) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<img src="${item.image}" alt="${item.title}" loading="lazy">`;
    div.onclick = () => openDetail(item.book_id);
    return div;
}

// --- Detail & Player Logic ---
async function openDetail(bookId) {
    loader.classList.remove('hidden');
    currentBookId = bookId;
    
    try {
        const res = await fetch(`${API_URL}?type=detail&bookId=${bookId}`);
        const data = await res.json();
        
        // Populate Info
        document.getElementById('p-title').innerText = data.title;
        document.getElementById('p-desc').innerText = data.description.substring(0, 150) + '...';
        document.getElementById('p-eps').innerText = `${data.stats.total_episodes} Episodes`;
        
        // Populate Episodes
        const grid = document.getElementById('episode-grid');
        grid.innerHTML = '';
        data.episode_list.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'ep-btn';
            btn.innerText = ep.episode;
            btn.onclick = () => playEpisode(ep.episode, btn);
            grid.appendChild(btn);
        });

        // Switch View
        homeView.classList.add('hidden');
        playerView.classList.remove('hidden');
        window.scrollTo(0,0);

        // Auto play ep 1
        if(data.episode_list.length > 0) {
            playEpisode(data.episode_list[0].episode, grid.firstChild);
        }

    } catch (e) {
        alert('Gagal memuat detail drama.');
    } finally {
        loader.classList.add('hidden');
    }
}

async function playEpisode(epNum, btnElement) {
    // UI Update
    document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    const video = document.getElementById('main-player');
    
    try {
        const res = await fetch(`${API_URL}?type=stream&bookId=${currentBookId}&episode=${epNum}`);
        const data = await res.json();
        
        video.src = data.video_url;
        video.play();
    } catch (e) {
        console.error("Stream error", e);
    }
}

function goHome() {
    playerView.classList.add('hidden');
    homeView.classList.remove('hidden');
    document.getElementById('main-player').pause();
}

// --- Search Logic ---
function toggleSearch() {
    searchOverlay.classList.toggle('hidden');
    if (!searchOverlay.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
    }
}

let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = e.target.value;
        if (query.length < 3) return;

        const res = await fetch(`${API_URL}?type=search&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `<img src="${item.image}" alt="${item.title}">`;
            div.onclick = () => {
                toggleSearch();
                openDetail(item.book_id);
            };
            resultsDiv.appendChild(div);
        });
    }, 500); // Debounce
}

// Start
init();
