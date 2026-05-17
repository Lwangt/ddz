const C = require('./config');

// Decode a card ID (0-53) into { suit, rank, isJoker?, jokerType? }
function decodeCard(id) {
  if (id === C.SMALL_JOKER_ID) return { suit: -1, rank: C.SMALL_JOKER, isJoker: true, jokerType: 'small' };
  if (id === C.BIG_JOKER_ID)   return { suit: -1, rank: C.BIG_JOKER, isJoker: true, jokerType: 'big' };
  return {
    suit:  Math.floor(id / 13),
    rank:  id % 13,
    isJoker: false
  };
}

// Create a fresh 54-card deck
function createDeck() {
  return Array.from({ length: C.TOTAL_CARDS }, (_, i) => i);
}

// Fisher-Yates shuffle (in-place)
function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Deal: first 51 cards to 3 players (17 each), last 3 as bonus
function dealCards(deck) {
  return {
    hands: [
      deck.slice(0, 17),
      deck.slice(17, 34),
      deck.slice(34, 51)
    ],
    bonus: deck.slice(51, 54)
  };
}

// Sort hand by rank ascending, then suit ascending
function sortHand(cardIds) {
  return [...cardIds].sort((a, b) => {
    const ca = decodeCard(a);
    const cb = decodeCard(b);
    if (ca.rank !== cb.rank) return ca.rank - cb.rank;
    return ca.suit - cb.suit;
  });
}

// Get rank from card ID without full decode
function getRank(id) {
  if (id === C.SMALL_JOKER_ID) return C.SMALL_JOKER;
  if (id === C.BIG_JOKER_ID)   return C.BIG_JOKER;
  return id % 13;
}

// Get display string for a card
function cardDisplay(id) {
  const card = decodeCard(id);
  if (card.isJoker) return card.jokerType === 'big' ? '🃏大王' : '🃏小王';
  return C.SUIT_SYMBOLS[card.suit] + C.RANK_NAMES[card.rank];
}

module.exports = {
  decodeCard,
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  getRank,
  cardDisplay
};
