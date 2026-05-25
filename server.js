const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./server/gameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 5000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000,
  },
});

const fs = require('fs');

// Diagnostic: list image files on server
app.get('/diag/images', (req, res) => {
  const imgDir = path.join(__dirname, 'public', 'image');
  const result = { base: imgDir, exists: fs.existsSync(imgDir), dirs: {} };
  try {
    for (const entry of fs.readdirSync(imgDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        result.dirs[entry.name] = fs.readdirSync(path.join(imgDir, entry.name)).map(f => ({
          name: f, size: fs.statSync(path.join(imgDir, entry.name, f)).size
        }));
      }
    }
  } catch(e) { result.error = e.message; }
  res.json(result);
});

// Static files — handles Range requests, conditional GETs, caching natively
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('create_room', (data) => gameManager.createRoom(socket, data));
  socket.on('join_room', (data) => gameManager.joinRoom(socket, data));
  socket.on('leave_room', () => gameManager.leaveRoom(socket));
  socket.on('start_game', () => gameManager.startGame(socket));
  socket.on('bid', (data) => gameManager.processBid(socket, data));
  socket.on('play_cards', (data) => gameManager.processPlay(socket, data));
  socket.on('pass', () => gameManager.processPass(socket));
  socket.on('ready_next', () => gameManager.readyForNext(socket));
  socket.on('reconnect_room', (data) => {
    gameManager.handleReconnect(socket, data || {});
  });
  socket.on('disconnect', () => gameManager.handleDisconnect(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`斗地主服务器已启动: http://localhost:${PORT}`);
});
