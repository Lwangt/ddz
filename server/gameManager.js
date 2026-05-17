const C = require('./config');
const Room = require('./room');

class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();           // roomCode → Room
    this.socketToRoom = new Map();    // socketId → roomCode
    this.reconnectTimers = new Map(); // socketId → timeout
  }

  // ── Room lifecycle ────────────────────────────────────────

  createRoom(socket, { playerName, testMode }) {
    if (!playerName || !playerName.trim()) {
      socket.emit('error', { message: '请输入昵称' });
      return;
    }

    // Remove from any existing room first
    this.leaveRoom(socket);

    const code = this.generateRoomCode();
    const room = new Room(code, this.io);
    if (testMode) {
      room.testMode = true;
    }
    const player = room.addPlayer(socket.id, playerName.trim());

    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);
    socket.join(`room:${code}`);

    socket.emit('room_created', {
      roomCode: code,
      players: room.players.map(p => p.toPublicJSON()),
      yourSeat: player.seatIndex,
      playerToken: player.token,
    });

    console.log(`[room] ${code} created by ${playerName} (${socket.id})`);
  }

  joinRoom(socket, { roomCode, playerName }) {
    if (!playerName || !playerName.trim()) {
      socket.emit('error', { message: '请输入昵称' });
      return;
    }

    const code = (roomCode || '').toUpperCase().trim();
    if (!code) {
      socket.emit('error', { message: '请输入房间号' });
      return;
    }

    const room = this.rooms.get(code);
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }

    if (room.isFull()) {
      socket.emit('error', { message: '房间已满' });
      return;
    }

    if (room.state !== C.PHASE_WAITING) {
      socket.emit('error', { message: '游戏已开始，无法加入' });
      return;
    }

    // Remove from any existing room
    this.leaveRoom(socket);

    const player = room.addPlayer(socket.id, playerName.trim());
    if (!player) {
      socket.emit('error', { message: '加入房间失败' });
      return;
    }

    this.socketToRoom.set(socket.id, code);
    socket.join(`room:${code}`);

    // Notify everyone in room
    room.toRoom('player_joined', {
      playerId: player.id,
      playerName: player.name,
      seatIndex: player.seatIndex,
      players: room.players.map(p => p.toPublicJSON()),
    });

    // Confirm to joiner
    socket.emit('join_confirmed', {
      roomCode: code,
      yourSeat: player.seatIndex,
      playerToken: player.token,
      players: room.players.map(p => p.toPublicJSON()),
    });

    console.log(`[room] ${code}: ${playerName} (${socket.id}) joined, ${room.players.length}/3`);
  }

  leaveRoom(socket) {
    const roomCode = this.socketToRoom.get(socket.id);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.removePlayer(socket.id);
    this.socketToRoom.delete(socket.id);
    socket.leave(`room:${roomCode}`);

    if (player) {
      room.clearTimers();
      room.toRoom('player_left', {
        playerId: player.id,
        playerName: player.name,
        seatIndex: player.seatIndex,
        players: room.players.map(p => p.toPublicJSON()),
      });
    }

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      console.log(`[room] ${roomCode} destroyed (empty)`);
    }

    console.log(`[room] ${roomCode}: ${player?.name} left`);
  }

  // ── Reconnection ──────────────────────────────────────────

  handleDisconnect(socket) {
    const roomCode = this.socketToRoom.get(socket.id);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.getPlayer(socket.id);
    if (!player) return;

    player.isConnected = false;
    room.toRoom('player_disconnected', {
      seatIndex: player.seatIndex,
      playerName: player.name,
    });

    console.log(`[dc] ${player.name} disconnected from ${roomCode}`);

    // Start grace timer
    const timer = setTimeout(() => {
      this.handleReconnectTimeout(socket.id, roomCode);
    }, C.RECONNECT_GRACE);

    this.reconnectTimers.set(socket.id, timer);
  }

  handleReconnect(socket, data) {
    if (!data || !data.roomCode) return false;
    const { roomCode, token } = data;

    // Clear grace timer
    const timer = this.reconnectTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(socket.id);
    }

    const room = this.rooms.get(roomCode);
    if (!room) return false;

    // Find player by token (stable across page reloads)
    let player = null;
    if (token) {
      player = room.players.find(p => p.token === token);
    }
    // Fallback: find by old socket id
    if (!player) {
      player = room.players.find(p => p.id === socket.id);
    }
    if (!player) return false;

    // Update socket ID and room mapping
    const oldId = player.id;
    player.id = socket.id;
    this.socketToRoom.set(socket.id, roomCode);
    socket.join(`room:${roomCode}`);

    player.isConnected = true;
    room.toRoom('player_reconnected', {
      seatIndex: player.seatIndex,
      playerName: player.name,
    });

    // Send full state
    socket.emit('room_state', room.toStateJSON(socket.id));

    console.log(`[rc] ${player.name} reconnected to ${roomCode}`);
    return true;
  }

  handleReconnectTimeout(socketId, roomCode) {
    this.reconnectTimers.delete(socketId);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.getPlayer(socketId);
    if (!player) return;

    // If they already reconnected, ignore
    if (player.isConnected) return;

    console.log(`[dc] ${player.name} forfeited (timeout)`);

    // During game: remove player, game aborts
    room.leaveRoom(socketId);
    if (room.players.length < 2) {
      room.toRoom('game_aborted', {
        reason: `${player.name} 断开连接，游戏结束`,
      });
      room.clearTimers();
      room.state = C.PHASE_WAITING;
    }
  }

  // ── Game actions ──────────────────────────────────────────

  startGame(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;
    room.startGame();
  }

  processBid(socket, { amount }) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;
    room.processBid(socket.id, amount);
  }

  processPlay(socket, { cardIds }) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;
    room.processPlay(socket.id, cardIds);
  }

  processPass(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;
    room.processPass(socket.id);
  }

  readyForNext(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;
    room.readyForNext(socket.id);
  }

  // ── Utility ───────────────────────────────────────────────

  getRoomBySocket(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  generateRoomCode() {
    const chars = C.ROOM_CODE_CHARS;
    let code = '';
    for (let i = 0; i < C.ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Avoid duplicates
    if (this.rooms.has(code)) return this.generateRoomCode();
    return code;
  }
}

module.exports = GameManager;
