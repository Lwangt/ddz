// Lobby page controller
(function () {
  const nameInput = document.getElementById('nameInput');
  const createBtn = document.getElementById('createBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const joinBtn = document.getElementById('joinBtn');
  const statusMsg = document.getElementById('statusMsg');
  const loginPanel = document.getElementById('loginPanel');
  const roomPanel = document.getElementById('roomPanel');
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const roomLink = document.getElementById('roomLink');
  const copyBtn = document.getElementById('copyBtn');
  const playerList = document.getElementById('playerList');
  const startGameBtn = document.getElementById('startGameBtn');
  const roomStatusMsg = document.getElementById('roomStatusMsg');

  let myName = '';
  let myRoomCode = '';
  let mySeat = -1;
  let playersInRoom = [];
  let testMode = false;

  function showStatus(msg, isSuccess) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status-msg' + (isSuccess ? ' success' : '');
  }

  function showRoomStatus(msg, isSuccess) {
    roomStatusMsg.textContent = msg;
    roomStatusMsg.className = 'status-msg' + (isSuccess ? ' success' : '');
  }

  function validateName() {
    const name = nameInput.value.trim();
    if (!name) {
      showStatus('请输入昵称');
      return null;
    }
    return name;
  }

  function getBaseHref() {
    const path = window.location.pathname;
    const match = path.match(/^(\/[^/]+\/)/);
    return (match && match[1] !== '/') ? match[1] : '/';
  }

  function generateShareLink(code) {
    // Share lobby URL with room code pre-filled
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    // Strip trailing filename if any
    const dir = pathname.endsWith('.html') ? pathname.substring(0, pathname.lastIndexOf('/') + 1) : pathname;
    return `${origin}${dir}?room=${code}`;
  }

  function renderPlayerSlots() {
    playerList.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const player = playersInRoom.find(p => p.seatIndex === i);
      const slot = document.createElement('div');
      slot.className = 'player-slot' + (player ? ' filled' : '') + (player && player.isBot ? ' bot' : '');

      const badge = document.createElement('div');
      badge.className = 'seat-badge';
      badge.textContent = i + 1;

      const nameEl = document.createElement('div');
      nameEl.className = 'player-name';
      if (player) {
        let nameDisplay = player.name;
        if (player.seatIndex === mySeat) nameDisplay += ' (你)';
        if (player.isBot) nameDisplay += ' 🤖';
        nameEl.textContent = nameDisplay;
      } else {
        nameEl.innerHTML = '<span class="waiting-text">等待加入...</span>';
      }

      slot.appendChild(badge);
      slot.appendChild(nameEl);
      playerList.appendChild(slot);
    }

    // Enable start if 3 players OR test mode with at least 1 player
    const canStart = playersInRoom.length >= 3 || (testMode && playersInRoom.length >= 1);
    startGameBtn.disabled = !canStart;
    if (testMode && playersInRoom.length < 3) {
      startGameBtn.textContent = `开始游戏 (AI填充 ${playersInRoom.length}/3)`;
    } else if (playersInRoom.length >= 3) {
      startGameBtn.textContent = '开始游戏';
    } else {
      startGameBtn.textContent = `等待玩家加入... (${playersInRoom.length}/3)`;
    }
  }

  function showRoom(data) {
    myRoomCode = data.roomCode;
    mySeat = data.yourSeat;
    playersInRoom = data.players;

    // Store token for reconnection after page navigation
    if (data.playerToken) {
      sessionStorage.setItem('ddz_token', data.playerToken);
    }

    loginPanel.classList.add('hidden');
    roomPanel.classList.remove('hidden');

    roomCodeDisplay.textContent = myRoomCode;
    if (testMode) {
      roomCodeDisplay.innerHTML = myRoomCode + ' <span class="test-mode-indicator">🤖 测试</span>';
    }
    const link = generateShareLink(myRoomCode);
    roomLink.innerHTML = '分享链接：<br><a style="color:#ffd54f;word-break:break-all" href="' + link + '">' + link + '</a>';
    renderPlayerSlots();

    // Add room code to URL for the game page
    const gameUrl = generateShareLink(myRoomCode);

    // Listen for more players
    SocketManager.on('player_joined', onPlayerJoined);
    SocketManager.on('player_left', onPlayerLeft);
    SocketManager.on('game_starting', onGameStarting);
    SocketManager.on('error', onRoomError);
  }

  function onPlayerJoined(data) {
    playersInRoom = data.players;
    renderPlayerSlots();
    showRoomStatus(`${data.playerName} 加入了房间`, true);
  }

  function onPlayerLeft(data) {
    playersInRoom = data.players;
    renderPlayerSlots();
    showRoomStatus(`${data.playerName} 离开了房间`, false);
  }

  function onRoomError(data) {
    showRoomStatus(data.message, false);
  }

  function onGameStarting(data) {
    // Navigate to game page with room code (subpath-aware)
    const baseHref = getBaseHref();
    window.location.href = (baseHref !== '/' ? baseHref : '/') + `game.html?room=${myRoomCode}`;
  }

  // ── Set up one-time response handlers ────────────────────

  let joinConfirmHandler = null;
  let joinErrorHandler = null;

  function setupJoinHandlers() {
    // Remove previous handlers if any
    if (joinConfirmHandler) SocketManager.off('join_confirmed', joinConfirmHandler);
    if (joinErrorHandler) SocketManager.off('error', joinErrorHandler);

    joinConfirmHandler = (data) => {
      showRoom(data);
    };
    joinErrorHandler = (data) => {
      showStatus(data.message, false);
    };

    SocketManager.on('join_confirmed', joinConfirmHandler);
    SocketManager.on('error', joinErrorHandler);
  }

  // ── Room creator event handlers (registered once) ─────────

  SocketManager.on('room_created', showRoom);

  // Create room
  createBtn.addEventListener('click', () => {
    const name = validateName();
    if (!name) return;
    myName = name;
    SocketManager.connect();
    setupJoinHandlers();
    SocketManager.emit('create_room', { playerName: name, testMode });
    showStatus('正在创建房间...', true);
  });

  // Join room
  joinBtn.addEventListener('click', () => {
    const name = validateName();
    if (!name) return;
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      showStatus('请输入房间号');
      return;
    }
    myName = name;
    SocketManager.connect();
    setupJoinHandlers();
    SocketManager.emit('join_room', { roomCode: code, playerName: name });
    showStatus('正在加入房间...', true);
  });

  // Copy link
  copyBtn.addEventListener('click', () => {
    const link = generateShareLink(myRoomCode);
    const text = `来玩斗地主！房间号：${myRoomCode}\n${link}`;
    // Try modern API first, fallback to execCommand for HTTP
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(copySuccess).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); copySuccess(); } catch(e) { copyBtn.textContent = '复制失败'; }
      document.body.removeChild(ta);
    }
    function copySuccess() {
      copyBtn.textContent = '已复制!';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = '复制链接'; copyBtn.classList.remove('copied'); }, 2000);
    }
  });

  // Start game
  startGameBtn.addEventListener('click', () => {
    if (!testMode && playersInRoom.length < 3) return;
    if (playersInRoom.length < 1) return;
    SocketManager.emit('start_game');
  });

  // Enter key submits
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });
  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });

  // Check URL for pre-filled room code
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    roomCodeInput.value = roomParam.toUpperCase();
  }

  // ── Test mode toggle ─────────────────────────────────────

  const testToggle = document.getElementById('testModeToggle');

  testToggle.addEventListener('click', () => {
    testMode = !testMode;
    if (testMode) {
      testToggle.classList.add('active');
      testToggle.querySelector('.test-mode-label').textContent = '测试中';
      // If in room panel, update button state
      if (!roomPanel.classList.contains('hidden')) {
        renderPlayerSlots();
        showRoomStatus('测试模式已开启：单人即可开始，剩余席位由AI填充', true);
      }
    } else {
      testToggle.classList.remove('active');
      testToggle.querySelector('.test-mode-label').textContent = '测试';
      if (!roomPanel.classList.contains('hidden')) {
        renderPlayerSlots();
        showRoomStatus('测试模式已关闭');
      }
    }
  });

  // Socket.IO error handling
  SocketManager.on('connect_error', () => {
    showRoomStatus('连接服务器失败，请检查网络', false);
    showStatus('连接服务器失败，请检查网络', false);
  });
  SocketManager.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' || reason === 'transport close') {
      showRoomStatus('与服务器断开连接，请刷新页面', false);
    }
  });

  // Connect socket on load
  SocketManager.connect();
})();
