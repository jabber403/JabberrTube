const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Local file paths
const USERS_FILE = path.join(__dirname, 'users.json');
const VIDEOS_FILE = path.join(__dirname, 'videos.json');

// Helper to read local JSON
function readLocalData(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err.message);
        return [];
    }
}

// Helper to save local JSON
function saveLocalData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err.message);
    }
}

// Ensure files exist on startup
readLocalData(USERS_FILE);
readLocalData(VIDEOS_FILE);
console.log('Using local JSON storage successfully!');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'y9ybbywe',
    api_key: process.env.CLOUDINARY_API_KEY || '342561483947644',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'h66JKyyWu81bs53GZ6KjCVQtKOU'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folder = 'jabberrtube/files';
        let resource_type = 'auto';
        if (file.mimetype.startsWith('video')) folder = 'jabberrtube/videos';
        else if (file.mimetype.startsWith('image')) folder = 'jabberrtube/images';
        return { folder, resource_type, allowed_formats: ['mp4', 'jpg', 'jpeg', 'png', 'gif'] };
    }
});
const upload = multer({ storage: storage });

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS ---

app.get('/api/videos', (req, res) => {
    try {
        const videos = readLocalData(VIDEOS_FILE);
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/signup', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ error: 'Username and password are required.' });
        }
        
        const users = readLocalData(USERS_FILE);
        const existingUser = users.find(u => u.username.trim() === username.trim());
        if (existingUser) {
            return res.json({ error: 'Username already taken.' });
        }

        users.push({
            username: username.trim(),
            password,
            bio: 'Welcome to my JabberrTube channel!',
            avatarUrl: '',
            bannerUrl: '',
            subscribersCount: 0,
            subscriptions: []
        });

        saveLocalData(USERS_FILE, users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const users = readLocalData(USERS_FILE);
        
        const user = users.find(u => u.username.trim() === username.trim() && u.password === password);
        if (!user) {
            return res.json({ error: 'Invalid username or password.' });
        }

        res.json({ success: true, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});