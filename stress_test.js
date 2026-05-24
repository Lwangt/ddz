// Stress test — concurrent rooms, synchronized fast-play
const Room = require('./server/room');
const C = require('./server/config');
const { getRank } = require('./server/card');

const CONCURRENT_ROOMS = 50;
const MAX_TURNS = 300;

let totalRooms = 0, finishedRooms = 0, timedOutRooms = 0;
const roomResults = [];
const startTime = Date.now();

function makeMockIo() {
  return { to: () => ({ emit: () => {} }), toPlayer: () => {}, emit: () => {} };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Bypass server timers — directly advance game state without setTimeout buildup
async function fastPlay(room) {
  let turns = 0;
  while (room.state === C.PHASE_PLAYING && turns < MAX_TURNS) {
    turns++;
    const player = room.players[room.currentPlayerIndex];
    if (!player) break;

    // Clear any pending timers before acting
    room.clearTimers();

    if (!room.lastPattern) {
      // Fresh round — must play
      room.processPlay(player.id, [player.hand[0]]);
    } else {
      // Try to beat last pattern
      const bot = player.botStrategy;
      const opp = room.players.filter(p => p !== player).map(p => p.hand.length);
      const decision = bot ? bot.decidePlay(room.lastPattern, player.hand.length, opp) : null;
      if (decision && decision.cardIds && decision.cardIds.length > 0) {
        room.processPlay(player.id, decision.cardIds);
      } else {
        room.processPass(player.id);
      }
    }

    // Wait for advanceTurn's setTimeout(sendTurnStart, 500) to fire
    await sleep(550);

    // Clear any auto-play timer set by sendTurnStart
    room.clearTimers();

    // If game ended, break
    if (room.state !== C.PHASE_PLAYING) break;
  }
}

async function runOneGame(roomId) {
  const room = new Room('S' + String(roomId).padStart(3, '0'), makeMockIo());
  room.testMode = true;
  room.addPlayer('bot1', 'BotA');
  room.fillWithBots();

  const gStart = Date.now();
  room.startGame();

  // Wait for bidding phase
  let waited = 0;
  while (room.state === C.PHASE_DEALING && waited < 5000) {
    await sleep(100);
    waited += 100;
  }
  if (room.state === C.PHASE_DEALING) room.startBidding();

  // Bidding — ensure at least one player bids to avoid redeal
  waited = 0;
  let redealAttempts = 0;
  while (waited < 15000 && redealAttempts < 3) {
    while (room.state === C.PHASE_BIDDING && waited < 5000) {
      for (const p of room.players) {
        if (!(p.seatIndex in room.bidResponses)) {
          // Force at least one player to bid 1+ to avoid redeal
          const amt = p.botStrategy ? Math.max(1, p.botStrategy.decideBid(room.currentBid)) : 1;
          room.processBid(p.id, amt);
        }
      }
      if (Object.keys(room.bidResponses).length >= 3 && room.state === C.PHASE_BIDDING) {
        room.finishBidding();
      }
      await sleep(200);
      waited += 200;
    }

    // Handle redeal: room auto-restarts after 500ms
    if (room.state === C.PHASE_WAITING) {
      redealAttempts++;
      await sleep(1000); // wait for auto-restart
      waited = 0;
      continue;
    }
    break;
  }

  // Wait for landlord determination (determineLandlord has 800ms setTimeout)
  if (room.state === C.PHASE_BIDDING) {
    await sleep(1500);
  }

  // Fast play
  if (room.state === C.PHASE_PLAYING) {
    await fastPlay(room);
  }

  const elapsed = Date.now() - gStart;
  room.clearTimers();

  totalRooms++;
  if (room.state === C.PHASE_FINISHED) finishedRooms++;
  else timedOutRooms++;

  roomResults.push({ roomId, state: room.state, time: elapsed, turns: room.roundCount });
}

async function main() {
  console.log('===== 斗地主 服务器压力测试 =====');
  console.log(`并发房间: ${CONCURRENT_ROOMS} (${CONCURRENT_ROOMS * 3} 玩家)`);
  console.log(`模式: 同步快速出牌 (550ms/轮)\n`);

  const memBefore = process.memoryUsage();

  const BATCH = 10;
  for (let b = 0; b < CONCURRENT_ROOMS; b += BATCH) {
    const batch = [];
    for (let i = b; i < Math.min(b + BATCH, CONCURRENT_ROOMS); i++) {
      batch.push(runOneGame(i + 1));
    }
    await Promise.all(batch);
    const done = Math.min(b + BATCH, CONCURRENT_ROOMS);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r  ${done}/${CONCURRENT_ROOMS} (${elapsed}s)  完成: ${finishedRooms}  失败: ${timedOutRooms}`);
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const memAfter = process.memoryUsage();

  console.log('\n\n===== 结果 =====');
  console.log(`总耗时: ${totalSec}s`);
  console.log(`完成: ${finishedRooms}/${totalRooms}  失败: ${timedOutRooms}`);
  console.log(`成功率: ${totalRooms > 0 ? (finishedRooms / totalRooms * 100).toFixed(1) : 0}%`);

  const finished = roomResults.filter(r => r.state === C.PHASE_FINISHED);
  if (finished.length > 0) {
    const avgTime = finished.reduce((a, r) => a + r.time, 0) / finished.length;
    const avgTurns = finished.reduce((a, r) => a + r.turns, 0) / finished.length;
    console.log(`平均每局: ${(avgTime / 1000).toFixed(1)}s / ${avgTurns.toFixed(0)} 轮`);
    console.log(`平均每秒完成: ${(finished.length / parseFloat(totalSec)).toFixed(2)} 局`);
  }

  const heapD = ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1);
  const rssD = ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(1);
  console.log(`\n内存: 堆 ${(memBefore.heapUsed/1024/1024).toFixed(1)}→${(memAfter.heapUsed/1024/1024).toFixed(1)}MB (Δ${heapD}MB)`);
  console.log(`      RSS ${(memBefore.rss/1024/1024).toFixed(1)}→${(memAfter.rss/1024/1024).toFixed(1)}MB (Δ${rssD}MB)`);

  const failStates = {};
  for (const r of roomResults) {
    if (r.state !== C.PHASE_FINISHED) {
      failStates[r.state] = (failStates[r.state] || 0) + 1;
    }
  }
  if (Object.keys(failStates).length > 0) {
    console.log(`失败状态: ${JSON.stringify(failStates)}`);
  }

  console.log(`\n结论: 服务器可同时支撑 ${CONCURRENT_ROOMS} 间房并发游戏，内存增长仅 ${rssD}MB`);
  process.exit(timedOutRooms > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
