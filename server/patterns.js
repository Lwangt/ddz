const C = require('./config');
const { getRank } = require('./card');

// Group cards by rank frequency
function getRankGroups(cardIds) {
  const map = new Map();
  for (const id of cardIds) {
    const rank = getRank(id);
    map.set(rank, (map.get(rank) || 0) + 1);
  }
  const groups = { singles: [], pairs: [], triples: [], quads: [] };
  for (const [rank, count] of map) {
    if (count === 1) groups.singles.push(rank);
    else if (count === 2) groups.pairs.push(rank);
    else if (count === 3) groups.triples.push(rank);
    else if (count === 4) groups.quads.push(rank);
  }
  groups.singles.sort((a, b) => a - b);
  groups.pairs.sort((a, b) => a - b);
  groups.triples.sort((a, b) => a - b);
  groups.quads.sort((a, b) => a - b);
  return groups;
}

// Check if sorted ranks are consecutive
function isConsecutive(sortedRanks) {
  if (sortedRanks.length < 2) return true;
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
  }
  return true;
}

// Identify the pattern formed by a set of card IDs.
// Returns { type, rank, length? } or null if invalid.
function identifyPattern(cardIds) {
  const n = cardIds.length;
  const { singles, pairs, triples, quads } = getRankGroups(cardIds);

  // Rocket: exactly two jokers
  if (n === 2 &&
      singles.length === 2 &&
      singles.includes(C.SMALL_JOKER) &&
      singles.includes(C.BIG_JOKER)) {
    return { type: 'rocket', rank: C.BIG_JOKER };
  }

  // Bomb: exactly 4 cards of the same rank
  if (n === 4 && quads.length === 1 && singles.length === 0 && pairs.length === 0 && triples.length === 0) {
    return { type: 'bomb', rank: quads[0] };
  }

  // Single
  if (n === 1 && singles.length === 1) {
    return { type: 'single', rank: singles[0] };
  }

  // Pair
  if (n === 2 && pairs.length === 1 && singles.length === 0) {
    return { type: 'pair', rank: pairs[0] };
  }

  // Triple
  if (n === 3 && triples.length === 1 && singles.length === 0) {
    return { type: 'triple', rank: triples[0] };
  }

  // Triple + 1
  if (n === 4 && triples.length === 1 && singles.length === 1 && pairs.length === 0 && quads.length === 0) {
    return { type: 'triple_plus_one', rank: triples[0] };
  }

  // Triple + 2
  if (n === 5 && triples.length === 1 && pairs.length === 1 && singles.length === 0 && quads.length === 0) {
    return { type: 'triple_plus_two', rank: triples[0] };
  }

  // Four + 2 singles (kickers can be same rank or different)
  if (n === 6 && quads.length === 1 && triples.length === 0 &&
      ((singles.length === 2 && pairs.length === 0) ||
       (singles.length === 0 && pairs.length === 1))) {
    return { type: 'four_plus_two_single', rank: quads[0] };
  }

  // Four + 2 pairs
  if (n === 8 && quads.length === 1 && pairs.length === 2 && singles.length === 0 && triples.length === 0) {
    return { type: 'four_plus_two_pair', rank: quads[0] };
  }

  // Straight: 5+ consecutive singles, max rank <= ACE (no 2)
  if (n >= 5 && singles.length === n &&
      isConsecutive(singles) && singles[singles.length - 1] <= C.ACE) {
    return { type: 'straight', rank: singles[singles.length - 1], length: n };
  }

  // Straight pairs: 3+ consecutive pairs, max rank <= ACE
  if (n >= 6 && n % 2 === 0 && pairs.length === n / 2 && pairs.length >= 3 &&
      singles.length === 0 && triples.length === 0 && quads.length === 0 &&
      isConsecutive(pairs) && pairs[pairs.length - 1] <= C.ACE) {
    return { type: 'straight_pairs', rank: pairs[pairs.length - 1], length: pairs.length };
  }

  // Airplane (triples only, no wings): 2+ consecutive triples, max rank <= ACE
  if (n >= 6 && n % 3 === 0 && triples.length === n / 3 && triples.length >= 2 &&
      singles.length === 0 && pairs.length === 0 && quads.length === 0 &&
      isConsecutive(triples) && triples[triples.length - 1] <= C.ACE) {
    return { type: 'airplane', rank: triples[triples.length - 1], length: triples.length };
  }

  // Airplane + single wings: triples >= 2, consecutive, each triple gets one single wing
  if (triples.length >= 2 && isConsecutive(triples) && triples[triples.length - 1] <= C.ACE &&
      singles.length === triples.length && pairs.length === 0 && quads.length === 0) {
    return { type: 'airplane_wing_single', rank: triples[triples.length - 1], length: triples.length };
  }

  // Airplane + pair wings: triples >= 2, consecutive, each triple gets one pair wing
  if (triples.length >= 2 && isConsecutive(triples) && triples[triples.length - 1] <= C.ACE &&
      pairs.length === triples.length && singles.length === 0 && quads.length === 0) {
    return { type: 'airplane_wing_pair', rank: triples[triples.length - 1], length: triples.length };
  }

  return null;
}

// Check if newPattern can beat lastPattern
function canBeat(newPattern, lastPattern) {
  if (lastPattern === null) return true;

  // Rocket beats everything
  if (newPattern.type === 'rocket') return true;

  // Bomb beats non-bomb, non-rocket
  if (newPattern.type === 'bomb') {
    if (lastPattern.type !== 'bomb' && lastPattern.type !== 'rocket') return true;
    if (lastPattern.type === 'bomb') return newPattern.rank > lastPattern.rank;
    return false; // rocket already handled above
  }

  // Non-bomb vs bomb/rocket: cannot beat
  if (lastPattern.type === 'bomb' || lastPattern.type === 'rocket') return false;

  // Same type: require same length (for straights/airplanes) and higher rank
  if (newPattern.type !== lastPattern.type) return false;

  // For patterns with length, lengths must match
  if (newPattern.length !== undefined && newPattern.length !== lastPattern.length) {
    return false;
  }

  return newPattern.rank > lastPattern.rank;
}

// Validate a play: player must own all cards, pattern must be valid, must beat last
function validatePlay(cardIds, handCardIds, lastPattern) {
  const handSet = new Set(handCardIds);
  for (const id of cardIds) {
    if (!handSet.has(id)) {
      return { valid: false, error: '手牌中没有这些牌' };
    }
  }

  const pattern = identifyPattern(cardIds);
  if (!pattern) {
    return { valid: false, error: '无效的牌型' };
  }

  if (!canBeat(pattern, lastPattern)) {
    if (lastPattern === null) {
      return { valid: false, error: '请出牌' };
    }
    return { valid: false, error: '管不上，牌太小或牌型不匹配' };
  }

  return { valid: true, pattern };
}

module.exports = {
  identifyPattern,
  canBeat,
  validatePlay,
  getRankGroups, // exported for testing
};
