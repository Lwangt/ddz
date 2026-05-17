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
