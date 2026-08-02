const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(express.json());

// Add this route for the root path
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'ECHO backend server is running',
        endpoints: {
            health: '/api/health',
            websocket: 'wss://echo-backend-o091.onrender.com/socket.io'
        }
    });
});

// Health endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Socket.io
const authenticatedUsers = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    socket.on('join', (userId, username) => {
        if (!userId) return;
        authenticatedUsers.set(userId, { username, socketId: socket.id });
        console.log(`👤 User ${username} (${userId}) is online`);
        io.emit('online-users', Array.from(authenticatedUsers.keys()));
    });

    socket.on('chat-message', (data) => {
        io.emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        for (let [userId, info] of authenticatedUsers) {
            if (info.socketId === socket.id) {
                authenticatedUsers.delete(userId);
                console.log(`👤 User ${userId} went offline`);
                io.emit('online-users', Array.from(authenticatedUsers.keys()));
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ECHO backend server running on port ${PORT}`);
});