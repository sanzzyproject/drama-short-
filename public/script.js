const API_URL = '/api';
let currentBookId = null;

const loader = document.getElementById('loader');
const homeView = document.getElementById('home-view');
const playerView = document.getElementById('player-view');

// Tampilkan error di layar (bukan cuma console)
function showError(msg) {
    loader.classList.add('hidden');
    const hero = document.getElementById('hero-section');
    hero.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:white;">
            <h2>⚠️ Terjadi Kesalahan</h2>
            <p>${msg}</p>
            <br>
            <button onclick="location.reload()" style="padding:10px 20px; background:red; border:none; color:white; border-radius:4px;">Coba Reload</button>
        </div>
    `;
}

async function init() {
    try {
        const res = await fetch(`${API_URL}?type=home`);
        if (!res.ok) throw new Error(`Server Error: ${res.status}`);
        
        const data = await res.json();
        
        // Cek apakah data kosong
        if (!data.latest || data.latest.length === 0) {
            throw new Error("Data Kosong. Website target mungkin memblokir server atau sedang maintenance.");
        }

        renderHome(data);
    } catch (e) {
        console.error(e);
        showError(`Gagal memuat data: ${e.message}`);
    } finally {
        loader.classList.add('hidden');
    }
}

function renderHome(data) {
    // SETUP HERO (Gunakan item pertama)
    if (data.latest && data.latest.length > 0) {
        const heroItem = data.latest[0];
        const hero = document.getElementById('hero-section');
        hero.style.backgroundImage = `url('${heroItem.image}')`;
        
        document.getElementById('hero-title').innerText = heroItem.title || 'Drama China';
        document.getElementById('hero-play-btn').onclick = () => openDetail(heroItem.book_id);
    }

    // RENDER TRENDING (Jika trending kosong, sembunyikan sectionnya)
    const trendingRow = document.getElementById('trending-row');
    if (data.trending && data.trending.length > 0) {
        data.trending.forEach(item => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <span class="rank-number">${item.rank}</span>
                <img src="${item.image}" onerror="this.src='https://via.placeholder.com/100x150?text=Err'">
            `;
            div.onclick = () => openDetail(item.book_id);
            trendingRow.appendChild(div);
        });
    } else {
        document.querySelector('h3.section-title').style.display = 'none';
    }

    // RENDER LATEST
    const latestRow = document.getElementById('latest-row');
    data.latest.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `<img src="${item.image}" onerror="this.src='https://via.placeholder.com/100x150?text=Err'">`;
        div.onclick = () => openDetail(item.book_id);
        latestRow.appendChild(div);
    });
}

async function openDetail(bookId) {
    if(!bookId) return alert("ID Drama tidak ditemukan");
    
    loader.classList.remove('hidden');
    currentBookId = bookId;

    try {
        // Encode bookId in case it contains special URL characters
        const res = await fetch(`${API_URL}?type=detail&bookId=${encodeURIComponent(bookId)}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Populate UI
        document.getElementById('p-title').innerText = data.title;
        document.getElementById('p-desc').innerText = data.description || "Tidak ada deskripsi.";
        document.getElementById('p-eps-count').innerText = `${data.episode_list.length} Episodes`;

        const grid = document.getElementById('episode-grid');
        grid.innerHTML = '';

        if(data.episode_list.length === 0) {
            grid.innerHTML = "<p style='color:gray'>Episode tidak ditemukan / Server diblokir.</p>";
        }

        data.episode_list.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'ep-btn';
            btn.innerText = ep.episode;
            // Kita kirim ID episode (bisa berupa URL) ke fungsi play
            btn.onclick = () => playEpisode(ep.id, btn); 
            grid.appendChild(btn);
        });

        playerView.classList.remove('hidden');
        homeView.classList.add('hidden');
        window.scrollTo(0,0);

    } catch (e) {
        alert("Gagal membuka detail: " + e.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function playEpisode(episodeId, btnElement) {
    document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');

    const video = document.getElementById('main-player');
    
    try {
        // Kita kirim 'episode' param berisi episodeId (yg mungkin adalah URL penuh)
        const res = await fetch(`${API_URL}?type=stream&bookId=${currentBookId}&episode=${encodeURIComponent(episodeId)}`);
        const data = await res.json();

        if (!data.video_url) throw new Error("Video URL not found");

        video.src = data.video_url;
        video.play().catch(e => console.log("Autoplay blocked"));

    } catch (e) {
        alert("Gagal memutar: " + e.message);
    }
}

function goHome() {
    document.getElementById('main-player').pause();
    playerView.classList.add('hidden');
    homeView.classList.remove('hidden');
}

function closePlayer() { goHome(); }

// Search logic remains mostly same...
function toggleSearch() {
    document.getElementById('search-overlay').classList.toggle('hidden');
}

let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 3) return;

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}?type=search&query=${encodeURIComponent(query)}`);
            const data = await res.json();
            const grid = document.getElementById('search-results');
            grid.innerHTML = '';
            
            if(data.length === 0) {
                grid.innerHTML = '<p style="color:white; grid-column:span 3; text-align:center;">Tidak ditemukan</p>';
                return;
            }

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `<img src="${item.image}" style="height:120px; border-radius:4px">`;
                div.onclick = () => { toggleSearch(); openDetail(item.book_id); };
                grid.appendChild(div);
            });
        } catch(e) {
            console.error(e);
        }
    }, 600);
}

init();
