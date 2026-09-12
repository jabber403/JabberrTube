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
const FOLDER_ID = '1wIldP7boHM_n2-ixjyklTZaGxsjVpgja';

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

// Helper function to read/create a JSON data file from Google Drive folder
async function getDriveData(fileName) {
    try {
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id, name)',
        });
        
        if (res.data.files.length > 0) {
            const fileId = res.data.files[0].id;
            const fileContent = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' });
            return fileContent.data || [];
        } else {
            await saveDriveData(fileName, []);
            return [];
        }
    } catch (err) {
        console.error(`Error reading ${fileName} from Drive:`, err.message);
        return [];
    }
}

// Helper function to save JSON data to Google Drive folder
async function saveDriveData(fileName, data) {
    try {
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id, name)',
        });

        const fileBuffer = Buffer.from(JSON.stringify(data, null, 2));
        const media = {
            mimeType: 'application/json',
            body: fileBuffer,
        };

        if (res.data.files.length > 0) {
            const fileId = res.data.files[0].id;
            await drive.files.update({
                fileId: fileId,
                media: media,
            });
            console.log(`Successfully updated ${fileName} in Google Drive.`);
        } else {
            const fileMetadata = {
                name: fileName,
                parents: [FOLDER_ID],
            };
            await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });
            console.log(`Successfully created ${fileName} in Google Drive.`);
        }
    } catch (err) {
        console.error(`CRITICAL DRIVE SAVE ERROR for ${fileName}:`, err.message);
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
    try {
        const videos = await getDriveData('videos.json');
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
        
        const users = await getDriveData('users.json');
        const existingUser = users.find(u => u.username === username);
        if (existingUser) {
            return res.json({ error: 'Username already taken.' });
        }

        users.push({
            username,
            password,
            bio: 'Welcome to my JabberrTube channel!',
            avatarUrl: '',
            bannerUrl: '',
            subscribersCount: 0,
            subscriptions: []
        });

        await saveDriveData('users.json', users);
        res.json({ success: true });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await getDriveData('users.json');
        
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
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