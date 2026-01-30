const API_URL = '/api';
let currentBookId = null;

const loader = document.getElementById('loader');
const homeView = document.getElementById('home-view');
const playerView = document.getElementById('player-view');

// --- Init ---
async function init() {
    try {
        const res = await fetch(`${API_URL}?type=home`);
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        renderHome(data);
    } catch (e) {
        console.error(e);
        // Jangan alert error di awal, biarkan user melihat UI kosong daripada popup
    } finally {
        loader.classList.add('hidden');
    }
}

// --- Render Home ---
function renderHome(data) {
    // Setup Hero (Ambil item trending pertama)
    if (data.trending && data.trending.length > 0) {
        const heroItem = data.trending[0];
        const hero = document.getElementById('hero-section');
        hero.style.backgroundImage = `url('${heroItem.image}')`;
        document.getElementById('hero-title').innerText = heroItem.title;
        
        // Fix tombol play di hero
        document.getElementById('hero-play-btn').onclick = () => openDetail(heroItem.book_id);
    }

    // Render Trending
    const trendingRow = document.getElementById('trending-row');
    data.trending.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        // Tambahkan nomor ranking
        div.innerHTML = `
            <span class="rank-number">${item.rank}</span>
            <img src="${item.image}" loading="lazy">
        `;
        div.onclick = () => openDetail(item.book_id);
        trendingRow.appendChild(div);
    });

    // Render Latest
    const latestRow = document.getElementById('latest-row');
    data.latest.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `<img src="${item.image}" loading="lazy">`;
        div.onclick = () => openDetail(item.book_id);
        latestRow.appendChild(div);
    });
}

// --- Detail & Player ---
async function openDetail(bookId) {
    if (!bookId) return alert("Error: ID Drama tidak valid.");
    
    loader.classList.remove('hidden');
    currentBookId = bookId;

    try {
        const res = await fetch(`${API_URL}?type=detail&bookId=${bookId}`);
        const data = await res.json();

        if (!data || !data.title) throw new Error("Data kosong");

        // Isi Info
        document.getElementById('p-title').innerText = data.title;
        document.getElementById('p-desc').innerText = data.description;
        document.getElementById('p-eps-count').innerText = `${data.stats.total_episodes} Episodes`;
        
        // Render Episode Grid
        const grid = document.getElementById('episode-grid');
        grid.innerHTML = '';
        
        if (data.episode_list.length === 0) {
            grid.innerHTML = '<p style="color:#666; font-size:0.8rem;">Tidak ada episode ditemukan.</p>';
        }

        data.episode_list.forEach((ep, index) => {
            const btn = document.createElement('button');
            btn.className = 'ep-btn';
            btn.innerText = ep.episode;
            btn.onclick = () => playEpisode(ep.episode, btn);
            grid.appendChild(btn);
        });

        // Tampilkan Player UI
        playerView.classList.remove('hidden');
        homeView.classList.add('hidden');
        window.scrollTo(0,0);

        // Auto play episode 1
        if (data.episode_list.length > 0) {
            playEpisode(data.episode_list[0].episode, grid.children[0]);
        }

    } catch (e) {
        console.error(e);
        alert('Maaf, detail drama ini gagal dimuat. Coba drama lain.');
    } finally {
        loader.classList.add('hidden');
    }
}

async function playEpisode(epNum, btnElement) {
    // Visual active state
    document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const video = document.getElementById('main-player');
    
    // Tampilkan loading state pada video (opsional: bisa tambah poster loading)
    video.pause();
    
    try {
        const res = await fetch(`${API_URL}?type=stream&bookId=${currentBookId}&episode=${epNum}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        video.src = data.video_url;
        video.load();
        
        // Promise play untuk handle browser policy
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Auto-play prevented. User must click play.");
            });
        }

    } catch (e) {
        console.error("Stream Error:", e);
        alert("Gagal memutar video. Sumber mungkin rusak atau diproteksi.");
    }
}

function closePlayer() {
    const video = document.getElementById('main-player');
    video.pause();
    video.src = ""; // Stop buffering
    playerView.classList.add('hidden');
    homeView.classList.remove('hidden');
}

// --- Search ---
function toggleSearch() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.toggle('hidden');
    if (!overlay.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
    }
}

let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    
    if (query.length < 3) return;

    searchTimeout = setTimeout(async () => {
        const res = await fetch(`${API_URL}?type=search&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        const grid = document.getElementById('search-results');
        grid.innerHTML = '';
        
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `<img src="${item.image}" style="height:140px; border-radius:4px;">`;
            div.onclick = () => {
                toggleSearch();
                openDetail(item.book_id);
            };
            grid.appendChild(div);
        });
    }, 600);
}

// Start
init();
