// Comprehensive multi-game test — full game flow with bots
const Room = require('./server/room');
const { identifyPattern, canBeat, validatePlay } = require('./server/patterns');
const { getRank } = require('./server/card');
const C = require('./server/config');

let totalOk = 0, totalFail = 0, gameNum = 0;

function check(name, cond, detail) {
  if (cond) { totalOk++; } else { totalFail++; console.log('    ❌ ' + name + (detail ? ': ' + detail : '')); }
}

// Enhanced mockIo that captures toPlayer calls
function makeMockIo() {
  const playerMessages = {};
  return {
    playerMessages,
    to: (room) => ({ emit: () => {} }),
    toPlayer: function(socketId, event, data) {
      if (!playerMessages[socketId]) playerMessages[socketId] = [];
      playerMessages[socketId].push({ event, data });
    },
    emit: function() {}
  };
}

function runOneGame() {
  gameNum++;
  const mockIo = makeMockIo();
  const room = new Room('G' + gameNum, mockIo);
  room.testMode = true;
  room.addPlayer('human', '玩家');
  room.startGame();

  return new Promise((resolve) => {
    function checkState() {
      if (room.state === C.PHASE_DEALING) {
        room.startBidding();
        setTimeout(() => resolve({ room, mockIo }), 100);
      } else if (room.state === C.PHASE_BIDDING) {
        resolve({ room, mockIo });
      } else {
        setTimeout(checkState, 50);
      }
    }
    setTimeout(checkState, 100);
  });
}

// Wait for state to change
function waitForState(room, targetStates, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      if (targetStates.includes(room.state) || Date.now() - start > timeout) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    }
    check();
  });
}

function bidPhase(room) {
  return new Promise(async (resolve) => {
    await waitForState(room, [C.PHASE_BIDDING], 3000);

    setTimeout(() => {
      if (room.state !== C.PHASE_BIDDING) { resolve(); return; }
      for (const p of room.players) {
        if (p.isBot && p.botStrategy && !(p.seatIndex in room.bidResponses)) {
          const amt = p.botStrategy.decideBid(room.currentBid);
          room.processBid(p.id, amt);
        }
      }
      const human = room.players[0];
      if (human && !human.isBot && !(0 in room.bidResponses)) {
        const strength = human.botStrategy ? human.botStrategy.evaluateHandStrength() : 50;
        room.processBid(human.id, strength >= 50 ? 2 : 1);
      }
      if (room.state === C.PHASE_BIDDING) room.finishBidding();
      resolve();
    }, 300);
  });
}

function playPhase(room, maxRounds) {
  return new Promise(async (resolve) => {
    await waitForState(room, [C.PHASE_PLAYING, C.PHASE_FINISHED, C.PHASE_WAITING], 5000);
    if (room.state !== C.PHASE_PLAYING) { resolve(); return; }

    let rounds = 0;
    function doRound() {
      if (room.state !== 'PLAYING' || rounds >= maxRounds) {
        resolve();
        return;
      }
      rounds++;
      const cp = room.players[room.currentPlayerIndex];
      if (!cp) { resolve(); return; }

      if (cp.isBot && cp.botStrategy) {
        const opp = room.players.filter(p => p !== cp).map(p => p.hand.length);
        const decision = cp.botStrategy.decidePlay(room.lastPattern, cp.hand.length, opp);
        if (decision && decision.cardIds && decision.cardIds.length > 0) {
          room.processPlay(cp.id, decision.cardIds);
        } else if (room.lastPattern) {
          room.processPass(cp.id);
        } else {
          room.processPlay(cp.id, [cp.hand[0]]);
        }
      } else {
        // Human
        if (!room.lastPattern) {
          room.processPlay(cp.id, [cp.hand[0]]);
        } else {
          let played = false;
          if (room.lastPattern.type === 'single') {
            for (const id of cp.hand) {
              if (getRank(id) > room.lastPattern.rank) {
                room.processPlay(cp.id, [id]); played = true; break;
              }
            }
          }
          if (!played) room.processPass(cp.id);
        }
      }
      setTimeout(doRound, 20);
    }
    setTimeout(doRound, 500);
  });
}

