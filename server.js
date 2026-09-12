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

// Define Database Schemas & Models
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

const replySchema = new mongoose.Schema({
    id: Number,
    username: String,
    text: String,
    likes: [String],
    dislikes: [String]
});

const commentSchema = new mongoose.Schema({
    id: Number,
    username: String,
    text: String,
    likes: [String],
    dislikes: [String],
    replies: [replySchema]
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

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS ---

// Get all videos
app.get('/api/videos', async (req, res) => {
    try {
        const videos = await Video.find().sort({ id: -1 });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// User Sign Up
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existing = await User.findOne({ username });
        if (existing) return res.json({ error: 'Username already taken.' });

        await User.create({ username, password });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// User Log In
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.json({ error: 'Invalid username or password.' });
        res.json({ username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get User Profile
app.get('/api/user/:username', async (req, res) => {
    try {
        let user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.json({ username: req.params.username, bio: 'No bio provided.', subscribersCount: 0, subscriptions: [] });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update User Profile
app.post('/api/user/profile', upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]), async (req, res) => {
    try {
        const { username, bio } = req.body;
        let user = await User.findOne({ username });
        if (!user) {
            user = new User({ username, bio });
        }

        user.bio = bio;
        if (req.files['avatar']) user.avatarUrl = req.files['avatar'][0].path;
        if (req.files['banner']) user.bannerUrl = req.files['banner'][0].path;

        await user.save();
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload Video
app.post('/api/upload', upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, description, hashtags, uploader } = req.body;
        if (!req.files['videoFile']) return res.status(400).json({ error: 'Video file required.' });

        const newVideo = await Video.create({
            id: Date.now(),
            title,
            description,
            hashtags,
            uploader,
            videoUrl: req.files['videoFile'][0].path,
            thumbnailUrl: req.files['thumbnailFile'] ? req.files['thumbnailFile'][0].path : '',
            likes: [],
            dislikes: [],
            comments: []
        });

        res.json({ success: true, video: newVideo });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Like Video
app.post('/api/like', async (req, res) => {
    try {
        const { videoId, username } = req.body;
        const video = await Video.findOne({ id: videoId });
        if (!video) return res.status(404).json({ error: 'Video not found' });

        video.dislikes = video.dislikes.filter(u => u !== username);
        if (video.likes.includes(username)) {
            video.likes = video.likes.filter(u => u !== username);
        } else {
            video.likes.push(username);
        }
        await video.save();
        res.json({ success: true, video });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Dislike Video
app.post('/api/dislike', async (req, res) => {
    try {
        const { videoId, username } = req.body;
        const video = await Video.findOne({ id: videoId });
        if (!video) return res.status(404).json({ error: 'Video not found' });

        video.likes = video.likes.filter(u => u !== username);
        if (video.dislikes.includes(username)) {
            video.dislikes = video.dislikes.filter(u => u !== username);
        } else {
            video.dislikes.push(username);
        }
        await video.save();
        res.json({ success: true, video });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Post Comment
app.post('/api/comment', async (req, res) => {
    try {
        const { videoId, username, text } = req.body;
        const video = await Video.findOne({ id: videoId });
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const newComment = { id: Date.now(), username, text, likes: [], dislikes: [], replies: [] };
        video.comments.push(newComment);
        await video.save();
        res.json({ success: true, video });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Subscribe to Channel
app.post('/api/subscribe', async (req, res) => {
    try {
        const { subscriber, channel } = req.body;
        const subUser = await User.findOne({ username: subscriber });
        const targetUser = await User.findOne({ username: channel });
        if (!subUser) return res.status(400).json({ error: 'Subscriber not found' });

        if (!subUser.subscriptions) subUser.subscriptions = [];

        if (subUser.subscriptions.includes(channel)) {
            subUser.subscriptions = subUser.subscriptions.filter(c => c !== channel);
            if (targetUser && targetUser.subscribersCount > 0) targetUser.subscribersCount--;
        } else {
            subUser.subscriptions.push(channel);
            if (targetUser) targetUser.subscribersCount = (targetUser.subscribersCount || 0) + 1;
        }

        await subUser.save();
        if (targetUser) await targetUser.save();

        res.json({ success: true, subscriptions: subUser.subscriptions });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});