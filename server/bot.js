const { identifyPattern, canBeat, getRankGroups } = require('./patterns');
const { getRank, sortHand } = require('./card');
const C = require('./config');

class BotStrategy {
  constructor(player) {
    this.player = player;
  }

  // ── Bidding ──────────────────────────────────────────────

  decideBid(currentBid) {
    const strength = this.evaluateHandStrength();
    let bid = 0;

    if (strength >= 75 && currentBid < 3) bid = 3;
    else if (strength >= 55 && currentBid < 2) bid = 2;
    else if (strength >= 30 && currentBid < 1) bid = 1;

    // Must exceed current bid
    if (bid <= currentBid) {
      if (strength >= 60 && currentBid < 2) bid = 2;
      else if (strength >= 45 && currentBid < 3) bid = 3;
      else bid = 0;
    }

    return bid;
  }

  evaluateHandStrength() {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);
    let score = 0;

    // Jokers
    if (hand.includes(C.BIG_JOKER_ID)) score += 22;
    if (hand.includes(C.SMALL_JOKER_ID)) score += 16;
    if (hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) score += 8;

    // Count rank 12 (=2) and rank 11 (=A) cards
    for (const id of hand) {
      const rank = getRank(id);
      if (rank === C.TWO) score += 5;
      else if (rank === C.ACE) score += 3;
      else if (rank === C.KING) score += 1;
    }

    // Bombs
    score += groups.quads.length * 14;

    // Hand structure
    score -= groups.singles.length;
    score += groups.pairs.length * 2;
    score += groups.triples.length * 4;

