const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://stupidnoobplays905_db_user:2Nc6NwNaBugmHhfv@jabbertube-data.ndozr3q.mongodb.net/jabberrtube?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    bio: { type: String, default: 'Welcome to my JabberrTube channel!' },
    avatarUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    subscribersCount: { type: Number, default: 0 },
    subscriptions: [String]
});
const User = mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({
    id: Number,
    username: String,
    text: String,
    likes: [String],
    dislikes: [String]
});

const videoSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    title: String,
    description: String,
    hashtags: String,
    uploader: String,
    videoUrl: String,
    thumbnailUrl: String,
    likes: [String],
    dislikes: [String],
    comments: [commentSchema]
});
const Video = mongoose.model('Video', videoSchema);

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
        const videos = await Video.find().sort({ id: -1 });
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
        
        const existing = await User.findOne({ username });
        if (existing) {
            return res.json({ error: 'Username already taken.' });
        }

        await User.create({ username, password });
        res.json({ success: true });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
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