import { dramabox } from '../lib/scraper.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { type, query, bookId, episode } = req.query;

    try {
        let result;
        switch (type) {
            case 'home':
                result = await dramabox.home();
                break;
            case 'search':
                result = await dramabox.search(query);
                break;
            case 'detail':
                result = await dramabox.detail(bookId);
                break;
            case 'stream':
                result = await dramabox.stream(bookId, episode);
                break;
            default:
                return res.status(400).json({ error: 'Invalid type parameter' });
        }
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
