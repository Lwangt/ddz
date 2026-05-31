// Game configuration constants
module.exports = {
  // Room
  ROOM_CODE_LENGTH: 6,
  ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // no 0/O, 1/I/l

  // Game
  TOTAL_CARDS: 54,
  CARDS_PER_PLAYER: 17,
  BONUS_CARDS: 3,
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 3,
  MAX_PLAYER_NAME: 12,
  BID_MAX: 3,

  // Timing (milliseconds)
  BID_TIMEOUT: 15000,
  TURN_TIMEOUT: 20000,
  RECONNECT_GRACE: 30000,

  // Canvas base dimensions
  CANVAS_BASE_W: 1200,
  CANVAS_BASE_H: 800,
  CARD_W: 70,
  CARD_H: 100,

  // Hand layout
  HAND_OVERLAP: 0.6,     // portion hidden under previous card
  SELECTED_LIFT: 20,      // px lifted for selected cards

  // Rank names (internal rank 0-14)
  RANK_NAMES: ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'SJ', 'BJ'],
  RANK_DISPLAY: ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'],

  // Suit symbols and colors
  SUIT_SYMBOLS: ['♠', '♥', '♣', '♦'],
  SUIT_COLORS: ['#1a1a1a', '#d32f2f', '#1a1a1a', '#d32f2f'], // black/red

  // Internal rank constants
  THREE: 0, FOUR: 1, FIVE: 2, SIX: 3, SEVEN: 4, EIGHT: 5,
  NINE: 6, TEN: 7, JACK: 8, QUEEN: 9, KING: 10, ACE: 11,
  TWO: 12, SMALL_JOKER: 13, BIG_JOKER: 14,

  // Card IDs
  SMALL_JOKER_ID: 52,
  BIG_JOKER_ID: 53,

  // Game phases
  PHASE_WAITING: 'WAITING',
  PHASE_DEALING: 'DEALING',
  PHASE_BIDDING: 'BIDDING',
  PHASE_MINGPAI: 'MINGPAI',
  PHASE_PLAYING: 'PLAYING',
  PHASE_FINISHED: 'FINISHED',

  // Mingpai
  MINGPAI_TIMEOUT: 8000,
};
