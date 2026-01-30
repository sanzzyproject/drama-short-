import axios from 'axios';
import * as cheerio from 'cheerio';

const CONFIG = {
    BASE_URL: 'https://dramabox.web.id',
    // Menggunakan User Agent yang sangat mirip HP asli untuk menghindari blokir
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
};

const request = async (url) => {
    try {
        console.log(`Fetching: ${url}`); // Debug log
        const response = await axios.get(url, { 
            headers: CONFIG.HEADERS,
            timeout: 10000 // Timeout 10 detik
        });
        return cheerio.load(response.data);
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        throw new Error(`Gagal koneksi ke sumber: ${error.message}`);
    }
};

const resolveUrl = (link) => {
    if (!link) return null;
    if (link.startsWith('http')) return link;
    return `${CONFIG.BASE_URL}/${link.replace(/^\//, '')}`;
};

// Logika Ekstraksi ID yang sangat agresif
const getBookIdFromUrl = (url) => {
    try {
        if (!url) return null;
        const urlObj = new URL(url);
        let id = urlObj.searchParams.get('bookId');
        if (!id) id = urlObj.searchParams.get('id'); // Kadang parameter berubah jadi id
        
        if (!id) {
            // Coba Regex jika URL params gagal
            const match = url.match(/(?:bookId|id|p)=([a-zA-Z0-9_-]+)/);
            if (match) id = match[1];
        }
        return id;
    } catch (e) {
        return null;
    }
};

export const dramabox = {
    home: async () => {
        const $ = await request(CONFIG.BASE_URL);
        const latest = [];
        
        // Selector Flexible: Mencoba menangkap elemen apapun yang terlihat seperti kartu drama
        // Kita mencari elemen yang punya class mengandung 'drama' atau 'post' atau 'card'
        $('article, .drama-card, .post-item, .item, .movie-item').each((_, el) => {
            const linkTag = $(el).find('a').first();
            const imgTag = $(el).find('img').first();
            
            const link = resolveUrl(linkTag.attr('href'));
            const bookId = getBookIdFromUrl(link);
            const title = $(el).find('h1, h2, h3, .title, .drama-title').text().trim();

            if (bookId && title) {
                latest.push({
                    title: title,
                    book_id: bookId,
                    // Ambil src, data-src, atau srcset untuk gambar
                    image: imgTag.attr('src') || imgTag.attr('data-src') || 'https://via.placeholder.com/300x450?text=No+Image',
                    episodes: $(el).text().match(/(\d+)\s*Eps/)?.[1] || '?'
                });
            }
        });

        // Jika latest kosong, berarti struktur web berubah total atau diblokir
        if (latest.length === 0) {
            console.log("Warning: Latest array is empty. Selectors might be wrong or IP blocked.");
        }

        // Trending logic (sama flexible-nya)
        const trending = [];
        $('.sidebar-widget li, .rank-list .rank-item, .popular-post').each((_, el) => {
            const linkTag = $(el).find('a').first();
            const link = resolveUrl(linkTag.attr('href'));
            const bookId = getBookIdFromUrl(link);
            
            if (bookId) {
                trending.push({
                    rank: $(el).find('.number, .rank-number').text().trim() || '#',
                    title: $(el).find('h4, .title, .rank-title').text().trim(),
                    book_id: bookId,
                    image: $(el).find('img').attr('src') || 'https://via.placeholder.com/100x150',
                });
            }
        });

        // Fallback: Jika trending kosong, gunakan data latest agar UI tidak kosong
        return { 
            latest: latest, 
            trending: trending.length > 0 ? trending : latest.slice(0, 5) 
        };
    },

    search: async (query) => {
        const targetUrl = `${CONFIG.BASE_URL}/?s=${encodeURIComponent(query)}`; // Standard WP search pattern
        const $ = await request(targetUrl);
        
        // Coba juga pattern search PHP kustom jika di atas gagal
        // const targetUrl2 = `${CONFIG.BASE_URL}/search.php?q=${encodeURIComponent(query)}`;

        const results = [];
        $('article, .drama-card, .search-result').each((_, el) => {
            const link = resolveUrl($(el).find('a').attr('href'));
            const bookId = getBookIdFromUrl(link);
            if (bookId) {
                results.push({
                    title: $(el).find('.title, h2, .drama-title').text().trim(),
                    book_id: bookId,
                    image: $(el).find('img').attr('src')
                });
            }
        });
        return results;
    },

    detail: async (bookId) => {
        if (!bookId) throw new Error("ID Drama Missing");

        // Coba beberapa pola URL detail
        let targetUrl = `${CONFIG.BASE_URL}/watch.php?bookId=${bookId}`;
        // Jika format ID terlihat seperti slug (huruf-sambung), mungkin URL-nya beda
        if (isNaN(bookId) && !bookId.match(/^\d+$/)) {
             // Jika ID bukan angka, asumsikan itu slug URL
             // (Logic ini tergantung situs aslinya)
        }

        const $ = await request(targetUrl);

        // Ambil judul
        let fullTitle = $('.video-title, .entry-title, h1').first().text().trim();
        
        // Ambil Episodes
        const episodes = [];
        // Cari semua link yang mengandung angka atau kata 'Episode'
        $('a').each((_, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            
            // Cek apakah link ini terlihat seperti tombol episode
            if (href && (href.includes('episode') || $(el).attr('class')?.includes('episode'))) {
                const epNum = text.match(/\d+/);
                if (epNum) {
                    episodes.push({
                        episode: parseInt(epNum[0]),
                        id: href // Simpan full link sebagai ID untuk keamanan
                    });
                }
            }
        });
        
        // Hapus duplikat episodes
        const uniqueEpisodes = episodes.filter((v,i,a)=>a.findIndex(v2=>(v2.episode===v.episode))===i);
        uniqueEpisodes.sort((a, b) => a.episode - b.episode);

        return {
            book_id: bookId,
            title: fullTitle || "Drama Detail",
            description: $('.video-description, .entry-content, .desc').text().trim(),
            episode_list: uniqueEpisodes
        };
    },

    stream: async (bookId, episode) => {
        // Karena kita menyimpan URL penuh di 'episode.id' pada fungsi detail,
        // Kita harus cek apakah 'episode' parameter ini URL atau angka
        let targetUrl;
        
        // Jika input 'episode' mengandung http, berarti itu URL langsung
        if (episode.toString().includes('http')) {
            targetUrl = episode;
        } else {
            // Jika angka, gunakan pola standar
            targetUrl = `${CONFIG.BASE_URL}/watch.php?bookId=${bookId}&episode=${episode}`;
        }
        
        const $ = await request(targetUrl);

        // Cari iframe atau video tag
        let videoUrl = $('iframe').attr('src') || $('video source').attr('src') || $('video').attr('src');

        if (!videoUrl) throw new Error("Video Player Not Found");

        return {
            video_url: resolveUrl(videoUrl)
        };
    }
};
