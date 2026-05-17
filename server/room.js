const C = require('./config');
const Player = require('./player');
const { createDeck, shuffleDeck, dealCards } = require('./card');
const { validatePlay } = require('./patterns');
const BotStrategy = require('./bot');

class Room {
  constructor(code, io) {
    this.code = code;
    this.io = io;
    this.players = [];
    this.testMode = false;
    this.state = C.PHASE_WAITING;

    // Bidding state
    this.bidStartIndex = 0;
    this.bidQueue = [];          // [seatIndex, seatIndex, seatIndex] order to bid
    this.bidPointer = 0;         // index into bidQueue
    this.currentBid = 0;
    this.highestBidderIndex = -1;

    // Playing state
    this.currentPlayerIndex = 0;
    this.lastPlayedBy = -1;
    this.lastPlayedCards = [];
    this.lastPattern = null;
    this.passCount = 0;
    this.multiplier = 1;
    this.roundCount = 0;

    // Deck
    this.bonusCards = [];

    // Timers
    this.turnTimer = null;
    this.bidTimer = null;
  }

  // ── Broadcasting ──────────────────────────────────────────

  toRoom(event, data) {
    this.io.to(`room:${this.code}`).emit(event, data);
  }

  toPlayer(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  // ── Room management ───────────────────────────────────────

  addPlayer(socketId, name) {
    if (this.players.length >= C.MAX_PLAYERS) return null;
    if (this.players.find(p => p.id === socketId)) return null;

    const seatIndex = this.players.length;
    const player = new Player(socketId, name, seatIndex);
    this.players.push(player);
    return player;
  }

  addBotPlayer(name) {
    if (this.players.length >= C.MAX_PLAYERS) return null;
    const botId = 'bot_' + Date.now() + '_' + this.players.length;
    const seatIndex = this.players.length;
    const player = new Player(botId, name, seatIndex, true);
    player.botStrategy = new BotStrategy(player);
    this.players.push(player);
    return player;
  }

  fillWithBots() {
    const botNames = ['🤖 机器人A', '🤖 机器人B'];
    let idx = 0;
    while (this.players.length < C.MAX_PLAYERS) {
      this.addBotPlayer(botNames[idx] || ('🤖 机器人' + (idx + 1)));
      idx++;
    }
  }

  getBotPlayer() {
    return this.players.find(p => p.isBot);
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx === -1) return null;
    const [removed] = this.players.splice(idx, 1);
    // Re-index remaining players
    this.players.forEach((p, i) => { p.seatIndex = i; });
    return removed;
  }

  getPlayer(socketId) {
    return this.players.find(p => p.id === socketId);
  }

  getPlayerBySeat(seat) {
    return this.players.find(p => p.seatIndex === seat);
  }

  isFull() {
    return this.players.length >= C.MAX_PLAYERS;
  }

  allConnected() {
    return this.players.every(p => p.isConnected);
  }

