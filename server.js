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

// Diagnostic: list image files + test-read first 100 bytes
app.get('/diag/images', (req, res) => {
  const imgDir = path.join(__dirname, 'public', 'image');
  const result = { base: imgDir, cwd: process.cwd(), staticRoot: path.join(__dirname, 'public') };
  try {
    for (const entry of fs.readdirSync(imgDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        result[entry.name] = fs.readdirSync(path.join(imgDir, entry.name)).map(f => {
          const fp = path.join(imgDir, entry.name, f);
          const stat = fs.statSync(fp);
          // Test read first 100 bytes
          let firstBytes = null;
          try {
            const fd = fs.openSync(fp, 'r');
            const buf = Buffer.alloc(100);
            fs.readSync(fd, buf, 0, 100, 0);
            fs.closeSync(fd);
            firstBytes = buf.toString('hex');
          } catch(e) { firstBytes = 'READ_ERR:' + e.message; }
          return { name: f, size: stat.size, hex: firstBytes };
        });
      }
    }
  } catch(e) { result.error = e.message; }
  res.json(result);
});

// Tiny 1x1 PNG for nginx binary proxy test
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
app.get('/diag/tinypng', (req, res) => {
  res.set({ 'Content-Type': 'image/png', 'Content-Length': TINY_PNG.length });
  res.send(TINY_PNG);
});

// Static files — nginx buffering disabled for large images
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', '*');
    // Tell nginx NOT to buffer large files (fixes mobile image loading)
    if (filePath && /\.(png|jpg|jpeg|gif|webp)$/i.test(filePath)) {
      res.set('X-Accel-Buffering', 'no');
    }
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
