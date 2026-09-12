const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Google Drive & Auth Setup using serviceAccountKey.json
const FILE_ID = '19KAeX0_S6_BIIFjGMsVdeEAFIzsM0eyT';

let auth;
if (fs.existsSync('./serviceAccountKey.json')) {
    auth = new google.auth.GoogleAuth({
        keyFile: './serviceAccountKey.json',
        scopes: ['https://www.googleapis.com/auth/drive']
    });
} else {
    auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.FIREBASE_CONFIG || '{}'),
        scopes: ['https://www.googleapis.com/auth/drive']
    });
}

const drive = google.drive({ version: 'v3', auth });
console.log('Connected to Google Drive API successfully!');

// Helper function to read data directly using the File ID
async function getDriveData() {
    try {
        const fileContent = await drive.files.get(
            { fileId: FILE_ID, alt: 'media' }, 
            { responseType: 'json' }
        );
        return fileContent.data || [];
    } catch (err) {
        console.error('Error reading from Drive file ID:', err.message);
        return [];
    }
}

// Helper function to save data directly using the File ID
async function saveDriveData(data) {
    try {
        const fileBuffer = Buffer.from(JSON.stringify(data, null, 2));
        await drive.files.update({
            fileId: FILE_ID,
            media: {
                mimeType: 'application/json',
                body: fileBuffer,
            },
        });
        console.log('Successfully updated users.json in Google Drive.');
    } catch (err) {
        console.error('CRITICAL DRIVE SAVE ERROR:', err.message);
    }
}

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

app.get('/api/videos', async (req, res) => {
    // Return empty array for videos for now or handle via another file ID if needed
    res.json([]);
});

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ error: 'Username and password are required.' });
        }
        
        const users = await getDriveData();
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

        await saveDriveData(users);
        res.json({ success: true });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await getDriveData();
        
        const user = users.find(u => u.username.trim() === username.trim() && u.password === password);
        if (!user) {
            return res.json({ error: 'Invalid username or password.' });
        }

        res.json({ success: true, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});