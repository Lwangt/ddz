// Main Game Controller — with toast notifications and mobile support
(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // ── State ─────────────────────────────────────────────────

  const state = {
    roomCode: '',
    mySeat: -1,
    phase: 'WAITING',
    hand: [],
    players: [],
    selectedCards: new Set(),
    lastPlayedBy: -1,
    lastPlayedCards: [],
    lastPattern: null,
    passCount: 0,
    currentBid: 0,
    multiplier: 1,
    canPass: false,
    canBid: [],
    myTurn: false,
    turnTimeLeft: 0,
    turnTimeTotal: 0,
    bonusCards: [],
    playerLastActions: {},
    bidResults: [],
    currentPlayerIndex: -1,
    bg: 0,
    _buttonLayout: null,
    _toast: null,
  };

  let turnTimer = null;
  let lastTapTime = 0;       // for double-tap detection on mobile
  let lastTappedCard = -1;

  // ── Helpers ───────────────────────────────────────────────

  function getRank(id) {
    if (id === 52) return 13;
    if (id === 53) return 14;
    return id % 13;
  }

  function isMobile() { return false; }

  function showToast(text, duration) {
    state._toast = {
      text: text,
      startTime: Date.now(),
      duration: duration || 2500
    };
  }

  // ── Socket setup ──────────────────────────────────────────

  function bindSocketEvents() {
    const sm = SocketManager;

    sm.on('game_starting', onGameStarting);
    sm.on('bid_turn', onBidTurn);
    sm.on('bid_made', onBidMade);
    sm.on('landlord_determined', onLandlordDetermined);
    sm.on('your_hand_update', onYourHandUpdate);
    sm.on('redeal_message', onRedealMessage);
    sm.on('turn_start', onTurnStart);
    sm.on('cards_played', onCardsPlayed);
    sm.on('player_passed', onPlayerPassed);
    sm.on('round_won', onRoundWon);
    sm.on('game_over', onGameOver);
    sm.on('game_aborted', onGameAborted);
    sm.on('room_state', onRoomState);
    sm.on('error', onError);
    sm.on('player_disconnected', onPlayerDisconnected);
    sm.on('player_reconnected', onPlayerReconnected);
    sm.on('player_ready_next', onPlayerReadyNext);
    sm.on('player_left', onPlayerLeftGame);
    sm.on('player_joined', onPlayerJoinedInGame);
  }

  // ── Event handlers ────────────────────────────────────────

  function onGameStarting(data) {
    state.phase = data.phase;
    state.mySeat = data.yourSeat;
    state.hand = data.hand;
    state.players = data.players;
    state.roomCode = data.roomCode;
    state.bg = data.bg || 0;
    state.selectedCards = new Set();
    state.lastPlayedCards = [];
    state.lastPattern = null;
    state.playerLastActions = {};
    state.bidResults = [];
    state.multiplier = 1;
    state.canPass = false;
    state.myTurn = false;

    showWaiting(false);
    hideGameOver();
    showToast('游戏开始，准备叫地主', 2000);
    Sound.deal();
    console.log('[game] Starting. Seat:', state.mySeat, 'Hand:', state.hand.length);
  }

  function onBidTurn(data) {
    state.phase = 'BIDDING';
    state.currentBid = data.currentBid;
    state.canBid = data.canBid || [1, 2, 3];
    // Simultaneous: everyone can bid
    state.myTurn = true;
    state.bidResponses = {};

    clearTurnTimer();
    state.turnTimeTotal = data.timeout || 15;
    state.turnTimeLeft = state.turnTimeTotal;
    startTurnTimer();
    showToast('请叫地主', 1500);
  }

  function onBidMade(data) {
    state.currentBid = data.currentBid;
    Sound.bid();
    // Track bid result for display
    if (!state.bidResults) state.bidResults = [];
    state.bidResults.push({
      seatIndex: data.seatIndex,
      playerName: data.playerName,
      amount: data.amount,
      time: Date.now()
    });
  }

  function onLandlordDetermined(data) {
    state.phase = 'PLAYING';
    state.currentBid = data.currentBid;
    state.multiplier = data.multiplier;

    if (data.players) state.players = data.players;
    const landlord = state.players.find(p => p.seatIndex === data.landlordSeat);
    if (landlord) landlord.isLandlord = true;

    // Everyone sees bonus cards
    state.bonusCards = data.bonusCards || [];
    state.bidResults = [];
    state.lastPlayedCards = [];
    state.lastPattern = null;
    state.passCount = 0;

    const isMeLandlord = state.mySeat === data.landlordSeat;
    showToast(isMeLandlord ? '你是地主！' : `${data.landlordName} 是地主`, 2000);
  }

  function onYourHandUpdate(data) {
    if (data.hand) state.hand = data.hand;
  }

  function onRedealMessage(data) {
    showToast(data.message, 2000);
  }

  function onTurnStart(data) {
    state.phase = 'PLAYING';
    state.canPass = data.canPass;
    state.lastPlayedBy = data.lastPlayedBy;
    state.lastPlayedCards = data.lastPlayedCards || [];
    state.lastPattern = data.lastPattern || null;
    state.currentPlayerIndex = data.seatIndex;
    state.myTurn = (data.seatIndex === state.mySeat);
    state.selectedCards = new Set();
    if (state.myTurn) Sound.turn();

    clearTurnTimer();
    if (state.myTurn) {
      if (!state.canPass) {
        showToast('新的一轮，请出牌', 1500);
      }
      if (state.canPass) {
        state.turnTimeTotal = 20;
        state.turnTimeLeft = 20;
        startTurnTimer();
      } else {
        // Fresh round — must play, 20s to act
        state.turnTimeTotal = 20;
        state.turnTimeLeft = 20;
        startTurnTimer();
      }
    } else {
      state.turnTimeLeft = 0;
    }
  }

  function onCardsPlayed(data) {
    state.lastPlayedBy = data.seatIndex;
    state.lastPlayedCards = data.cardIds;
    state.lastPattern = data.pattern;
    state.passCount = 0;
    state.multiplier = data.multiplier || state.multiplier;

    const player = state.players.find(p => p.seatIndex === data.seatIndex);
    if (player) player.cardCount = data.remainingCards;

    // Record per-player last action
    state.playerLastActions[data.seatIndex] = {
      action: 'play',
      cardIds: data.cardIds,
      pattern: data.pattern,
    };

    // If we just played, end our turn immediately (prevent double-play bug)
    if (data.seatIndex === state.mySeat) {
      state.myTurn = false;
      state.selectedCards = new Set();
      state._prePlayHand = null; // play confirmed, clear snapshot
    }

    clearTurnTimer();

    Sound.playCard();
    if (data.pattern && (data.pattern.type === 'bomb' || data.pattern.type === 'rocket')) {
      const name = player ? player.name : '';
      const typeName = data.pattern.type === 'rocket' ? '🚀 火箭！' : '💣 炸弹！';
      showToast(`${name} 出了${typeName} 倍数×${state.multiplier}`, 2500);
      if (data.pattern.type === 'rocket') Sound.rocket();
      else Sound.bomb();
      if (window.triggerBombEffect) window.triggerBombEffect();
    }
  }

  function onPlayerPassed(data) {
    state.passCount++;
    state.playerLastActions[data.seatIndex] = { action: 'pass' };
    Sound.pass();
    // If we just passed, end our turn
    if (data.seatIndex === state.mySeat) {
      state.myTurn = false;
      state.selectedCards = new Set();
    }
    clearTurnTimer();
    const player = state.players.find(p => p.seatIndex === data.seatIndex);
    if (player) showToast(`${player.name} 不出`, 1200);
  }

  function onRoundWon(data) {
    state.lastPlayedCards = [];
    state.lastPattern = null;
    state.passCount = 0;
    state.playerLastActions = {};
  }

  function onGameOver(data) {
    state.phase = 'FINISHED';
    clearTurnTimer();
    if (data.winnerSeat === state.mySeat) {
      Sound.win();
      if (window.triggerWinEffect) window.triggerWinEffect();
    } else {
      Sound.lose();
    }
    showGameOver(data);

    if (data.scores) {
      for (const sc of data.scores) {
        const player = state.players.find(p => p.seatIndex === sc.seatIndex);
        if (player) player.score = sc.total;
      }
    }
  }

  function onGameAborted(data) {
    state.phase = 'WAITING';
    clearTurnTimer();
    showWaiting(true, data.reason || '游戏中断');
  }

  function onRoomState(data) {
    state.roomCode = data.roomCode;
    state.phase = data.state;
    state.mySeat = data.yourSeat;
    state.hand = data.hand || [];
    state.players = data.players || [];
    state.currentBid = data.currentBid || 0;
    state.multiplier = data.multiplier || 1;
    state.lastPlayedCards = data.lastPlayedCards || [];
    state.lastPattern = data.lastPattern;
    state.passCount = data.passCount || 0;
    state.currentPlayerIndex = data.currentPlayerIndex;
    state.myTurn = (data.currentPlayerIndex === state.mySeat && data.state === 'PLAYING');
    state.bonusCards = data.bonusCards || [];
    state.bg = data.bg || 0;
    state.selectedCards = new Set();

    if (state.phase === 'FINISHED') {
      showGameOver(null);
    } else if (state.phase === 'WAITING') {
      showWaiting(true, '等待玩家...');
    } else {
      showWaiting(false);
      hideGameOver();
    }
  }

  function onError(data) {
    showToast(data.message || '操作失败', 2000);
    // Restore hand from pre-play snapshot if play was rejected
    if (state._prePlayHand && data.message && data.message.includes('牌')) {
      state.hand = state._prePlayHand;
      state._prePlayHand = null;
    }
  }

  function onPlayerDisconnected(data) {
    const player = state.players.find(p => p.seatIndex === data.seatIndex);
    if (player) player.isConnected = false;
    showToast(`${data.playerName} 断开连接`, 3000);
  }

  function onPlayerReconnected(data) {
    const player = state.players.find(p => p.seatIndex === data.seatIndex);
    if (player) player.isConnected = true;
    showToast(`${data.playerName} 已重连`, 2000);
  }

  function onPlayerReadyNext(data) {
    showToast(`${data.playerName} 已准备`, 1500);
  }

  function onPlayerLeftGame(data) {
    if (state.players) state.players = data.players || [];
  }

  function onPlayerJoinedInGame(data) {
    if (state.players) {
      state.players = data.players || [];
    }
  }

  // ── Actions ───────────────────────────────────────────────

  window.onButtonClick = function (btnId) {
    if (btnId === 'play') {
      playCards();
    } else if (btnId === 'pass') {
      SocketManager.emit('pass');
      state.selectedCards = new Set();
    } else if (btnId === 'hint') {
      autoHint();
    } else if (btnId.startsWith('bid_')) {
      const amount = parseInt(btnId.split('_')[1]);
      SocketManager.emit('bid', { amount });
    }
  };

  window.onCardClick = function (index) {
    if (!state.myTurn) return;
    if (state.phase !== 'PLAYING') return;

    // Mobile: double-tap to play
    if (isMobile()) {
      const now = Date.now();
      if (index === lastTappedCard && (now - lastTapTime) < 400 && state.selectedCards.size > 0) {
        // Double tap on same card → play
        playCards();
        lastTapTime = 0;
        lastTappedCard = -1;
        return;
      }
      lastTapTime = now;
      lastTappedCard = index;
    }

    // Toggle selection
    if (state.selectedCards.has(index)) {
      state.selectedCards.delete(index);
    } else {
      state.selectedCards.add(index);
    }
  };

  function playCards() {
    if (!state.myTurn) return;
    if (state.selectedCards.size === 0) return;

    const indices = Array.from(state.selectedCards).sort((a, b) => a - b);
    const cardIds = indices.map(i => state.hand[i]);

    // Save pre-play hand snapshot for error recovery
    state._prePlayHand = [...state.hand];

    SocketManager.emit('play_cards', { cardIds });
    state.selectedCards = new Set();

    // Optimistic hand update
    const removeSet = new Set(cardIds);
    state.hand = state.hand.filter(id => !removeSet.has(id));
  }

  // ── Hint system ───────────────────────────────────────────

  function autoHint() {
    if (!state.myTurn || state.phase !== 'PLAYING') return;
    state.selectedCards = new Set();
    const groups = buildRankGroups(state.hand);

    if (!state.lastPattern) {
      hintLowestSingle(groups);
      return;
    }

    switch (state.lastPattern.type) {
      case 'single': hintBeatSingle(groups, state.lastPattern.rank); break;
      case 'pair': hintBeatPair(groups, state.lastPattern.rank); break;
      case 'triple': hintBeatTriple(groups, state.lastPattern.rank); break;
      case 'triple_plus_one': hintBeatTriplePlusOne(groups, state.lastPattern.rank); break;
      case 'triple_plus_two': hintBeatTriplePlusTwo(groups, state.lastPattern.rank); break;
      case 'straight': hintBeatStraight(groups, state.lastPattern.rank, state.lastPattern.length); break;
      case 'straight_pairs': hintBeatStraightPairs(groups, state.lastPattern.rank, state.lastPattern.length); break;
      case 'bomb': hintBeatBomb(groups, state.lastPattern.rank); break;
      case 'rocket': return;
      default: hintLowestSingle(groups); break;
    }
  }

  function buildRankGroups(hand) {
    const map = new Map();
    for (let i = 0; i < hand.length; i++) {
      const rank = getRank(hand[i]);
      if (!map.has(rank)) map.set(rank, []);
      map.get(rank).push(i);
    }
    return map;
  }

  function selectIndices(indices) {
    state.selectedCards = new Set(indices);
  }

  function hintLowestSingle(groups) {
    const sortedRanks = Array.from(groups.keys()).sort((a, b) => a - b);
    if (sortedRanks.length > 0) selectIndices([groups.get(sortedRanks[0])[0]]);
  }

  function hintBeatSingle(groups, targetRank) {
    const sortedRanks = Array.from(groups.keys()).sort((a, b) => a - b);
    for (const rank of sortedRanks) {
      if (rank > targetRank || rank === 14) {
        selectIndices([groups.get(rank)[0]]);
        return;
      }
    }
    hintBeatBomb(groups, -1);
  }

  function hintBeatPair(groups, targetRank) {
    const sortedRanks = Array.from(groups.keys()).filter(r => groups.get(r).length >= 2).sort((a, b) => a - b);
    for (const rank of sortedRanks) {
      if (rank > targetRank) {
        selectIndices(groups.get(rank).slice(0, 2));
        return;
      }
    }
    if (sortedRanks.length > 0) hintBeatBomb(groups, -1);
  }

  function hintBeatTriple(groups, targetRank) {
    const sortedRanks = Array.from(groups.keys()).filter(r => groups.get(r).length >= 3).sort((a, b) => a - b);
    for (const rank of sortedRanks) {
      if (rank > targetRank) {
        selectIndices(groups.get(rank).slice(0, 3));
        return;
      }
    }
  }

  function hintBeatTriplePlusOne(groups, targetRank) {
    hintBeatTriple(groups, targetRank);
    if (state.selectedCards.size === 0) return;
    const existingRanks = new Set();
    for (const idx of state.selectedCards) existingRanks.add(getRank(state.hand[idx]));
    for (const [rank, indices] of groups) {
      if (!existingRanks.has(rank)) {
        const newSet = new Set(state.selectedCards);
        newSet.add(indices[0]);
        selectIndices([...newSet]);
        return;
      }
    }
    state.selectedCards = new Set();
  }

  function hintBeatTriplePlusTwo(groups, targetRank) {
    hintBeatTriple(groups, targetRank);
    if (state.selectedCards.size === 0) return;
    const existingRanks = new Set();
    for (const idx of state.selectedCards) existingRanks.add(getRank(state.hand[idx]));
    for (const [rank, indices] of groups) {
      if (indices.length >= 2 && !existingRanks.has(rank)) {
        const newSet = new Set(state.selectedCards);
        newSet.add(indices[0]);
        newSet.add(indices[1]);
        selectIndices([...newSet]);
        return;
      }
    }
    state.selectedCards = new Set();
  }

  function hintBeatStraight(groups, targetRank, length) {
    const allRanks = Array.from(groups.keys()).sort((a, b) => a - b).filter(r => r <= 11);
    for (let startRank = 0; startRank <= 11 - length + 1; startRank++) {
      const neededRanks = [];
      for (let r = startRank; r < startRank + length; r++) neededRanks.push(r);
      if (neededRanks[neededRanks.length - 1] > targetRank && neededRanks.every(r => groups.has(r))) {
        const idxs = [];
        for (const r of neededRanks) idxs.push(groups.get(r)[0]);
        selectIndices(idxs);
        return;
      }
    }
  }

  function hintBeatStraightPairs(groups, targetRank, pairCount) {
    const validRanks = Array.from(groups.entries())
      .filter(([r, v]) => v.length >= 2 && r <= 11)
      .sort((a, b) => a[0] - b[0]);
    const ranks = validRanks.map(([r]) => r);
    for (let start = 0; start + pairCount <= ranks.length; start++) {
      const seg = ranks.slice(start, start + pairCount);
      if (seg[seg.length - 1] - seg[0] !== pairCount - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      const idxs = [];
      for (const r of seg) {
        idxs.push(groups.get(r)[0]);
        idxs.push(groups.get(r)[1]);
      }
      selectIndices(idxs);
      return;
    }
  }

  function hintBeatBomb(groups, targetRank) {
    if (groups.has(13) && groups.has(14)) {
      selectIndices([groups.get(13)[0], groups.get(14)[0]]);
      return;
    }
    const bombs = Array.from(groups.entries())
      .filter(([r, v]) => v.length === 4 && r > targetRank)
      .sort((a, b) => a[0] - b[0]);
    if (bombs.length > 0) selectIndices(bombs[0][1]);
  }

  // ── Timer ─────────────────────────────────────────────────

  function startTurnTimer() {
    clearTurnTimer();
    const total = state.turnTimeTotal;
    state.turnTimeLeft = total;
    const startTime = Date.now();
    turnTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      state.turnTimeLeft = Math.max(0, total - elapsed);
      if (state.turnTimeLeft <= 0) clearTurnTimer();
    }, 100);
  }

  function clearTurnTimer() {
    if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
    state.turnTimeLeft = 0;
  }

  // ── Overlays ──────────────────────────────────────────────

  function showGameOver(data) {
    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const scores = document.getElementById('gameOverScores');
    overlay.classList.remove('hidden');

    if (data) {
      const iWon = data.winnerSeat === state.mySeat;
      const isLandlord = state.players.find(p => p.seatIndex === state.mySeat)?.isLandlord;
      if (data.isLandlordWin) {
        title.textContent = isLandlord ? '🏆 地主胜利！' : '😞 农民输了';
        title.className = 'overlay-title ' + (iWon ? 'win' : 'lose');
      } else {
        title.textContent = isLandlord ? '😞 地主输了' : '🏆 农民胜利！';
        title.className = 'overlay-title ' + (iWon ? 'win' : 'lose');
      }
      scores.innerHTML = (data.scores || []).map(s => {
        const cls = s.change > 0 ? 'change-positive' : s.change < 0 ? 'change-negative' : '';
        return `<div class="score-row">
          <span>${s.name}${s.seatIndex === state.mySeat ? ' (你)' : ''}</span>
          <span class="${cls}">${s.change > 0 ? '+' : ''}${s.change} 分 (累计 ${s.total})</span>
        </div>`;
      }).join('');
      document.getElementById('readyStatus').textContent = '';
    }
    document.getElementById('readyNextBtn').onclick = () => {
      SocketManager.emit('ready_next');
      document.getElementById('readyNextBtn').disabled = true;
      document.getElementById('readyStatus').textContent = '已准备，等待其他玩家...';
    };
  }

  function hideGameOver() {
    document.getElementById('gameOverOverlay').classList.add('hidden');
    const btn = document.getElementById('readyNextBtn');
    if (btn) btn.disabled = false;
  }

  function showWaiting(show, msg) {
    const overlay = document.getElementById('waitingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
      if (msg) {
        const sp = overlay.querySelector('.waiting-msg');
        if (sp) sp.innerHTML = `<span class="waiting-spinner"></span>${msg}`;
      }
      document.getElementById('waitingRoomCode').textContent = state.roomCode || '';
    } else {
      overlay.classList.add('hidden');
    }
  }

  // ── Resize ────────────────────────────────────────────────
  // Fixed 16:9 aspect ratio, uniform scaling for all devices

  const GAME_W = 1200;
  const GAME_H = 675; // 16:9
  let gameArea = { x: 0, y: 0, w: GAME_W, h: GAME_H };

  function resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Calculate game area maintaining 16:9 aspect ratio
    const ratio = GAME_W / GAME_H;
    let gw, gh, gx, gy;

    if (cssW / cssH > ratio) {
      // Window is wider than 16:9 → letterbox left/right
      gh = cssH;
      gw = gh * ratio;
      gx = (cssW - gw) / 2;
      gy = 0;
    } else {
      // Window is taller than 16:9 → letterbox top/bottom
      gw = cssW;
      gh = gw / ratio;
      gx = 0;
      gy = (cssH - gh) / 2;
    }

    gameArea = { x: gx, y: gy, w: gw, h: gh };
    window.gameArea = gameArea; // expose for input coordinate conversion

    // Canvas fills the full window, letterboxed area rendered by CSS
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.background = '#000'; // letterbox color

    Layout.recalculate(gw, gh);
    ctx.setTransform(dpr, 0, 0, dpr, gx * dpr, gy * dpr);
  }

  // ── Orientation lock ──────────────────────────────────────

  let portraitWarned = false;
  function checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const overlay = document.getElementById('rotateOverlay');
    if (isPortrait) {
      if (overlay) overlay.classList.remove('hidden');
      portraitWarned = true;
    } else {
      if (overlay) overlay.classList.add('hidden');
      portraitWarned = false;
      const errEl = document.getElementById('rotateError');
      if (errEl) errEl.style.display = 'none';
    }
    resize();
  }

  // Rotate button — try orientation API + fullscreen
  async function requestLandscape() {
    const errEl = document.getElementById('rotateError');
    errEl.style.display = 'none';

    // Method 1: Screen Orientation API
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        return; // success
      }
    } catch (e) {
      // orientation.lock requires fullscreen on some browsers
    }

    // Method 2: Request fullscreen first, then lock
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
          return;
        }
      }
    } catch (e) {
      // fullscreen denied or not supported
    }

    // Method 3: Fullscreen API for iOS/webkit
    try {
      if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
          return;
        }
      }
    } catch (e) {}

    // All methods failed — show reason
    let reason = '无法切换横屏：';
    if (!screen.orientation || !screen.orientation.lock) {
      reason += '您的浏览器不支持屏幕方向锁定';
    } else if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
      reason += '请手动将手机横放，并确保未锁定竖屏';
    } else {
      reason += '请允许全屏权限后重试，或手动将手机横放';
    }
    errEl.textContent = reason;
    errEl.style.display = 'block';
  }

  // Bind rotate button
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('rotateBtn');
    if (btn) btn.addEventListener('click', requestLandscape);
  });
  // Also bind immediately in case DOM already loaded
  const rotateBtn = document.getElementById('rotateBtn');
  if (rotateBtn) rotateBtn.addEventListener('click', requestLandscape);

  // Try native orientation lock on start
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch(e) {}

  // ── Main loop ─────────────────────────────────────────────

  function startLoop() {
    GameRenderer.init(ctx, state);
    Animator.start(() => {
      // Draw letterbox background
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a2e0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw game area outline
      ctx.fillStyle = '#000';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const gx = gameArea.x * dpr;
      const gy = gameArea.y * dpr;
      const gw = gameArea.w * dpr;
      const gh = gameArea.h * dpr;
      ctx.fillRect(gx, gy, gw, gh);
      ctx.restore();
      // Now draw game content in the game area
      GameRenderer.draw();
    });
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 300));
  }

  // ── Init ──────────────────────────────────────────────────

  function init() {
    Sound.init();
    SocketManager.connect();

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const token = sessionStorage.getItem('ddz_token');

    if (roomCode) {
      state.roomCode = roomCode;
      SocketManager.get().emit('reconnect_room', { roomCode, token });
    }

    bindSocketEvents();
    InputHandler.init(canvas, window);
    startLoop();

    if (!roomCode) {
      showWaiting(true, '未找到房间，请从大厅进入');
    } else {
      showWaiting(true, '连接中...');
    }
  }

  window.gameState = state;
  init();
  console.log('[game] Controller initialized');
})();
