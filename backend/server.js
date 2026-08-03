const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    perMessageDeflate: true,
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'ECHO backend running' });
});
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ------------------------------------------------
// Redis adapter – optional (only if REDIS_URL set)
// ------------------------------------------------
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: REDIS_URL });
        const subClient = pubClient.duplicate();
        (async () => {
            try {
                await pubClient.connect();
                await subClient.connect();
                console.log('✅ Redis connected');
                io.adapter(createAdapter(pubClient, subClient));
                console.log('✅ Socket.io Redis adapter attached');
            } catch (err) {
                console.error('❌ Redis connection failed:', err.message);
                console.log('⚠️  Socket.io running without Redis (single-instance mode)');
            }
        })();
    } catch (err) {
        console.error('❌ Failed to load Redis adapter:', err.message);
        console.log('⚠️  Socket.io running without Redis (single-instance mode)');
    }
} else {
    console.log('ℹ️  REDIS_URL not set – using in‑memory Socket.io (single-instance)');
}

// ------------------------------------------------
// Socket.io – only real‑time messaging/typing events
// ------------------------------------------------
io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // Typing event (placeholder)
    socket.on('typing', ({ chatId, userId, username }) => {
        socket.broadcast.emit('typing', { chatId, userId, username });
    });

    // Chat message (optional – you already use Firebase for history)
    socket.on('chat-message', (data) => {
        io.emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Socket disconnected:', socket.id);
    });
});

// ------------------------------------------------
// Start server
// ------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 ECHO backend running on port ${PORT}`);
});