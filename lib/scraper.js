import axios from 'axios';
import * as cheerio from 'cheerio';

const CONFIG = {
    BASE_URL: 'https://dramabox.web.id',
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://dramabox.web.id/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
};

const request = async (url) => {
    try {
        const response = await axios.get(url, { headers: CONFIG.HEADERS });
        return cheerio.load(response.data);
    } catch (error) {
        console.error("Request Error:", error.message);
        throw new Error(`Gagal mengambil data dari sumber.`);
    }
};

const resolveUrl = (link) => {
    if (!link) return null;
    if (link.startsWith('http')) return link;
    return `${CONFIG.BASE_URL}/${link.replace(/^\//, '')}`;
};

// Logika ekstraksi ID yang lebih kuat (Regex)
const getBookIdFromUrl = (url) => {
    try {
        if (!url) return null;
        // Coba ambil dari parameter URL standar
        const urlObj = new URL(url);
        let id = urlObj.searchParams.get('bookId');
        
        // Jika gagal, coba cari pola regex di string URL
        if (!id) {
            const match = url.match(/bookId=([^&]+)/);
            if (match) id = match[1];
        }
        return id;
    } catch (e) {
        // Fallback manual regex jika URL parser gagal
        const match = url.match(/bookId=([^&]+)/);
        return match ? match[1] : null;
    }
};

export const dramabox = {
    home: async () => {
        const $ = await request(CONFIG.BASE_URL);
        const latest = [];
        
        // Ambil elemen drama grid
        $('.drama-grid .drama-card').each((_, el) => {
            const linkTag = $(el).find('a').first(); // Cari tag a pertama
            const link = resolveUrl(linkTag.attr('href'));
            const bookId = getBookIdFromUrl(link);

            if (bookId) {
                latest.push({
                    title: $(el).find('.drama-title').text().trim(),
                    book_id: bookId,
                    image: $(el).find('img').attr('src') || $(el).find('img').attr('data-src'),
                    episodes: $(el).find('.drama-meta').text().trim()
                });
            }
        });

        const trending = [];
        $('.sidebar-widget .rank-list .rank-item').each((_, el) => {
            const link = resolveUrl($(el).attr('href'));
            const bookId = getBookIdFromUrl(link);
            
            if (bookId) {
                trending.push({
                    rank: $(el).find('.rank-number').text().trim(),
                    title: $(el).find('.rank-title').text().trim(),
                    book_id: bookId,
                    image: $(el).find('img').attr('src'),
                    views: $(el).find('.rank-meta').text().trim()
                });
            }
        });

        return { latest, trending };
    },

    search: async (query) => {
        const targetUrl = `${CONFIG.BASE_URL}/search.php?q=${encodeURIComponent(query)}`;
        const $ = await request(targetUrl);

        const results = [];
        $('.drama-grid .drama-card').each((_, el) => {
            const link = resolveUrl($(el).find('a').attr('href'));
            const bookId = getBookIdFromUrl(link);

            if (bookId) {
                results.push({
                    title: $(el).find('.drama-title').text().trim(),
                    book_id: bookId,
                    image: $(el).find('img').attr('src')
                });
            }
        });
        return results;
    },

    detail: async (bookId) => {
        if (!bookId) throw new Error("ID Drama tidak ditemukan.");

        const targetUrl = `${CONFIG.BASE_URL}/watch.php?bookId=${bookId}`;
        const $ = await request(targetUrl);

        // Bersihkan judul
        let fullTitle = $('.video-title').text().trim();
        fullTitle = fullTitle.replace(/- Episode \d+/, '').trim(); // Hapus tulisan Episode X

        const episodes = [];
        // Selector episode diperbaiki untuk menangkap semua kemungkinan tombol
        $('.episodes-grid a, .episodes-grid button, .episode-list a').each((_, el) => {
            const epNum = $(el).text().trim().replace(/\D/g, ''); // Ambil angka saja
            const epId = $(el).attr('data-episode') || $(el).attr('href'); // Kadang ID ada di href
            
            if (epNum) {
                episodes.push({
                    episode: parseInt(epNum),
                    id: epId
                });
            }
        });

        // Urutkan episode dari 1 sampai terakhir
        episodes.sort((a, b) => a.episode - b.episode);

        return {
            book_id: bookId,
            title: fullTitle || "Drama China",
            description: $('.video-description').text().trim() || "Tidak ada deskripsi.",
            // Fallback image jika meta tag kosong
            thumbnail: $('meta[property="og:image"]').attr('content') || '',
            stats: {
                total_episodes: episodes.length,
            },
            episode_list: episodes
        };
    },

    stream: async (bookId, episode) => {
        if (!bookId || !episode) throw new Error("Data tidak lengkap.");

        const targetUrl = `${CONFIG.BASE_URL}/watch.php?bookId=${bookId}&episode=${episode}`;
        const $ = await request(targetUrl);

        // Cari source video dengan beberapa metode
        let videoUrl = $('#mainVideo source').attr('src'); // Metode 1: HTML5 standard
        if (!videoUrl) videoUrl = $('#mainVideo').attr('src'); // Metode 2: Direct video tag
        if (!videoUrl) videoUrl = $('iframe').attr('src'); // Metode 3: Iframe embed

        // Jika URL video relatif, perbaiki
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = resolveUrl(videoUrl);
        }

        if (!videoUrl) {
            throw new Error("Video source tidak ditemukan. Sumber mungkin diproteksi.");
        }

        return {
            book_id: bookId,
            episode: episode,
            video_url: videoUrl
        };
    }
};
