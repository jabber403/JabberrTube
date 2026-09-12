const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for memory storage so we can convert files to base64 data URLs
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-memory data store (persists as long as server runs, safe for single Render instances)
let users = {}; // username -> { password, bio, avatarUrl, bannerUrl, subscriptions: [] }
let videos = []; // array of video objects

// Helper to convert buffer to data URL
function bufferToDataUrl(file) {
    if (!file) return null;
    const b64 = file.buffer.toString('base64');
    return `data:${file.mimetype};base64,${b64}`;
}

// --- API ROUTES ---

// Signup
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    if (users[username]) return res.status(400).json({ error: 'Username already taken.' });

    users[username] = {
        password,
        bio: 'Welcome to my JabberrTube channel!',
        avatarUrl: null,
        bannerUrl: null,
        subscriptions: []
    };
    res.json({ success: true });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ error: 'Invalid username or password.' });
    }
    res.json({ success: true, username });
});

// Get User Profile details
app.get('/api/user/:username', (req, res) => {
    const username = req.params.username;
    const user = users[username] || { 
        bio: 'No bio provided.', 
        avatarUrl: null, 
        bannerUrl: null, 
        subscriptions: [] 
    };

    // Calculate subscribers count based on how many users follow this account
    let subscribersCount = 0;
    Object.values(users).forEach(u => {
        if (u.subscriptions && u.subscriptions.includes(username)) {
            subscribersCount++;
        }
    });

    res.json({
        username,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        subscribersCount,
        subscriptions: user.subscriptions || []
    });
});

// Update User Profile (Bio, Avatar, Banner)
app.post('/api/user/profile', upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]), (req, res) => {
    const { username, bio } = req.body;
    if (!users[username]) return res.status(400).json({ error: 'User not found.' });

    if (bio !== undefined) users[username].bio = bio;

    if (req.files) {
        if (req.files['avatar']) {
            users[username].avatarUrl = bufferToDataUrl(req.files['avatar'][0]);
        }
        if (req.files['banner']) {
            users[username].bannerUrl = bufferToDataUrl(req.files['banner'][0]);
        }
    }

    res.json({ success: true, user: users[username] });
});

// Subscribe / Unsubscribe toggle
app.post('/api/subscribe', (req, res) => {
    const { subscriber, channel } = req.body;
    if (!users[subscriber]) return res.status(400).json({ error: 'User not found' });

    if (!users[subscriber].subscriptions) {
        users[subscriber].subscriptions = [];
    }

    const idx = users[subscriber].subscriptions.indexOf(channel);
    if (idx > -1) {
        users[subscriber].subscriptions.splice(idx, 1);
    } else {
        users[subscriber].subscriptions.push(channel);
    }

    res.json({ success: true, subscriptions: users[subscriber].subscriptions });
});

// Get all videos
app.get('/api/videos', (req, res) => {
    res.json(videos);
});

// Upload Video (with optional custom thumbnail file)
app.post('/api/upload', upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
]), (req, res) => {
    const { title, description, hashtags, uploader } = req.body;
    const videoFile = req.files && req.files['videoFile'] ? req.files['videoFile'][0] : null;
    const thumbnailFile = req.files && req.files['thumbnailFile'] ? req.files['thumbnailFile'][0] : null;

    if (!videoFile) return res.status(400).json({ error: 'Video file is required.' });

    const newVideo = {
        id: Date.now(),
        title: title || 'Untitled',
        description: description || '',
        hashtags: hashtags || '',
        uploader: uploader || 'Anonymous',
        videoUrl: bufferToDataUrl(videoFile),
        thumbnailUrl: bufferToDataUrl(thumbnailFile), // Custom thumbnail or null (will fallback to video frame)
        likes: [],
        dislikes: [],
        comments: []
    };

    videos.unshift(newVideo);
    res.json({ success: true, video: newVideo });
});

// Video Likes / Dislikes
app.post('/api/like', (req, res) => handleReaction(req, res, 'likes', 'dislikes'));
app.post('/api/dislike', (req, res) => handleReaction(req, res, 'dislikes', 'likes'));

function handleReaction(req, res, targetField, oppField) {
    const { videoId, username } = req.body;
    const video = videos.find(v => v.id === Number(videoId));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const targetArr = video[targetField];
    const oppArr = video[oppField];

    const oppIdx = oppArr.indexOf(username);
    if (oppIdx > -1) oppArr.splice(oppIdx, 1);

    const targetIdx = targetArr.indexOf(username);
    if (targetIdx > -1) {
        targetArr.splice(targetIdx, 1);
    } else {
        targetArr.push(username);
    }

    res.json({ success: true, video });
}

// Comments & Replies
app.post('/api/comment', (req, res) => {
    const { videoId, username, text } = req.body;
    const video = videos.find(v => v.id === Number(videoId));
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

app.post('/api/comment/reply', (req, res) => {
    const { videoId, commentId, username, text } = req.body;
    const video = videos.find(v => v.id === Number(videoId));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const comment = video.comments.find(c => c.id === Number(commentId));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const newReply = {
        id: Date.now(),
        username,
        text,
        likes: [],
        dislikes: []
    };

    comment.replies.push(newReply);
    res.json({ success: true, video });
});

app.post('/api/comment/react', (req, res) => {
    const { videoId, commentId, replyId, username, type } = req.body;
    const video = videos.find(v => v.id === Number(videoId));
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const comment = video.comments.find(c => c.id === Number(commentId));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    let targetItem = comment;
    if (replyId) {
        targetItem = comment.replies.find(r => r.id === Number(replyId));
        if (!targetItem) return res.status(404).json({ error: 'Reply not found' });
    }

    const tField = type === 'like' ? 'likes' : 'dislikes';
    const oField = type === 'like' ? 'dislikes' : 'likes';

    const oIdx = targetItem[oField].indexOf(username);
    if (oIdx > -1) targetItem[oField].splice(oIdx, 1);

    const tIdx = targetItem[tField].indexOf(username);
    if (tIdx > -1) {
        targetItem[tField].splice(tIdx, 1);
    } else {
        targetItem[tField].push(username);
    }

    res.json({ success: true, video });
});

// Serve frontend page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`JabberrTube server running on port ${PORT}`);
});