    return Math.min(100, Math.max(0, score));
  }

  // ── Playing ──────────────────────────────────────────────

  // Returns { cardIds: number[] } or null (pass)
  decidePlay(lastPattern, myHandSize, opponentCardCounts) {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);

    if (!lastPattern) {
      return this.playSmallest();
    }

    // Try to beat with same pattern type
    let beatCardIds = null;

    switch (lastPattern.type) {
      case 'single': beatCardIds = this.beatSingle(lastPattern.rank); break;
      case 'pair': beatCardIds = this.beatPair(lastPattern.rank); break;
      case 'triple': beatCardIds = this.beatTriple(lastPattern.rank); break;
      case 'triple_plus_one': beatCardIds = this.beatTripleWithWing(lastPattern.rank, 1); break;
      case 'triple_plus_two': beatCardIds = this.beatTripleWithWing(lastPattern.rank, 2); break;
      case 'straight': beatCardIds = this.beatStraight(lastPattern.rank, lastPattern.length); break;
      case 'straight_pairs': beatCardIds = this.beatStraightPairs(lastPattern.rank, lastPattern.length); break;
      case 'bomb': beatCardIds = this.beatBomb(lastPattern.rank); break;
      case 'rocket': return null; // can't beat rocket
      case 'airplane':
      case 'airplane_wing_single':
      case 'airplane_wing_pair':
      case 'four_plus_two_single':
      case 'four_plus_two_pair':
        beatCardIds = this.beatBomb(-1); // try bomb for complex patterns
        break;
    }

    if (beatCardIds) return { cardIds: beatCardIds };

    // Consider using bomb proactively
    const minOpp = opponentCardCounts ? Math.min(...opponentCardCounts) : 99;
    if (myHandSize <= 4 || minOpp <= 4 || myHandSize <= 6) {
      const bomb = this.beatBomb(-1);
      if (bomb) return { cardIds: bomb };
    }

    // Check rocket as last resort
    if (hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) {
      return { cardIds: [C.BIG_JOKER_ID, C.SMALL_JOKER_ID] };
    }

    return null; // pass
  }

  // ── Play helpers ─────────────────────────────────────────

  playSmallest() {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);

    // Try to play smallest single (prefer 3, 4, 5... over high cards)
    if (groups.singles.length > 0) {
      const rank = groups.singles[0];
      for (const id of hand) {
        if (getRank(id) === rank) return { cardIds: [id] };
      }
    }
    // Smallest pair
    if (groups.pairs.length > 0) {
      const rank = groups.pairs[0];
      const cards = hand.filter(id => getRank(id) === rank).slice(0, 2);
      return { cardIds: cards };
    }
    // Smallest triple
    if (groups.triples.length > 0) {
      const rank = groups.triples[0];
      const cards = hand.filter(id => getRank(id) === rank).slice(0, 3);
      return { cardIds: cards };
    }
    // Last card
    if (hand.length > 0) return { cardIds: [hand[0]] };
    return null;
  }

  beatSingle(targetRank) {
    const hand = this.player.hand;
    // Find smallest single that beats targetRank
    let best = null;
    for (const id of hand) {
      const rank = getRank(id);
      if (rank > targetRank) {
        if (!best || rank < getRank(best)) best = id;
      }
    }
    // Big joker beats everything (unless target is big joker already)
    if (!best && hand.includes(C.BIG_JOKER_ID) && targetRank < C.BIG_JOKER) {
      best = C.BIG_JOKER_ID;
    }
    return best ? [best] : null;
  }

  beatPair(targetRank) {
    const hand = this.player.hand;
    // Get pairs by rank
    const rankMap = new Map();
    for (const id of hand) {
      const rank = getRank(id);
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank).push(id);
    }
    let bestRank = Infinity;
    let bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length >= 2 && rank > targetRank && rank < bestRank) {
        bestRank = rank;
        bestCards = cards.slice(0, 2);
      }
    }
    return bestCards;
  }

  beatTriple(targetRank) {
    const hand = this.player.hand;
    const rankMap = new Map();
    for (const id of hand) {
      const rank = getRank(id);
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank).push(id);
    }
    let bestRank = Infinity;
    let bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length >= 3 && rank > targetRank && rank < bestRank) {
        bestRank = rank;
        bestCards = cards.slice(0, 3);
      }
    }
    return bestCards;
  }

  beatTripleWithWing(targetRank, wingSize) {
    const triple = this.beatTriple(targetRank);
    if (!triple) return null;

    const hand = this.player.hand;
    const tripleRank = getRank(triple[0]);

    // Find wing cards (cards not of the triple rank)
    if (wingSize === 1) {
      for (const id of hand) {
        if (getRank(id) !== tripleRank && !triple.includes(id)) {
          return [...triple, id];
        }
      }
    } else if (wingSize === 2) {
      const rankMap = new Map();
      for (const id of hand) {
        if (getRank(id) === tripleRank || triple.includes(id)) continue;
        const r = getRank(id);
        if (!rankMap.has(r)) rankMap.set(r, []);
        rankMap.get(r).push(id);
      }
      for (const [, cards] of rankMap) {
        if (cards.length >= 2) return [...triple, cards[0], cards[1]];
      }
    }
    return null;
  }

  beatStraight(targetRank, length) {
    const hand = this.player.hand;
    const rankMap = new Map();
    for (const id of hand) {
      const rank = getRank(id);
      if (rank > C.ACE) continue; // no 2 or jokers in straights
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank).push(id);
    }

    for (let startRank = targetRank - length + 2; startRank <= C.ACE - length + 1; startRank++) {
      if (startRank + length - 1 <= targetRank) continue;
      const cards = [];
      let ok = true;
      for (let r = startRank; r < startRank + length; r++) {
        if (!rankMap.has(r)) { ok = false; break; }
        cards.push(rankMap.get(r)[0]);
      }
      if (ok) return cards;
    }
    return null;
  }

  beatStraightPairs(targetRank, pairCount) {
    const hand = this.player.hand;
    const rankMap = new Map();
    for (const id of hand) {
      const rank = getRank(id);
      if (rank > C.ACE) continue;
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank).push(id);
    }

    const pairRanks = [];
    for (const [rank, cards] of rankMap) {
      if (cards.length >= 2) pairRanks.push(rank);
    }
    pairRanks.sort((a, b) => a - b);

    for (let start = 0; start + pairCount <= pairRanks.length; start++) {
      const seg = pairRanks.slice(start, start + pairCount);
      if (seg[seg.length - 1] - seg[0] !== pairCount - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      const cards = [];
      for (const r of seg) {
        cards.push(rankMap.get(r)[0], rankMap.get(r)[1]);
      }
      return cards;
    }
    return null;
  }

  beatBomb(targetRank) {
    const hand = this.player.hand;
    const rankMap = new Map();
    for (const id of hand) {
      const rank = getRank(id);
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank).push(id);
    }

    // Find smallest bomb that beats targetRank
    let bestRank = Infinity;
    let bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length === 4 && rank > targetRank && rank < bestRank) {
        bestRank = rank;
        bestCards = cards;
      }
    }
    return bestCards;
  }
}

module.exports = BotStrategy;