async function testFullGame() {
  console.log(`\n=== 游戏 #${gameNum} ===`);
  const { room } = await runOneGame();
  if (!room) return;

  check('testMode启用', room.testMode === true);
  check('3名玩家', room.players.length === 3);
  check('2个bots', room.players.filter(p => p.isBot).length === 2);
  check('每人17张牌', room.players.every(p => p.hand.length === 17));
  check('3张底牌', room.bonusCards.length === 3);

  await bidPhase(room);
  await waitForState(room, [C.PHASE_PLAYING, C.PHASE_FINISHED, C.PHASE_WAITING], 3000);

  const landlord = room.players.find(p => p.isLandlord);
  check('地主已确定', !!landlord, 'highestBidder=' + room.highestBidderIndex + ' currentBid=' + room.currentBid);
  if (landlord) {
    check('地主20张牌', landlord.hand.length === 20);
    check('农民17张牌', room.players.filter(p => !p.isLandlord).every(p => p.hand.length === 17));
  }

  await playPhase(room, 100);

  if (room.state === 'FINISHED') {
    check('游戏正常结束', true);
    check('有积分变化', room.players.some(p => p.score !== 0));
    check('积分总和为0', room.players.reduce((s, p) => s + p.score, 0) === 0);
  } else {
    check('游戏正常结束', false, 'state=' + room.state + ' after 60 rounds');
  }

  const scores = room.players.map(p => p.name + ':' + p.score).join(' ');
  console.log('  积分: ' + scores + ' | 状态: ' + room.state + ' | 倍数: ' + room.multiplier);
}

