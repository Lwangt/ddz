// Enhanced Dou Di Zhu AI — hand evaluation, tactical play, partner awareness
const { identifyPattern, canBeat, getRankGroups } = require('./patterns');
const { getRank } = require('./card');
const C = require('./config');

class BotStrategy {
  constructor(player) {
    this.player = player;
  }

  // ── Mingpai decision ────────────────────────────────────

  decideMingpai() {
    // Reveal hand if very confident (hand strength >= 80)
    const strength = this.evaluateHandStrength();
    return strength >= 80;
  }

  // ── Bidding — improved hand evaluation ───────────────────

  decideBid(currentBid) {
    const strength = this.evaluateHandStrength();
    if (strength >= 80 && currentBid < 3) return 3;
    if (strength >= 60 && currentBid < 2) return 2;
    if (strength >= 40 && currentBid < 1) return 1;
    if (strength >= 65 && currentBid < 3) return Math.max(currentBid + 1, 2);
    return 0;
  }

  evaluateHandStrength() {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);
    let score = 30; // baseline

    // Jokers
    if (hand.includes(C.BIG_JOKER_ID)) score += 20;
    if (hand.includes(C.SMALL_JOKER_ID)) score += 14;
    if (hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) score += 6;

    // High cards
    for (const id of hand) {
      const r = getRank(id);
      if (r === C.TWO) score += 5;
      else if (r === C.ACE) score += 3;
      else if (r === C.KING) score += 1;
    }

    // Bombs are huge
    score += groups.quads.length * 16;

    // Triples with wings are strong
    if (groups.triples.length > 0) {
      score += groups.triples.length * 5;
      // Triple + wing potential
      const availableKickers = groups.singles.length + groups.pairs.length;
      if (availableKickers >= groups.triples.length) score += 4;
    }

    // Check for straight potential (5+ consecutive singles)
    const allRanks = new Set();
    for (const id of hand) allRanks.add(getRank(id));
    let maxConsec = 0, cur = 0;
    for (let r = 0; r <= C.ACE; r++) {
      if (allRanks.has(r)) { cur++; maxConsec = Math.max(maxConsec, cur); }
      else cur = 0;
    }
    if (maxConsec >= 5) score += maxConsec * 2;

    // Check for straight-pairs potential
    const pairRanks = groups.pairs.filter(r => r <= C.ACE);
    let maxPairConsec = 0, curP = 0;
    for (let r = 0; r <= C.ACE; r++) {
      if (pairRanks.includes(r)) { curP++; maxPairConsec = Math.max(maxPairConsec, curP); }
      else curP = 0;
    }
    if (maxPairConsec >= 3) score += maxPairConsec * 3;

    // Check for airplane potential
    const tripleRanks = groups.triples.filter(r => r <= C.ACE);
    let maxTripleConsec = 0, curT = 0;
    for (let r = 0; r <= C.ACE; r++) {
      if (tripleRanks.includes(r)) { curT++; maxTripleConsec = Math.max(maxTripleConsec, curT); }
      else curT = 0;
    }
    if (maxTripleConsec >= 2) score += maxTripleConsec * 5;

    // Penalty: too many singles (hard to get rid of)
    score -= Math.max(0, groups.singles.length - 3) * 2;

    // Bonus: pairs help
    score += groups.pairs.length;

