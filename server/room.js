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

    // Bidding state (simultaneous)
    this.bidResponses = {};      // { seatIndex: amount } — collect all 3
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
    this.springBroken = false;   // spring = landlord won without farmers ever playing

    // Deck
    this.bonusCards = [];

    // Background
    this.currentBg = 0;

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

    // Pick a random background different from current one
    const bgCount = 7; // bg1.png through bg7.png
    if (bgCount > 1) {
      let newBg;
      do {
        newBg = Math.floor(Math.random() * bgCount) + 1;
      } while (newBg === this.currentBg);
      this.currentBg = newBg;
    } else {
      this.currentBg = this.currentBg || 1;
    }

    this.state = C.PHASE_DEALING;

    // Reset per-game state
    this.players.forEach(p => p.reset());
    // Assign random avatars to players who don't have one yet
    const avatarCount = 5; // role images: 角色1.png through 角色5.png
    const availableAvatars = [];
    for (let i = 1; i <= avatarCount; i++) availableAvatars.push(i);
    // Keep existing avatars, assign random unused ones to players without
    const usedAvatars = new Set(this.players.filter(p => p.avatar).map(p => p.avatar));
    const freeAvatars = availableAvatars.filter(a => !usedAvatars.has(a));
    for (const p of this.players) {
      if (!p.avatar) {
        if (freeAvatars.length > 0) {
          const idx = Math.floor(Math.random() * freeAvatars.length);
          p.avatar = freeAvatars.splice(idx, 1)[0];
        } else {
          // All avatars taken, assign random from full set anyway
          p.avatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
        }
      }
    }

    // Re-create bot strategies for ALL players (bots use actively, humans use for timeout fallback)
    for (const p of this.players) {
      p.botStrategy = new BotStrategy(p);
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
        bg: this.currentBg,
      });
    }

    // Brief delay to show deal animation, then start bidding
    setTimeout(() => this.startBidding(), 1500);
    return true;
  }

  // ── Bidding ───────────────────────────────────────────────

  startBidding() {
    // Prevent duplicate calls
    if (this.state !== C.PHASE_DEALING && this.state !== C.PHASE_WAITING) return;
    this.state = C.PHASE_BIDDING;
    this.currentBid = 0;
    this.highestBidderIndex = -1;
    this.bidResponses = {};
    this.players.forEach(p => { p.bidAmount = 0; });

    // All players bid simultaneously
    this.toRoom('bid_turn', {
      mode: 'simultaneous',
      canBid: [1, 2, 3],
      timeout: C.BID_TIMEOUT / 1000,
      currentBid: 0,
      players: this.players.map(p => ({ seatIndex: p.seatIndex, name: p.name })),
    });

    // Schedule bot bids
    for (const p of this.players) {
      if (p.isBot && p.botStrategy) {
        const delay = 500 + Math.random() * 1500;
        setTimeout(() => {
          if (this.state === C.PHASE_BIDDING) {
            const amount = p.botStrategy.decideBid(0);
            this.processBid(p.id, amount);
          }
        }, delay);
      }
    }

    // Auto-timeout for humans who don't bid
    this.clearBidTimer();
    this.bidTimer = setTimeout(() => {
      // Auto-pass for anyone who hasn't bid yet
      for (const p of this.players) {
        if (p.isBot) continue;
        if (!(p.seatIndex in this.bidResponses)) {
          this.processBid(p.id, 0);
        }
      }
    }, C.BID_TIMEOUT);
  }

  clearBidTimer() {
    if (this.bidTimer) { clearTimeout(this.bidTimer); this.bidTimer = null; }
  }

  processBid(socketId, amount) {
    if (this.state !== C.PHASE_BIDDING) return;

    const player = this.getPlayer(socketId);
    if (!player) return;
    if (this.bidResponses[player.seatIndex] !== undefined) return; // already bid

    amount = parseInt(amount) || 0;
    if (amount < 0 || amount > C.BID_MAX) amount = 0;

    player.bidAmount = amount;
    this.bidResponses[player.seatIndex] = amount;
    if (amount > this.currentBid) {
      this.currentBid = amount;
      this.highestBidderIndex = player.seatIndex;
    }

    this.toRoom('bid_made', {
      seatIndex: player.seatIndex,
      playerName: player.name,
      amount: amount,
      currentBid: this.currentBid,
    });

    // If someone bids 3, finish immediately
    if (amount === C.BID_MAX) {
      this.clearBidTimer();
      setTimeout(() => this.finishBidding(), 300);
      return;
    }

    // Check if all 3 have responded
    if (Object.keys(this.bidResponses).length >= 3) {
      this.clearBidTimer();
      setTimeout(() => this.finishBidding(), 300);
    }
  }

  finishBidding() {
    if (this.state !== C.PHASE_BIDDING) return;
    this.clearBidTimer();

    // Auto-fill missing responses as pass
    for (const p of this.players) {
      if (p && !(p.seatIndex in this.bidResponses)) {
        p.bidAmount = 0;
        this.bidResponses[p.seatIndex] = 0;
        this.toRoom('bid_made', { seatIndex: p.seatIndex, playerName: p.name, amount: 0, currentBid: this.currentBid });
      }
    }

    // Find actual highest bidder (safe lookup)
    let best = -1, bestAmt = 0;
    for (const p of this.players) {
      if (p && p.bidAmount > bestAmt) { bestAmt = p.bidAmount; best = p.seatIndex; }
    }
    this.highestBidderIndex = best;
    this.currentBid = bestAmt;

    if (this.highestBidderIndex < 0 || this.currentBid <= 0) {
      this.toRoom('redeal_message', { message: '所有人未叫地主，重新发牌' });
      setTimeout(() => { if (this.state === 'BIDDING') this.redeal(); }, 1500);
      return;
    }

    this.toRoom('bidding_result', {
      highestBid: this.currentBid,
      highestBidder: this.highestBidderIndex,
    });
    setTimeout(() => this.determineLandlord(), 800);
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
    if (this.state !== C.PHASE_BIDDING) return; // prevent double-call
    const landlord = this.players[this.highestBidderIndex];
    if (!landlord) return;
    landlord.isLandlord = true;

    // Give bonus cards to landlord
    landlord.addCards(this.bonusCards);

    // Broadcast landlord + bonus cards to room
    this.toRoom('landlord_determined', {
      landlordSeat: landlord.seatIndex,
      landlordName: landlord.name,
      bonusCards: [...this.bonusCards],
      players: this.players.map(pl => pl.toPublicJSON()),
      currentBid: this.currentBid,
      multiplier: this.multiplier,
    });

    // Send private hand update to landlord
    if (!landlord.isBot) {
      this.toPlayer(landlord.id, 'your_hand_update', {
        hand: landlord.toPrivateJSON().hand,
        bonusCards: [...this.bonusCards],
      });
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

    // Human: auto-play timeout (play smallest card, or pass if can't play)
    this.clearTurnTimer();
    if (isFreshRound) {
      // Fresh round — must play, auto-play smallest single
      this.turnTimer = setTimeout(() => {
        this.executeAutoPlay(player);
      }, C.TURN_TIMEOUT);
    } else {
      // Responding — try to play smallest beat, or auto-pass
      this.turnTimer = setTimeout(() => {
        this.executeAutoPlayOrPass(player);
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
    // Send private hand update to keep client in sync
    if (!player.isBot) {
      this.toPlayer(player.id, 'your_hand_update', { hand: player.toPrivateJSON().hand });
    }
    // Spring: if landlord plays and farmers never played, spring is still alive
    // Counter-spring: if farmers win and landlord only played first round
    if (!player.isLandlord) this.springBroken = true;
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

  executeAutoPlay(player) {
    // Use bot strategy for smart auto-play (human timeout/disconnect)
    if (this.state !== C.PHASE_PLAYING) return;
    if (this.players[this.currentPlayerIndex] !== player) return;
    if (player.hand.length === 0) return;
    // Ensure player has a bot strategy for fallback
    if (!player.botStrategy) {
      const BotStrategy = require('./bot');
      player.botStrategy = new BotStrategy(player);
    }
    this.executeBotPlay(player);
  }

  executeAutoPlayOrPass(player) {
    // Use bot strategy - it already handles pass vs play decisions
    this.executeAutoPlay(player);
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

    // Spring detection
    let springMultiplier = 1;
    if (isLandlordWin && !this.springBroken) {
      springMultiplier = 2; // 春天：地主获胜且农民未出过牌
      this.toRoom('spring_event', { type: 'spring' });
    } else if (!isLandlordWin && this.roundCount <= 1) {
      springMultiplier = 2; // 反春天：农民获胜且地主只出过一轮
      this.toRoom('spring_event', { type: 'counter_spring' });
    }

    // Standard scoring: 底分 × 炸弹倍数 × 春天倍数
    const totalMultiplier = this.multiplier * springMultiplier;
    const scoreChanges = this.players.map((p, i) => {
      if (isLandlordWin) {
        return p.isLandlord ? baseBid * 2 * totalMultiplier : -baseBid * totalMultiplier;
      } else {
        return p.isLandlord ? -baseBid * 2 * totalMultiplier : baseBid * totalMultiplier;
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
      springMultiplier,
      totalMultiplier,
      baseBid,
      spring: springMultiplier > 1 ? (isLandlordWin ? 'spring' : 'counter_spring') : null,
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
      bg: this.currentBg,
    };
  }
}

module.exports = Room;
