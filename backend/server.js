const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,  // ping every 10s
  pingTimeout: 5000,    // timeout after 5s
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'ECHO backend running' });
});

const authenticatedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  // Send current online list to the newly connected client
  socket.emit('online-users', Array.from(authenticatedUsers.keys()));

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
    let removed = false;
    for (let [userId, info] of authenticatedUsers) {
      if (info.socketId === socket.id) {
        authenticatedUsers.delete(userId);
        console.log(`👤 User ${userId} went offline`);
        io.emit('online-users', Array.from(authenticatedUsers.keys()));
        removed = true;
        break;
      }
    }
    if (!removed) {
      console.log('🔴 Socket disconnected (no user found):', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ECHO backend running on port ${PORT}`);
});