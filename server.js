const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configure Cloudinary using your credentials (or environment variables)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'y9ybbywe',
    api_key: process.env.CLOUDINARY_API_KEY || '342561483947644',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'h66JKyyWu81bs53GZ6KjCVQtKOU'
});

// Setup Cloudinary storage engine for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folder = 'jabberrtube/files';
        let resource_type = 'auto'; // Automatically handle images or videos
        
        if (file.mimetype.startsWith('video')) {
            folder = 'jabberrtube/videos';
        } else if (file.mimetype.startsWith('image')) {
            folder = 'jabberrtube/images';
        }

        return {
            folder: folder,
            resource_type: resource_type,
            allowed_formats: ['mp4', 'jpg', 'jpeg', 'png', 'gif']
        };
    }
});

const upload = multer({ storage: storage });

// In-Memory Database (Tip: For long-term production persistence, connect MongoDB or PostgreSQL next!)
let users = [];
let videos = [
    {
        id: 1,
        title: "Welcome to JabberrTube",
        description: "Explore the platform and upload your first video!",
        hashtags: "#jabberrtube #welcome",
        uploader: "Admin",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnailUrl: "",
        likes: [],
        dislikes: [],
        comments: []
    }
];

// Serve static frontend file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS ---

// Get all videos
app.get('/api/videos', (req, res) => {
    res.json(videos);
});

// User Sign Up
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
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
    res.json({ success: true });
});

// User Log In
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.json({ error: 'Invalid username or password.' });
    }
    res.json({ username: user.username });
});

// Get User Profile
app.get('/api/user/:username', (req, res) => {
    const user = users.find(u => u.username === req.params.username);
    if (!user) {
        return res.json({ username: req.params.username, bio: 'No bio provided.', subscribersCount: 0, subscriptions: [] });
    }
    res.json(user);
});

// Update User Profile (Avatar, Banner, Bio) with Cloudinary Uploads
app.post('/api/user/profile', upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]), (req, res) => {
    const { username, bio } = req.body;
    let user = users.find(u => u.username === username);
    if (!user) {
        user = { username, bio, subscriptions: [], subscribersCount: 0 };
        users.push(user);
    }

    user.bio = bio;
    if (req.files['avatar']) {
        user.avatarUrl = req.files['avatar'][0].path; // Cloudinary secure URL
    }
    if (req.files['banner']) {
        user.bannerUrl = req.files['banner'][0].path; // Cloudinary secure URL
    }

    res.json({ success: true, user });
});

// Upload Video with Cloudinary Storage
app.post('/api/upload', upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
]), (req, res) => {
    const { title, description, hashtags, uploader } = req.body;
    
    if (!req.files['videoFile']) {
        return res.status(400).json({ error: 'Video file is required.' });
    }

    const newVideo = {
        id: Date.now(),
        title,
        description,
        hashtags,
        uploader,
        videoUrl: req.files['videoFile'][0].path, // Permanent Cloudinary URL
        thumbnailUrl: req.files['thumbnailFile'] ? req.files['thumbnailFile'][0].path : '', // Permanent Cloudinary URL
        likes: [],
        dislikes: [],
        comments: []
    };

    videos.unshift(newVideo);
    res.json({ success: true, video: newVideo });
});

// Like Video
app.post('/api/like', (req, res) => {
    const { videoId, username } = req.body;
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // Remove from dislikes if present
    video.dislikes = video.dislikes.filter(u => u !== username);

    if (video.likes.includes(username)) {
        video.likes = video.likes.filter(u => u !== username);
    } else {
        video.likes.push(username);
    }
    res.json({ success: true, video });
});

// Dislike Video
app.post('/api/dislike', (req, res) => {
    const { videoId, username } = req.body;
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // Remove from likes if present
    video.likes = video.likes.filter(u => u !== username);

    if (video.dislikes.includes(username)) {
        video.dislikes = video.dislikes.filter(u => u !== username);
    } else {
        video.dislikes.push(username);
    }
    res.json({ success: true, video });
});

// Post Comment
app.post('/api/comment', (req, res) => {
    const { videoId, username, text } = req.body;
    const video = videos.find(v => v.id === videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const newComment = {
        id: Date.now(),
        username,
        text,
        likes: [],
        dislikes: [],
        replies: []
    };

    video.comments.push(newComment);
    res.json({ success: true, video });
});

// Subscribe to a Channel
app.post('/api/subscribe', (req, res) => {
    const { subscriber, channel } = req.body;
    const subUser = users.find(u => u.username === subscriber);
    const targetUser = users.find(u => u.username === channel);

    if (!subUser) return res.status(400).json({ error: 'Subscriber not found' });

    if (!subUser.subscriptions) subUser.subscriptions = [];

    if (subUser.subscriptions.includes(channel)) {
        subUser.subscriptions = subUser.subscriptions.filter(c => c !== channel);
        if (targetUser && targetUser.subscribersCount > 0) targetUser.subscribersCount--;
    } else {
        subUser.subscriptions.push(channel);
        if (targetUser) targetUser.subscribersCount = (targetUser.subscribersCount || 0) + 1;
    }

    res.json({ success: true, subscriptions: subUser.subscriptions });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});