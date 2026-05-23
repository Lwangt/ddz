// Comprehensive multi-game test — full game flow with bots
const Room = require('./server/room');
const { identifyPattern, canBeat, validatePlay } = require('./server/patterns');
const { getRank } = require('./server/card');
const C = require('./server/config');

let totalOk = 0, totalFail = 0, gameNum = 0;

function check(name, cond, detail) {
  if (cond) { totalOk++; } else { totalFail++; console.log('    ❌ ' + name + (detail ? ': ' + detail : '')); }
}

const mockIo = {
  to: (room) => ({ emit: () => {} })
};

function runOneGame() {
  gameNum++;
  const room = new Room('G' + gameNum, mockIo);
  room.testMode = true;
  room.addPlayer('human', '玩家');
  room.startGame();

  return new Promise((resolve) => {
    // Wait for DEALING state, then start bidding
    function check() {
      if (room.state === C.PHASE_DEALING) {
        room.startBidding();
        setTimeout(() => resolve(room), 100);
      } else if (room.state === C.PHASE_BIDDING) {
        resolve(room);
      } else {
        setTimeout(check, 50);
      }
    }
    setTimeout(check, 100);
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
    // Wait for startBidding to fire (it has a setTimeout(1500) in startGame)
    await waitForState(room, [C.PHASE_BIDDING], 3000);

    setTimeout(() => {
      if (room.state !== C.PHASE_BIDDING) { resolve(); return; }
      // Process bot bids
      for (const p of room.players) {
        if (p.isBot && p.botStrategy && !(p.seatIndex in room.bidResponses)) {
          const amt = p.botStrategy.decideBid(room.currentBid);
          room.processBid(p.id, amt);
        }
      }
      // Human auto-bids
      const human = room.players[0];
      if (human && !human.isBot && !(0 in room.bidResponses)) {
        const strength = human.botStrategy ? human.botStrategy.evaluateHandStrength() : 50;
        room.processBid(human.id, strength >= 50 ? 2 : 1);
      }
      // Finish bidding
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
  const room = await runOneGame();
  if (!room) return;

  // Basic structure
  check('testMode启用', room.testMode === true);
  check('3名玩家', room.players.length === 3);
  check('2个bots', room.players.filter(p => p.isBot).length === 2);
  check('每人17张牌', room.players.every(p => p.hand.length === 17));
  check('3张底牌', room.bonusCards.length === 3);

  // Bidding
  await bidPhase(room);

  // Wait for landlord determination (800ms after finishBidding)
  await waitForState(room, [C.PHASE_PLAYING, C.PHASE_FINISHED, C.PHASE_WAITING], 3000);

  // Check landlord AFTER the async transition
  const landlord = room.players.find(p => p.isLandlord);
  check('地主已确定', !!landlord, 'highestBidder=' + room.highestBidderIndex + ' currentBid=' + room.currentBid);
  if (landlord) {
    check('地主20张牌', landlord.hand.length === 20);
    check('农民17张牌', room.players.filter(p => !p.isLandlord).every(p => p.hand.length === 17));
  }

  // Playing
  await playPhase(room, 60);

  if (room.state === 'FINISHED') {
    check('游戏正常结束', true);
    check('有积分变化', room.players.some(p => p.score !== 0));
    check('积分总和为0', room.players.reduce((s, p) => s + p.score, 0) === 0);
  } else {
    check('游戏正常结束', false, 'state=' + room.state + ' after 60 rounds');
  }

  // Record scores
  const scores = room.players.map(p => p.name + ':' + p.score).join(' ');
  console.log('  积分: ' + scores + ' | 状态: ' + room.state + ' | 倍数: ' + room.multiplier);
}

// Run multiple games
async function main() {
  console.log('===== 斗地主 完整联机模拟测试 =====\n');

  // Test 1: Card validation
  console.log('--- 牌型验证 ---');
  const testHand = [0,13,26,39, 1,14,27, 2,15, 3,16, 4,17, 5,18, 6,19, 7, 8, 9, 10, 11, 12, 51, 52, 53];

  // Valid plays
  check('出单张', validatePlay([0], testHand, null).valid);
  check('出对子', validatePlay([0, 13], testHand, null).valid);
  check('出三条', validatePlay([0, 13, 26], testHand, null).valid);
  check('出炸弹', validatePlay([0, 13, 26, 39], testHand, null).valid);
  check('出火箭', validatePlay([52, 53], testHand, null).valid);
  check('出三带一', validatePlay([0, 13, 26, 1], testHand, null).valid);

  // Invalid plays
  check('出3344两对应拒绝', !validatePlay([0, 13, 1, 14], testHand, null).valid);
  check('手牌没有的牌', !validatePlay([100], testHand, null).valid);

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

  // Test 2: Turn management
  console.log('\n--- 回合管理 ---');
  const room2 = new Room('TURN', mockIo);
  room2.testMode = true;
  room2.addPlayer('human', '玩家');
  room2.startGame();
  await new Promise(r => setTimeout(r, 200));
  room2.startBidding();
  // Force bids
  for (const p of room2.players) {
    room2.processBid(p.id, p.isBot ? 0 : 1);
  }
  if (room2.state === 'BIDDING') room2.finishBidding();
  await new Promise(r => setTimeout(r, 200));

  if (room2.state === 'PLAYING') {
    const cp = room2.players[room2.currentPlayerIndex];
    const wrong = room2.players[(room2.currentPlayerIndex + 1) % 3];
    // Wrong player tries to play
    if (wrong.hand.length > 0) {
      room2.processPlay(wrong.id, [wrong.hand[0]]);
      check('非回合玩家不能出牌', room2.lastPlayedBy !== wrong.seatIndex);
    }
    // Correct player plays
    if (cp.hand.length > 0) {
      room2.processPlay(cp.id, [cp.hand[0]]);
      check('回合玩家正常出牌', room2.lastPlayedBy === cp.seatIndex);
    }
  }

  // Test 3: Multiple full games
  console.log('\n--- 多局完整对战 ---');
  for (let i = 0; i < 3; i++) {
    await testFullGame();
  }

  console.log(`\n===== 总计: ${totalOk}通过 / ${totalFail}失败 =====`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
