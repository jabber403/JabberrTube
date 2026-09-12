const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Firebase Admin using the Render Environment Variable or local fallback
try {
    let serviceAccount;
    if (process.env.FIREBASE_CONFIG) {
        // Parse the environment variable string for Render
        serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
        console.log('Loaded serviceAccountKey from FIREBASE_CONFIG env variable.');
    } else {
        // Fallback for local testing if file exists
        serviceAccount = require('./serviceAccountKey.json');
        console.log('Loaded serviceAccountKey from local file.');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Connected to Firebase Firestore successfully!');
} catch (err) {
    console.error('Critical Firebase Auth Error:', err.message);
}

const db = admin.firestore();

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

// --- API ENDPOINTS (Firestore) ---

app.get('/api/videos', async (req, res) => {
    try {
        const snapshot = await db.collection('videos').orderBy('id', 'desc').get();
        const videos = [];
        snapshot.forEach(doc => {
            if (doc.data()) videos.push(doc.data());
        });
        res.json(videos);
    } catch (err) {
        console.error('Error fetching videos:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ error: 'Username and password are required.' });
        }
        
        // Check if username already exists
        const userQuery = await db.collection('users').where('username', '==', username).get();
        if (!userQuery.empty) {
            return res.json({ error: 'Username already taken.' });
        }

        // Save new user
        await db.collection('users').add({
            username,
            password,
            bio: 'Welcome to my JabberrTube channel!',
            avatarUrl: '',
            bannerUrl: '',
            subscribersCount: 0,
            subscriptions: []
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const userQuery = await db.collection('users')
            .where('username', '==', username)
            .where('password', '==', password)
            .get();

        if (userQuery.empty) {
            return res.json({ error: 'Invalid username or password.' });
        }

        res.json({ success: true, username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});