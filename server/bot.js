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
    if (hand.includes(C.BIG_JOKER_ID)) score += 22;
    if (hand.includes(C.SMALL_JOKER_ID)) score += 16;
    if (hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) score += 8;
    for (const id of hand) {
      const rank = getRank(id);
      if (rank === C.TWO) score += 5;
      else if (rank === C.ACE) score += 3;
      else if (rank === C.KING) score += 1;
    }
    score += groups.quads.length * 14;
    score -= groups.singles.length;
    score += groups.pairs.length * 2;
    score += groups.triples.length * 4;
    return Math.min(100, Math.max(0, score));
  }

  // ── Playing ──────────────────────────────────────────────

  decidePlay(lastPattern, myHandSize, opponentCardCounts) {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);

    if (!lastPattern) {
      return this.playAsLeader(groups, myHandSize);
    }
    return this.playAsFollower(lastPattern, groups, myHandSize, opponentCardCounts);
  }

  // ── Leading strategy ─────────────────────────────────────
  // Priority: finish > straight > straight pairs > airplane > triple+wing > triple > pair > single

  playAsLeader(groups, myHandSize) {
    const hand = this.player.hand;

    // 1) Try to finish in one play
    const pattern = identifyPattern(hand);
    if (pattern) {
      return { cardIds: hand };
    }

    // 2) Try to finish in 2 plays: find a play that leaves a valid remainder
    if (myHandSize <= 8) {
      const combo = this.tryTwoShotFinish(hand, groups);
      if (combo) return { cardIds: combo };
    }

    // 3) Straight (5-12 cards) — reduces hand count significantly
    const straight = this.findStraightLead(groups);
    if (straight) return { cardIds: straight };

    // 4) Straight pairs (3+ pairs)
    const sp = this.findStraightPairsLead(groups);
    if (sp) return { cardIds: sp };

    // 5) Airplane or airplane with wings
    const ap = this.findAirplaneLead(groups);
    if (ap) return { cardIds: ap };

    // 6) Triple + wing (三带一/三带二) — use singles as wings first
    const tw = this.findTripleWithWingLead(groups);
    if (tw) return { cardIds: tw };

    // 7) Pure triple (if no better use for it)
    if (groups.triples.length > 0 && groups.singles.length === 0 && groups.pairs.length === 0) {
      return { cardIds: this.cardsOfRank(groups.triples[0], 3) };
    }

    // 8) Pair — play the smallest pair
    if (groups.pairs.length > 0) {
      return { cardIds: this.cardsOfRank(groups.pairs[0], 2) };
    }

    // 9) Single — play smallest
    if (groups.singles.length > 0) {
      return { cardIds: [this.cardOfRank(groups.singles[0])] };
    }

    if (hand.length > 0) return { cardIds: [hand[0]] };
    return null;
  }

  // ── Following strategy ───────────────────────────────────

  playAsFollower(lastPattern, groups, myHandSize, opponentCardCounts) {
    const hand = this.player.hand;
    const minOpp = opponentCardCounts ? Math.min(...opponentCardCounts) : 99;

    // Try to beat with same pattern type (smallest possible)
    let beatCards = null;
    switch (lastPattern.type) {
      case 'single':        beatCards = this.beatSingle(lastPattern.rank); break;
      case 'pair':          beatCards = this.beatPair(lastPattern.rank); break;
      case 'triple':        beatCards = this.beatTriple(lastPattern.rank); break;
      case 'triple_plus_one':  beatCards = this.beatTripleWithWing(lastPattern.rank, 1); break;
      case 'triple_plus_two':  beatCards = this.beatTripleWithWing(lastPattern.rank, 2); break;
      case 'straight':      beatCards = this.beatStraight(lastPattern.rank, lastPattern.length); break;
      case 'straight_pairs': beatCards = this.beatStraightPairs(lastPattern.rank, lastPattern.length); break;
      case 'bomb':          beatCards = this.beatBomb(lastPattern.rank); break;
      case 'rocket':        return null;
      default: break;
    }

    if (beatCards) {
      // Don't use 2s or jokers unless necessary or close to winning
      const usesPremium = beatCards.some(id => getRank(id) >= C.TWO);
      if (usesPremium && myHandSize > 4 && minOpp > 4) {
        // Check if there's a cheaper alternative
        const cheaper = this.findCheaperBeat(lastPattern, beatCards);
        if (cheaper) beatCards = cheaper;
      }
      return { cardIds: beatCards };
    }

    // Use bomb if: I'm close to winning OR an opponent is close to winning
    if (myHandSize <= 4 || minOpp <= 4 || (myHandSize <= 8 && minOpp <= 6)) {
      const bomb = this.beatBomb(-1);
      if (bomb) return { cardIds: bomb };
    }

    // Rocket as absolute last resort
    if (hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) {
      return { cardIds: [C.BIG_JOKER_ID, C.SMALL_JOKER_ID] };
    }

    return null; // pass
  }

  // ── Leading helpers: find best combination ────────────────

  findStraightLead(groups) {
    const singles = groups.singles.filter(r => r <= C.ACE);
    if (singles.length < 5) return null;
    // Find the longest consecutive run
    let best = null;
    for (let start = 0; start < singles.length; start++) {
      let end = start;
      while (end + 1 < singles.length && singles[end + 1] === singles[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 5) {
        const ranks = singles.slice(start, end + 1);
        if (!best || ranks.length > best.length) best = ranks;
      }
    }
    if (!best) return null;
    const cards = [];
    for (const r of best) cards.push(this.cardOfRank(r));
    return cards;
  }

  findStraightPairsLead(groups) {
    const allPairs = groups.pairs.filter(r => r <= C.ACE);
    if (allPairs.length < 3) return null;
    let best = null;
    for (let start = 0; start < allPairs.length; start++) {
      let end = start;
      while (end + 1 < allPairs.length && allPairs[end + 1] === allPairs[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 3) {
        const ranks = allPairs.slice(start, end + 1);
        if (!best || ranks.length > best.length) best = ranks;
      }
    }
    if (!best) return null;
    const cards = [];
    for (const r of best) {
      const pairCards = this.cardsOfRank(r, 2);
      cards.push(...pairCards);
    }
    return cards;
  }

  findAirplaneLead(groups) {
    const allTriples = groups.triples.filter(r => r <= C.ACE);
    if (allTriples.length < 2) return null;
    let bestRun = null;
    for (let start = 0; start < allTriples.length; start++) {
      let end = start;
      while (end + 1 < allTriples.length && allTriples[end + 1] === allTriples[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 2) {
        const ranks = allTriples.slice(start, end + 1);
        if (!bestRun || ranks.length > bestRun.length) bestRun = ranks;
      }
    }
    if (!bestRun) return null;

    const cards = [];
    for (const r of bestRun) cards.push(...this.cardsOfRank(r, 3));

    // Try to add wings (singles or pairs)
    const usedRanks = new Set(bestRun);
    const availableSingles = groups.singles.filter(r => !usedRanks.has(r));
    const availablePairs = groups.pairs.filter(r => !usedRanks.has(r));

    if (availablePairs.length >= bestRun.length) {
      for (let i = 0; i < bestRun.length; i++) {
        cards.push(...this.cardsOfRank(availablePairs[i], 2));
      }
    } else if (availableSingles.length >= bestRun.length) {
      for (let i = 0; i < bestRun.length; i++) {
        cards.push(this.cardOfRank(availableSingles[i]));
      }
    }
    return cards;
  }

  findTripleWithWingLead(groups) {
    if (groups.triples.length === 0) return null;
    const tripleRank = groups.triples[0];
    const cards = [...this.cardsOfRank(tripleRank, 3)];

    // Prefer using singles as wings (get rid of weak cards)
    const usedRanks = new Set([tripleRank]);
    const singles = groups.singles.filter(r => !usedRanks.has(r));
    if (singles.length > 0) {
      cards.push(this.cardOfRank(singles[0]));
      return cards;
    }
    // Use pair as wing
    const pairs = groups.pairs.filter(r => !usedRanks.has(r));
    if (pairs.length > 0) {
      cards.push(...this.cardsOfRank(pairs[0], 2));
      return cards;
    }
    return cards; // pure triple
  }

  // ── Two-shot finish ──────────────────────────────────────

  tryTwoShotFinish(hand, groups) {
    // Try to split hand into 2 valid patterns
    for (let i = 1; i < hand.length; i++) {
      const first = hand.slice(0, i);
      const second = hand.slice(i);
      if (identifyPattern(first) && identifyPattern(second)) {
        return first; // play the first part now
      }
    }
    return null;
  }

  // ── Beat helpers ─────────────────────────────────────────

  beatSingle(targetRank) {
    const hand = this.player.hand;
    let best = null;
    for (const id of hand) {
      const rank = getRank(id);
      if (rank > targetRank && (!best || rank < getRank(best))) best = id;
    }
    if (!best && hand.includes(C.BIG_JOKER_ID) && targetRank < C.BIG_JOKER) {
      best = C.BIG_JOKER_ID;
    }
    return best ? [best] : null;
  }

  beatPair(targetRank) {
    const rankMap = this.buildRankMap();
    let bestRank = Infinity, bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length >= 2 && rank > targetRank && rank < bestRank) {
        bestRank = rank; bestCards = cards.slice(0, 2);
      }
    }
    return bestCards;
  }

  beatTriple(targetRank) {
    const rankMap = this.buildRankMap();
    let bestRank = Infinity, bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length >= 3 && rank > targetRank && rank < bestRank) {
        bestRank = rank; bestCards = cards.slice(0, 3);
      }
    }
    return bestCards;
  }

  beatTripleWithWing(targetRank, wingSize) {
    const triple = this.beatTriple(targetRank);
    if (!triple) return null;
    const hand = this.player.hand;
    const tripleRank = getRank(triple[0]);
    if (wingSize === 1) {
      for (const id of hand) {
        if (getRank(id) !== tripleRank && !triple.includes(id)) return [...triple, id];
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
    const rankMap = this.buildRankMap();
    const candidates = [];
    for (const [r] of rankMap) { if (r <= C.ACE) candidates.push(r); }
    candidates.sort((a, b) => a - b);

    for (let start = 0; start + length <= candidates.length; start++) {
      const seg = candidates.slice(start, start + length);
      if (seg[seg.length - 1] - seg[0] !== length - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      return seg.map(r => rankMap.get(r)[0]);
    }
    return null;
  }

  beatStraightPairs(targetRank, pairCount) {
    const rankMap = this.buildRankMap();
    const pairRanks = [];
    for (const [r, cards] of rankMap) {
      if (r <= C.ACE && cards.length >= 2) pairRanks.push(r);
    }
    pairRanks.sort((a, b) => a - b);
    for (let start = 0; start + pairCount <= pairRanks.length; start++) {
      const seg = pairRanks.slice(start, start + pairCount);
      if (seg[seg.length - 1] - seg[0] !== pairCount - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      const cards = [];
      for (const r of seg) { cards.push(rankMap.get(r)[0], rankMap.get(r)[1]); }
      return cards;
    }
    return null;
  }

  beatBomb(targetRank) {
    const rankMap = this.buildRankMap();
    let bestRank = Infinity, bestCards = null;
    for (const [rank, cards] of rankMap) {
      if (cards.length === 4 && rank > targetRank && rank < bestRank) {
        bestRank = rank; bestCards = cards;
      }
    }
    return bestCards;
  }

  findCheaperBeat(lastPattern, currentBeat) {
    // Avoid using 2s/jokers when a bomb can do the job
    if (lastPattern.type === 'bomb' || lastPattern.type === 'rocket') return null;
    return null; // Simplified: accept the beat
  }

  // ── Utilities ────────────────────────────────────────────

  buildRankMap() {
    const map = new Map();
    for (const id of this.player.hand) {
      const r = getRank(id);
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(id);
    }
    return map;
  }

  cardOfRank(rank) {
    for (const id of this.player.hand) {
      if (getRank(id) === rank) return id;
    }
    return this.player.hand[0];
  }

  cardsOfRank(rank, count) {
    const cards = [];
    for (const id of this.player.hand) {
      if (getRank(id) === rank && cards.length < count) cards.push(id);
    }
    return cards;
  }
}

module.exports = BotStrategy;
