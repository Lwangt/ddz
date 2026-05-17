// Socket.IO client singleton — subpath-aware
const SocketManager = (() => {
  let socket = null;
  const handlers = {};

  function getBasePath() {
    const path = window.location.pathname;
    // Detect if we're under a subpath like /ddz/
    const match = path.match(/^(\/[^/]+\/)/);
    if (match && match[1] !== '/') {
      return match[1]; // e.g., "/ddz/"
    }
    return '/';
  }

  function connect() {
    if (socket && socket.connected) return socket;

    const basePath = getBasePath();
    const opts = {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    };

    // If under a subpath, configure Socket.IO path
    if (basePath !== '/') {
      opts.path = basePath + 'socket.io';
    }

    socket = io(window.location.origin, opts);

    socket.on('connect', () => {
      console.log('[socket] connected:', socket.id, 'path:', opts.path || '/socket.io');
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get('room');
      if (roomCode) {
        socket.emit('reconnect_room', { roomCode, token: sessionStorage.getItem('ddz_token') });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] connect error:', err.message);
    });

    for (const [event, callbacks] of Object.entries(handlers)) {
      for (const cb of callbacks) {
        socket.on(event, cb);
      }
    }

    return socket;
  }

  function get() {
    if (!socket || !socket.connected) {
      return connect();
    }
    return socket;
  }

  function on(event, callback) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(callback);
    if (socket) {
      socket.on(event, callback);
    }
  }

  function off(event, callback) {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter(cb => cb !== callback);
    if (socket) {
      socket.off(event, callback);
    }
  }

  function emit(event, data) {
    const s = get();
    s.emit(event, data);
  }

  return { connect, get, on, off, emit };
})();