// Run multiple games
async function main() {
  console.log('===== 斗地主 完整联机模拟测试 =====\n');

  // ── Test 1: Card validation ──────────────────────────────
  console.log('--- 牌型验证 ---');
  const testHand = [0,13,26,39, 1,14,27, 2,15, 3,16, 4,17, 5,18, 6,19, 7, 8, 9, 10, 11, 12, 51, 52, 53];

  check('出单张', validatePlay([0], testHand, null).valid);
  check('出对子', validatePlay([0, 13], testHand, null).valid);
  check('出三条', validatePlay([0, 13, 26], testHand, null).valid);
  check('出炸弹', validatePlay([0, 13, 26, 39], testHand, null).valid);
  check('出火箭', validatePlay([52, 53], testHand, null).valid);
  check('出三带一', validatePlay([0, 13, 26, 1], testHand, null).valid);
  check('出三带二', validatePlay([0, 13, 26, 1, 14], testHand, null).valid);

  // Invalid plays
  check('出3344两对应拒绝', !validatePlay([0, 13, 1, 14], testHand, null).valid);
  check('手牌没有的牌', !validatePlay([100], testHand, null).valid);
  check('不是自己手牌应拒绝', !validatePlay([0], [1,2,3], null).valid);

  // Beat logic
  const single3 = identifyPattern([0]);
  const single4 = identifyPattern([1]);
  const pair3 = identifyPattern([0, 13]);
  const bomb3 = identifyPattern([0, 13, 26, 39]);
  const rocket = identifyPattern([52, 53]);

  check('4>3', canBeat(single4, single3));
  check('3不能>4', !canBeat(single3, single4));
  check('对子不能管单张', !canBeat(pair3, single3));
  check('炸弹能管单张', canBeat(bomb3, single3));
  check('火箭能管炸弹', canBeat(rocket, bomb3));

  // ── Test 2: Turn management ──────────────────────────────
  console.log('\n--- 回合管理 ---');
  const mockIo2 = makeMockIo();
  const room2 = new Room('TURN', mockIo2);
  room2.testMode = true;
  room2.addPlayer('human', '玩家');
  room2.startGame();
  await new Promise(r => setTimeout(r, 200));
  room2.startBidding();
  for (const p of room2.players) {
    room2.processBid(p.id, p.isBot ? 0 : 1);
  }
  if (room2.state === 'BIDDING') room2.finishBidding();
  await new Promise(r => setTimeout(r, 200));

  if (room2.state === 'PLAYING') {
    const cp = room2.players[room2.currentPlayerIndex];
    const wrong = room2.players[(room2.currentPlayerIndex + 1) % 3];
    if (wrong.hand.length > 0) {
      room2.processPlay(wrong.id, [wrong.hand[0]]);
      check('非回合玩家不能出牌', room2.lastPlayedBy !== wrong.seatIndex);
    }
    if (cp.hand.length > 0) {
      room2.processPlay(cp.id, [cp.hand[0]]);
      check('回合玩家正常出牌', room2.lastPlayedBy === cp.seatIndex);
    }
  }

  // ── Test 3: Hand tracking across plays ───────────────────
  console.log('\n--- 手牌追踪 ---');
  const mockIo3 = makeMockIo();
  const room3 = new Room('HAND', mockIo3);
  room3.testMode = true;
  room3.addPlayer('human', '玩家');
  room3.startGame();
  await new Promise(r => setTimeout(r, 200));
  room3.startBidding();
  for (const p of room3.players) {
    room3.processBid(p.id, p.isBot ? 0 : 1);
  }
  if (room3.state === 'BIDDING') room3.finishBidding();
  await new Promise(r => setTimeout(r, 200));

  if (room3.state === 'PLAYING') {
    const human = room3.players[0];
    const handBefore = human.hand.length;

    // Force human to be current player
    if (room3.currentPlayerIndex === human.seatIndex) {
      const cardToPlay = human.hand[0];
      room3.processPlay(human.id, [cardToPlay]);
      check('出牌后手牌减少1张', human.hand.length === handBefore - 1,
        `was ${handBefore}, now ${human.hand.length}`);
      check('出牌手牌包含原牌', !human.hand.includes(cardToPlay));

      // Check your_hand_update was sent to human
      const msgs = mockIo3.playerMessages[human.id] || [];
      const handUpdates = msgs.filter(m => m.event === 'your_hand_update');
      check('服务器发送了hand_update', handUpdates.length > 0,
        `got ${handUpdates.length} updates`);
    }
  }

  // ── Test 4: Invalid play rejection ───────────────────────
  console.log('\n--- 无效出牌拒绝 ---');
  const mockIo4 = makeMockIo();
  const room4 = new Room('INV', mockIo4);
  room4.testMode = true;
  room4.addPlayer('human', '玩家');
  room4.startGame();
  await new Promise(r => setTimeout(r, 200));
  room4.startBidding();
  for (const p of room4.players) {
    room4.processBid(p.id, p.isBot ? 0 : 1);
  }
  if (room4.state === 'BIDDING') room4.finishBidding();
  await new Promise(r => setTimeout(r, 200));

  if (room4.state === 'PLAYING') {
    const human = room4.players[0];
    if (room4.currentPlayerIndex === human.seatIndex) {
      // Try to play a card not in hand
      const cardNotInHand = 100; // invalid card id
      room4.processPlay(human.id, [cardNotInHand]);
      check('手牌没有的牌被拒绝', room4.lastPlayedBy !== human.seatIndex);

      // Verify hand unchanged after rejected play
      const handAfterBadPlay = human.hand.length;
      // Play a valid card to advance
      if (human.hand.length > 0) {
        room4.processPlay(human.id, [human.hand[0]]);
        check('有效出牌成功', room4.lastPlayedBy === human.seatIndex);
      }
    }
  }

  // ── Test 5: Triple/Kicker pattern validation ─────────────
  console.log('\n--- 三带一/三带二验证 ---');
  // Simulate a hand with three 3s plus kickers
  const tripleHand = [
    0, 13, 26,       // 3♠ 3♥ 3♣ (three 3s)
    1, 14,           // 4♠ 4♥ (pair of 4s)
    2,               // 5♠ (single)
    4, 17, 30        // extra cards
  ];

  check('三条有效', validatePlay([0, 13, 26], tripleHand, null).valid);
  check('三带一(单张)', validatePlay([0, 13, 26, 2], tripleHand, null).valid);
  check('三带二(对子)', validatePlay([0, 13, 26, 1, 14], tripleHand, null).valid);

  // Can't play 333+4♠+5♠ as triple_plus_one (needs exactly one kicker)
  check('三带一不能带两张单', !validatePlay([0, 13, 26, 1, 2], tripleHand, null).valid);

  // ── Test 6: Can't play after turn ends ───────────────────
  console.log('\n--- 出牌后回合结束 ---');
  const mockIo6 = makeMockIo();
  const room6 = new Room('POST', mockIo6);
  room6.testMode = true;
  room6.addPlayer('human', '玩家');
  room6.startGame();
  await new Promise(r => setTimeout(r, 200));
  room6.startBidding();
  for (const p of room6.players) {
    room6.processBid(p.id, p.isBot ? 0 : 1);
  }
  if (room6.state === 'BIDDING') room6.finishBidding();
  await new Promise(r => setTimeout(r, 200));

  if (room6.state === 'PLAYING') {
    const human = room6.players[0];
    if (room6.currentPlayerIndex === human.seatIndex) {
      const card1 = human.hand[0];
      const handBefore = human.hand.length;

      // First play should work
      room6.processPlay(human.id, [card1]);
      const firstOk = room6.lastPlayedBy === human.seatIndex;
      check('第一次出牌成功', firstOk);

      // Second play from same player should be REJECTED (not their turn anymore)
      if (human.hand.length > 0 && room6.state === 'PLAYING') {
        const currentBefore = human.hand.length;
        const card2 = human.hand[0];

        // Since turn advanced, currentPlayerIndex should not be human
        if (room6.currentPlayerIndex !== human.seatIndex) {
          room6.processPlay(human.id, [card2]);
          // Should be rejected — lastPlayedBy should NOT change to human
          check('回合外不能再次出牌', room6.lastPlayedBy !== human.seatIndex,
            `lastPlayedBy=${room6.lastPlayedBy}, humanSeat=${human.seatIndex}`);
          check('回合外手牌不变', human.hand.length === currentBefore);
        }
      }
    }
  }

  // ── Test 7: Multiple full games ───────────────────────────
  console.log('\n--- 多局完整对战 ---');
  for (let i = 0; i < 3; i++) {
    await testFullGame();
  }

  console.log(`\n===== 总计: ${totalOk}通过 / ${totalFail}失败 =====`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
