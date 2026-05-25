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

// Diagnostic: list image files on server (accessible at /ddz/diag/images)
app.get('/diag/images', (req, res) => {
  const imgDir = path.join(__dirname, 'public', 'image');
  const result = { base: imgDir, exists: fs.existsSync(imgDir), dirs: {} };
  try {
    const entries = fs.readdirSync(imgDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(imgDir, entry.name);
        const files = fs.readdirSync(subPath);
        result.dirs[entry.name] = files.map(f => {
          const fp = path.join(subPath, f);
          const stat = fs.statSync(fp);
          return { name: f, size: stat.size, readable: true };
        });
      }
    }
  } catch(e) { result.error = e.message; }
  res.json(result);
});

// Dedicated image serving route — bypasses nginx static file quirks
app.get('/img/bg/:id', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'image', 'bg', `bg${req.params.id}.png`);
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: 'not found', path: filePath });
  });
});
app.get('/img/role/:id', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'image', 'role', `角色${req.params.id}.png`);
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: 'not found', path: filePath, id: req.params.id });
  });
});

app.use(express.static(path.join(__dirname, 'public')));

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
