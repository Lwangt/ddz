const { sortHand } = require('./card');

class Player {
  constructor(id, name, seatIndex, isBot = false) {
    this.id = id;                // Socket.IO socket.id (can change on reconnect)
    this.name = String(name).slice(0, 12);
    this.seatIndex = seatIndex;
    this.token = Player.generateToken();
    this.hand = [];
    this.isLandlord = false;
    this.isConnected = true;
    this.isBot = isBot;
    this.score = 0;
    this.bidAmount = 0;
    this.readyForNext = false;
    this.botStrategy = null;     // reference to BotStrategy instance
  }

  static generateToken() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  updateSocketId(newId) {
    this.id = newId;
  }

  sortHand() {
    this.hand = sortHand(this.hand);
  }

  hasCards(cardIds) {
    const set = new Set(this.hand);
    return cardIds.every(id => set.has(id));
  }

  removeCards(cardIds) {
    const removeSet = new Set(cardIds);
    this.hand = this.hand.filter(id => !removeSet.has(id));
    // No need to re-sort since filter preserves order
  }

  addCards(cardIds) {
    this.hand = sortHand([...this.hand, ...cardIds]);
  }

  cardCount() {
    return this.hand.length;
  }

  // For opponents: omit hand, show card count only
  toPublicJSON() {
    return {
      id: this.id,
      name: this.name,
      seatIndex: this.seatIndex,
      isLandlord: this.isLandlord,
      isConnected: this.isConnected,
      isBot: this.isBot,
      cardCount: this.hand.length,
      bidAmount: this.bidAmount,
      score: this.score,
      readyForNext: this.readyForNext,
    };
  }

  // For self: include full hand
  toPrivateJSON() {
    return {
      ...this.toPublicJSON(),
      hand: [...this.hand],
    };
  }

  reset() {
    this.hand = [];
    this.isLandlord = false;
    this.bidAmount = 0;
    this.readyForNext = false;
  }
}

module.exports = Player;