    return Math.min(100, Math.max(0, score));
  }

  // ── Main play decision ────────────────────────────────────

  decidePlay(lastPattern, myHandSize, opponentCardCounts) {
    const hand = this.player.hand;
    const groups = getRankGroups(hand);
    const minOpp = opponentCardCounts ? Math.min(...opponentCardCounts) : 99;

    if (!lastPattern) {
      return this.playAsLeader(groups, myHandSize, minOpp);
    }
    return this.playAsFollower(lastPattern, groups, myHandSize, minOpp);
  }

  // ── Leading strategy ─────────────────────────────────────
  // Priority: finish > multi-card patterns > dodge singles

  playAsLeader(groups, myHandSize, minOpp) {
    const hand = this.player.hand;

    // 1) One-shot finish
    if (identifyPattern(hand)) return { cardIds: hand };

    // 2) Two-shot finish (within 8 cards)
    if (myHandSize <= 8) {
      const combo = this.tryTwoShotFinish(hand, groups);
      if (combo) return { cardIds: combo };
    }

    // 3) If close to winning and opponent is close, play aggressively
    if (myHandSize <= 3) return { cardIds: hand };

    // 4) Straight (longest possible) — efficient card reduction
    const straight = this.findStraightLead(groups);
    if (straight && straight.length >= 6) return { cardIds: straight };

    // 5) Straight pairs
    const sp = this.findStraightPairsLead(groups);
    if (sp && sp.length >= 6) return { cardIds: sp };

    // 6) Airplane with wings
    const ap = this.findAirplaneLead(groups);
    if (ap) return { cardIds: ap };

    // 7) Triple + wing (dump singles/pairs)
    const tw = this.findTripleWithWingLead(groups);
    if (tw) return { cardIds: tw };

    // 8) Shorter straight
    if (straight) return { cardIds: straight };

    // 9) Shorter straight pairs
    if (sp) return { cardIds: sp };

    // 10) Pure triple (last resort)
    if (groups.triples.length > 0 && myHandSize > 10) {
      return { cardIds: this.cardsOfRank(groups.triples[0], 3) };
    }

    // 11) Play smallest pair
    if (groups.pairs.length > 0) {
      return { cardIds: this.cardsOfRank(groups.pairs[0], 2) };
    }

    // 12) Play smallest single
    if (groups.singles.length > 0) {
      return { cardIds: [this.cardOfRank(groups.singles[0])] };
    }

    if (hand.length > 0) return { cardIds: [hand[0]] };
    return null;
  }

  // ── Following strategy ───────────────────────────────────
  // Beat cheaply, use bombs only when threatened, partner-aware

  playAsFollower(lastPattern, groups, myHandSize, minOpp) {
    const hand = this.player.hand;
    const isLandlord = this.player.isLandlord;

    // Try same-type beat (smallest possible)
    let beatCards = this.tryBeatSameType(lastPattern);

    if (beatCards) {
      // Don't break up bombs or use premium cards unless necessary
      const usesBomb = lastPattern.type !== 'bomb' && lastPattern.type !== 'rocket' &&
        identifyPattern(beatCards)?.type === 'bomb';

      if (!usesBomb) {
        // Check if this play wastes premium cards (2s, jokers)
        const hasPremium = beatCards.some(id => getRank(id) >= C.TWO);
        if (hasPremium && myHandSize > 4) {
          // See if there's a cheaper alternative
          const cheaper = this.findCheaperBeat(lastPattern, beatCards);
          if (cheaper) beatCards = cheaper;
        }
        return { cardIds: beatCards };
      }
    }

    // Use bomb strategically:
    // - I'm about to win (<=4 cards left)
    // - Opponent is about to win (<=2 cards)
    // - Opponent played a bomb and I can counter-bomb
    const urgent = myHandSize <= 4 || minOpp <= 2 ||
                   (lastPattern.type === 'bomb' && myHandSize <= 8);

    if (urgent) {
      const bomb = this.beatBomb(lastPattern.type === 'bomb' ? lastPattern.rank : -1);
      if (bomb) return { cardIds: bomb };
    }

    // Rocket — only as absolute last resort when threatened
    if ((myHandSize <= 3 || minOpp <= 1) &&
        hand.includes(C.BIG_JOKER_ID) && hand.includes(C.SMALL_JOKER_ID)) {
      return { cardIds: [C.BIG_JOKER_ID, C.SMALL_JOKER_ID] };
    }

    // As landlord, be more aggressive with bombs
    if (isLandlord && myHandSize <= 6) {
      const bomb = this.beatBomb(-1);
      if (bomb) return { cardIds: bomb };
    }

    return null; // pass
  }

  // ── Beat same type ────────────────────────────────────────

  tryBeatSameType(lastPattern) {
    switch (lastPattern.type) {
      case 'single':        return this.beatSingle(lastPattern.rank);
      case 'pair':          return this.beatPair(lastPattern.rank);
      case 'triple':        return this.beatTriple(lastPattern.rank);
      case 'triple_plus_one':  return this.beatTripleWithWing(lastPattern.rank, 1);
      case 'triple_plus_two':  return this.beatTripleWithWing(lastPattern.rank, 2);
      case 'straight':      return this.beatStraight(lastPattern.rank, lastPattern.length);
      case 'straight_pairs': return this.beatStraightPairs(lastPattern.rank, lastPattern.length);
      case 'bomb':          return this.beatBomb(lastPattern.rank);
      default: return null;
    }
  }

  // ── Leading helpers ───────────────────────────────────────

  findStraightLead(groups) {
    const singles = groups.singles.filter(r => r <= C.ACE);
    if (singles.length < 5) return null;
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
    return best.map(r => this.cardOfRank(r));
  }

  findStraightPairsLead(groups) {
    const pairs = groups.pairs.filter(r => r <= C.ACE);
    if (pairs.length < 3) return null;
    let best = null;
    for (let start = 0; start < pairs.length; start++) {
      let end = start;
      while (end + 1 < pairs.length && pairs[end + 1] === pairs[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 3) {
        const ranks = pairs.slice(start, end + 1);
        if (!best || ranks.length > best.length) best = ranks;
      }
    }
    if (!best) return null;
    const cards = [];
    for (const r of best) cards.push(...this.cardsOfRank(r, 2));
    return cards;
  }

  findAirplaneLead(groups) {
    const triples = groups.triples.filter(r => r <= C.ACE);
    if (triples.length < 2) return null;
    let bestRun = null;
    for (let start = 0; start < triples.length; start++) {
      let end = start;
      while (end + 1 < triples.length && triples[end + 1] === triples[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 2) {
        const ranks = triples.slice(start, end + 1);
        if (!bestRun || ranks.length > bestRun.length) bestRun = ranks;
      }
    }
    if (!bestRun) return null;
    const cards = [];
    for (const r of bestRun) cards.push(...this.cardsOfRank(r, 3));

    const usedRanks = new Set(bestRun);
    const availSingles = groups.singles.filter(r => !usedRanks.has(r));
    const availPairs = groups.pairs.filter(r => !usedRanks.has(r));

    if (availPairs.length >= bestRun.length) {
      for (let i = 0; i < bestRun.length; i++) cards.push(...this.cardsOfRank(availPairs[i], 2));
    } else if (availSingles.length >= bestRun.length) {
      for (let i = 0; i < bestRun.length; i++) cards.push(this.cardOfRank(availSingles[i]));
    }
    return cards;
  }

  findTripleWithWingLead(groups) {
    if (groups.triples.length === 0) return null;
    const tripleRank = groups.triples[0];
    const cards = [...this.cardsOfRank(tripleRank, 3)];
    const used = new Set([tripleRank]);

    const singles = groups.singles.filter(r => !used.has(r));
    if (singles.length > 0) { cards.push(this.cardOfRank(singles[0])); return cards; }
    const pairs = groups.pairs.filter(r => !used.has(r));
    if (pairs.length > 0) { cards.push(...this.cardsOfRank(pairs[0], 2)); return cards; }
    return cards;
  }

  // ── Two-shot finish ──────────────────────────────────────

  tryTwoShotFinish(hand, groups) {
    // Try all partition sizes to find a valid 2-pattern split
    for (let split = 1; split < hand.length; split++) {
      const p1 = hand.slice(0, split);
      const p2 = hand.slice(split);
      if (identifyPattern(p1) && identifyPattern(p2)) {
        // Play the part that's a multi-card pattern first (more efficient)
        const pat1 = identifyPattern(p1);
        const pat2 = identifyPattern(p2);
        if (pat1 && pat2) {
          // Prefer playing bombs last
          if (pat1.type === 'bomb' || pat1.type === 'rocket') return p2;
          return p1;
        }
      }
    }
    return null;
  }

  // ── Beat helpers ─────────────────────────────────────────

  beatSingle(targetRank) {
    const hand = this.player.hand;
    let best = null;
    for (const id of hand) {
      const r = getRank(id);
      if (r > targetRank && r < C.TWO && (!best || r < getRank(best))) best = id;
    }
    // Use 2s only if no other option
    if (!best) {
      for (const id of hand) {
        const r = getRank(id);
        if (r === C.TWO && (!best || id < best)) best = id;
      }
    }
    // Joker as last resort
    if (!best && targetRank < C.SMALL_JOKER && hand.includes(C.SMALL_JOKER_ID)) best = C.SMALL_JOKER_ID;
    if (!best && targetRank < C.BIG_JOKER && hand.includes(C.BIG_JOKER_ID)) best = C.BIG_JOKER_ID;
    return best ? [best] : null;
  }

  beatPair(targetRank) {
    const rm = this.buildRankMap();
    let bestR = Infinity, bestC = null;
    for (const [r, c] of rm) {
      if (c.length >= 2 && r > targetRank && r < C.TWO && r < bestR) { bestR = r; bestC = c.slice(0, 2); }
    }
    if (!bestC) {
      for (const [r, c] of rm) {
        if (c.length >= 2 && r === C.TWO && r < bestR) { bestR = r; bestC = c.slice(0, 2); }
      }
    }
    return bestC;
  }

  beatTriple(targetRank) {
    const rm = this.buildRankMap();
    let bestR = Infinity, bestC = null;
    for (const [r, c] of rm) {
      if (c.length >= 3 && r > targetRank && r < bestR) { bestR = r; bestC = c.slice(0, 3); }
    }
    return bestC;
  }

  beatTripleWithWing(targetRank, wingSize) {
    const triple = this.beatTriple(targetRank);
    if (!triple) return null;
    const hand = this.player.hand;
    const tr = getRank(triple[0]);
    if (wingSize === 1) {
      for (const id of hand) {
        if (getRank(id) !== tr && !triple.includes(id)) return [...triple, id];
      }
      return null;
    }
    // wingSize === 2
    const rm = new Map();
    for (const id of hand) {
      if (getRank(id) === tr || triple.includes(id)) continue;
      const r = getRank(id);
      if (!rm.has(r)) rm.set(r, []);
      rm.get(r).push(id);
    }
    for (const [, c] of rm) {
      if (c.length >= 2) return [...triple, c[0], c[1]];
    }
    return null;
  }

  beatStraight(targetRank, length) {
    const rm = this.buildRankMap();
    const ranks = [];
    for (const [r] of rm) { if (r <= C.ACE) ranks.push(r); }
    ranks.sort((a, b) => a - b);
    for (let s = 0; s + length <= ranks.length; s++) {
      const seg = ranks.slice(s, s + length);
      if (seg[seg.length - 1] - seg[0] !== length - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      return seg.map(r => rm.get(r)[0]);
    }
    return null;
  }

  beatStraightPairs(targetRank, pairCount) {
    const rm = this.buildRankMap();
    const pr = [];
    for (const [r, c] of rm) { if (r <= C.ACE && c.length >= 2) pr.push(r); }
    pr.sort((a, b) => a - b);
    for (let s = 0; s + pairCount <= pr.length; s++) {
      const seg = pr.slice(s, s + pairCount);
      if (seg[seg.length - 1] - seg[0] !== pairCount - 1) continue;
      if (seg[seg.length - 1] <= targetRank) continue;
      const cards = [];
      for (const r of seg) { cards.push(rm.get(r)[0], rm.get(r)[1]); }
      return cards;
    }
    return null;
  }

  beatBomb(targetRank) {
    const rm = this.buildRankMap();
    let bestR = Infinity, bestC = null;
    for (const [r, c] of rm) {
      if (c.length === 4 && r > targetRank && r < bestR) { bestR = r; bestC = c; }
    }
    return bestC;
  }

  findCheaperBeat(lastPattern, currentBeat) {
    // If current beat uses 2s or jokers, see if a bomb can replace them
    const usesTwo = currentBeat.some(id => getRank(id) === C.TWO);
    const usesJoker = currentBeat.some(id => getRank(id) >= C.SMALL_JOKER);

    if (usesTwo || usesJoker) {
      const bomb = this.beatBomb(-1);
      if (bomb) return bomb; // bomb is cheaper than using premium cards
    }
    return null; // keep current beat
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