  clearTimers() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.bidTimer)  { clearTimeout(this.bidTimer);  this.bidTimer = null; }
  }

  // ── State machine ─────────────────────────────────────────

  startGame() {
    if (this.state !== C.PHASE_WAITING) return false;

    // In test mode, fill remaining slots with bots
    if (this.testMode && this.players.length < C.MIN_PLAYERS) {
      this.fillWithBots();
    }

    if (this.players.length < C.MIN_PLAYERS) return false;
    if (!this.allConnected()) {
      // Bots are always connected, check only human players
      const humans = this.players.filter(p => !p.isBot);
      if (!humans.every(p => p.isConnected)) return false;
    }

    this.state = C.PHASE_DEALING;

    // Reset per-game state
    this.players.forEach(p => p.reset());
    // Re-create bot strategies with fresh references
    for (const p of this.players) {
      if (p.isBot) p.botStrategy = new BotStrategy(p);
    }
    this.lastPlayedCards = [];
    this.lastPattern = null;
    this.lastPlayedBy = -1;
    this.passCount = 0;
    this.multiplier = 1;
    this.roundCount = 0;

    // Shuffle and deal
    const deck = shuffleDeck(createDeck());
    const { hands, bonus } = dealCards(deck);
    this.bonusCards = bonus;

    for (let i = 0; i < this.players.length; i++) {
      this.players[i].hand = hands[i];
      this.players[i].sortHand();
    }

    // Notify human players of their hand (bots don't need socket messages)
    for (const p of this.players) {
      if (p.isBot) continue;
      this.toPlayer(p.id, 'game_starting', {
        yourSeat: p.seatIndex,
        players: this.players.map(pl => pl.toPublicJSON()),
        hand: p.toPrivateJSON().hand,
        phase: C.PHASE_DEALING,
        roomCode: this.code,
      });
    }

    // Brief delay to show deal animation, then start bidding
    setTimeout(() => this.startBidding(), 1500);
    return true;
  }

  // ── Bidding ───────────────────────────────────────────────

  startBidding() {
    this.state = C.PHASE_BIDDING;
    this.bidStartIndex = Math.floor(Math.random() * 3);
    this.bidQueue = [
      this.bidStartIndex,
      (this.bidStartIndex + 1) % 3,
      (this.bidStartIndex + 2) % 3,
    ];
    this.bidPointer = 0;
    this.currentBid = 0;
    this.highestBidderIndex = -1;

    // Reset bid amounts
    this.players.forEach(p => { p.bidAmount = 0; });

    this.sendBidTurn();
  }

  sendBidTurn() {
    if (this.bidPointer >= this.bidQueue.length) {
      this.finishBidding();
      return;
    }

    const seatIndex = this.bidQueue[this.bidPointer];
    const player = this.getPlayerBySeat(seatIndex);
    if (!player || (!player.isBot && !player.isConnected)) {
      // Auto-pass for disconnected human player
      this.processBid(player ? player.id : null, 0);
      return;
    }

    const canBid = [];
    for (let i = this.currentBid + 1; i <= C.BID_MAX; i++) {
      canBid.push(i);
    }

    this.toRoom('bid_turn', {
      seatIndex,
      playerName: player.name,
      currentBid: this.currentBid,
      bidRound: this.bidPointer,
      canBid,
      canPass: !(this.currentBid === 0 && this.bidPointer === 2),
    });

    // Bot: auto-decide after a delay
    if (player.isBot && player.botStrategy) {
      this.clearBidTimer();
      const delay = 800 + Math.random() * 1200;
      this.bidTimer = setTimeout(() => {
        const bidAmount = player.botStrategy.decideBid(this.currentBid);
        this.processBid(player.id, bidAmount);
      }, delay);
      return;
    }

    // Human: auto-pass timeout
    this.clearBidTimer();
    this.bidTimer = setTimeout(() => {
      this.processBid(player.id, 0);
    }, C.BID_TIMEOUT);
  }

  clearBidTimer() {
    if (this.bidTimer) { clearTimeout(this.bidTimer); this.bidTimer = null; }
  }

  processBid(socketId, amount) {
    if (this.state !== C.PHASE_BIDDING) return;
    if (this.bidPointer >= this.bidQueue.length) return;

    const expectedSeat = this.bidQueue[this.bidPointer];
    const player = this.players.find(p => p.seatIndex === expectedSeat);
    if (!player) return;
    if (socketId && player.id !== socketId) return; // not your turn

    this.clearBidTimer();

    amount = parseInt(amount) || 0;

    if (amount === 0) {
      // Pass
      player.bidAmount = 0;
    } else {
      // Validate bid
      if (amount <= this.currentBid || amount > C.BID_MAX) {
        this.toPlayer(socketId, 'error', { message: `叫分必须大于 ${this.currentBid} 且不超过 ${C.BID_MAX}` });
        this.sendBidTurn(); // let them retry
        return;
      }
      amount = Math.min(amount, C.BID_MAX);
      player.bidAmount = amount;
      this.currentBid = amount;
      this.highestBidderIndex = player.seatIndex;

      // If someone bids 3, they win immediately
      if (amount === C.BID_MAX) {
        this.bidPointer = this.bidQueue.length; // skip remaining
      }
    }

    this.toRoom('bid_made', {
      seatIndex: player.seatIndex,
      playerName: player.name,
      amount: player.bidAmount,
      currentBid: this.currentBid,
    });

    this.bidPointer++;
    setTimeout(() => this.sendBidTurn(), 500); // brief delay between bids
  }

  finishBidding() {
    this.clearBidTimer();

    if (this.highestBidderIndex === -1) {
      // All passed: redeal
      this.toRoom('redeal_message', { message: '所有人未叫地主，重新发牌' });
      setTimeout(() => this.redeal(), 1000);
      return;
    }

    this.determineLandlord();
  }

  redeal() {
    this.state = C.PHASE_WAITING;
    this.players.forEach(p => {
      p.hand = [];
      p.bidAmount = 0;
    });
    this.bonusCards = [];
    // Auto-start with fresh deal
    setTimeout(() => this.startGame(), 500);
  }

  determineLandlord() {
    const landlord = this.players[this.highestBidderIndex];
    landlord.isLandlord = true;

    // Give bonus cards to landlord
    landlord.addCards(this.bonusCards);

    // Notify everyone
    for (const p of this.players) {
      const payload = {
        landlordSeat: landlord.seatIndex,
        landlordName: landlord.name,
        bonusCards: [], // only show to landlord
        players: this.players.map(pl => pl.toPublicJSON()),
        currentBid: this.currentBid,
        multiplier: this.multiplier,
      };
      if (p.id === landlord.id) {
        payload.bonusCards = [...this.bonusCards];
        payload.hand = p.toPrivateJSON().hand;
      }
      this.toPlayer(p.id, 'landlord_determined', payload);
    }

    // Start playing: landlord goes first
    this.state = C.PHASE_PLAYING;
    this.currentPlayerIndex = landlord.seatIndex;
    this.lastPlayedBy = -1;
    this.lastPlayedCards = [];
    this.lastPattern = null;
    this.passCount = 0;

    setTimeout(() => this.sendTurnStart(), 800);
  }

  // ── Playing ───────────────────────────────────────────────

  sendTurnStart() {
    if (this.state !== C.PHASE_PLAYING) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player) return;

    const isFreshRound = this.lastPattern === null;
    const canPass = !isFreshRound;

    this.toRoom('turn_start', {
      seatIndex: player.seatIndex,
      playerName: player.name,
      canPass,
      isFreshRound,
      lastPlayedBy: this.lastPlayedBy,
      lastPlayedCards: this.lastPlayedCards,
      lastPattern: this.lastPattern,
    });

    // Bot: auto-decide after a delay
    if (player.isBot && player.botStrategy) {
      this.clearTurnTimer();
      const delay = 1000 + Math.random() * 1500;
      this.turnTimer = setTimeout(() => {
        this.executeBotPlay(player);
      }, delay);
      return;
    }

    // Human: auto-pass timeout
    this.clearTurnTimer();
    if (!isFreshRound) {
      this.turnTimer = setTimeout(() => {
        this.processPass(player.id);
      }, C.TURN_TIMEOUT);
    }
  }

  executeBotPlay(botPlayer) {
    if (this.state !== C.PHASE_PLAYING) return;
    if (this.players[this.currentPlayerIndex] !== botPlayer) return;

    const bot = botPlayer.botStrategy;
    if (!bot) return;

    const opponentCounts = this.players
      .filter(p => p.seatIndex !== botPlayer.seatIndex)
      .map(p => p.hand.length);

    const decision = bot.decidePlay(
      this.lastPattern,
      botPlayer.hand.length,
      opponentCounts
    );

    if (decision && decision.cardIds && decision.cardIds.length > 0) {
      this.processPlay(botPlayer.id, decision.cardIds);
    } else if (this.lastPattern !== null) {
      this.processPass(botPlayer.id);
    } else {
      // Fresh round — must play something
      // Fallback: play first card
      if (botPlayer.hand.length > 0) {
        this.processPlay(botPlayer.id, [botPlayer.hand[0]]);
      }
    }
  }

  clearTurnTimer() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }

  processPlay(socketId, cardIds) {
    if (this.state !== C.PHASE_PLAYING) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== socketId) return;

    this.clearTurnTimer();

    // Validate
    const result = validatePlay(cardIds, player.hand, this.lastPattern);
    if (!result.valid) {
      this.toPlayer(socketId, 'error', { message: result.error });
      return;
    }

    // Track bombs for multiplier
    if (result.pattern.type === 'bomb' || result.pattern.type === 'rocket') {
      this.multiplier *= 2;
    }

    // Apply play
    player.removeCards(cardIds);
    this.lastPlayedBy = player.seatIndex;
    this.lastPlayedCards = cardIds;
    this.lastPattern = result.pattern;
    this.passCount = 0;
    this.roundCount++;

    // Broadcast
    this.toRoom('cards_played', {
      seatIndex: player.seatIndex,
      playerName: player.name,
      cardIds,
      pattern: result.pattern,
      remainingCards: player.hand.length,
      multiplier: this.multiplier,
    });

    // Check win
    if (player.hand.length === 0) {
      this.endGame(player.seatIndex);
      return;
    }

    this.advanceTurn();
  }

  processPass(socketId) {
    if (this.state !== C.PHASE_PLAYING) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== socketId) return;

    // Cannot pass on fresh round
    if (this.lastPattern === null) {
      this.toPlayer(socketId, 'error', { message: '新的一轮必须出牌' });
      return;
    }

    this.clearTurnTimer();

    this.passCount++;
    this.toRoom('player_passed', {
      seatIndex: player.seatIndex,
      playerName: player.name,
    });

    // If 2 consecutive passes, last play wins the round
    if (this.passCount >= 2) {
      this.resolveRound();
    } else {
      this.advanceTurn();
    }
  }

  resolveRound() {
    this.toRoom('round_won', {
      seatIndex: this.lastPlayedBy,
      playerName: this.players[this.lastPlayedBy].name,
    });

    this.currentPlayerIndex = this.lastPlayedBy;
    this.lastPlayedCards = [];
    this.lastPattern = null;
    this.passCount = 0;

    // Check if the round winner has already won
    if (this.players[this.currentPlayerIndex].hand.length === 0) {
      this.endGame(this.currentPlayerIndex);
      return;
    }

    setTimeout(() => this.sendTurnStart(), 600);
  }

  advanceTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
    setTimeout(() => this.sendTurnStart(), 500);
  }

  // ── End game ──────────────────────────────────────────────

  endGame(winnerSeat) {
    this.state = C.PHASE_FINISHED;
    this.clearTimers();

    const winner = this.players[winnerSeat];
    const isLandlordWin = winner.isLandlord;
    const baseBid = Math.max(this.currentBid, 1);

    // Calculate score changes
    const scoreChanges = this.players.map((p, i) => {
      if (isLandlordWin) {
        return p.isLandlord ? baseBid * 2 * this.multiplier : -baseBid * this.multiplier;
      } else {
        return p.isLandlord ? -baseBid * 2 * this.multiplier : baseBid * this.multiplier;
      }
    });

    // Apply to cumulative scores
    this.players.forEach((p, i) => { p.score += scoreChanges[i]; });

    this.toRoom('game_over', {
      winnerId: winner.id,
      winnerName: winner.name,
      winnerSeat,
      isLandlordWin,
      scores: this.players.map((p, i) => ({
        name: p.name,
        seatIndex: p.seatIndex,
        change: scoreChanges[i],
        total: p.score,
      })),
      multiplier: this.multiplier,
      baseBid,
      landlordSeat: this.players.find(p => p.isLandlord).seatIndex,
      landlordName: this.players.find(p => p.isLandlord).name,
    });

    // Bots auto-ready after a delay
    setTimeout(() => {
      for (const p of this.players) {
        if (p.isBot) this.readyForNext(p.id);
      }
    }, 2000);
  }

  readyForNext(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) return;
    player.readyForNext = true;

    this.toRoom('player_ready_next', {
      seatIndex: player.seatIndex,
      playerName: player.name,
    });

    // If all ready, start new game
    if (this.players.every(p => p.readyForNext)) {
      this.state = C.PHASE_WAITING;
      this.players.forEach(p => {
        p.readyForNext = false;
        p.isLandlord = false;
      });
      this.startGame();
    }
  }

  // ── Serialization (for reconnection) ──────────────────────

  toStateJSON(forSocketId) {
    const player = this.getPlayer(forSocketId);
    return {
      roomCode: this.code,
      state: this.state,
      phase: this.state,
      yourSeat: player ? player.seatIndex : 0,
      hand: player ? player.toPrivateJSON().hand : [],
      players: this.players.map(p => p.toPublicJSON()),
      currentBid: this.currentBid,
      landlordSeat: this.players.find(p => p.isLandlord)?.seatIndex ?? -1,
      lastPlayedBy: this.lastPlayedBy,
      lastPlayedCards: this.lastPlayedCards,
      lastPattern: this.lastPattern,
      currentPlayerIndex: this.currentPlayerIndex,
      passCount: this.passCount,
      multiplier: this.multiplier,
      bonusCards: player && player.isLandlord ? [...this.bonusCards] : [],
    };
  }
}

module.exports = Room;
