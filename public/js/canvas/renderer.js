// Enhanced master renderer with player highlights, improved timer, and visual polish
const GameRenderer = (() => {
  let ctx = null;
  let gameState = null;

  const PATTERN_LABELS = {
    'rocket': '🚀 火箭', 'bomb': '💣 炸弹', 'single': '单张', 'pair': '对子',
    'triple': '三条', 'triple_plus_one': '三带一', 'triple_plus_two': '三带二',
    'four_plus_two_single': '四带二', 'four_plus_two_pair': '四带二',
    'straight': '顺子', 'straight_pairs': '连对', 'airplane': '飞机',
    'airplane_wing_single': '飞机带单', 'airplane_wing_pair': '飞机带双',
  };

  function init(context, state) {
    ctx = context;
    gameState = state;
  }

  function draw() {
    if (!ctx || !gameState) return;

    const W = Layout.cssW();
    const H = Layout.cssH();

    ctx.save();
    // Fill game area background (letterbox drawn before us)
    ctx.fillStyle = '#0a4a1c';
    ctx.fillRect(0, 0, W, H);
    drawBackground(W, H);
    drawGhostTurnIndicator();
    drawInfoBar();
    drawScoreBoard();
    drawOpponents();
    drawBidResults();
    drawPlayerActions();
    drawPlayArea();
    drawBonusCards();
    drawOwnHand();
    drawButtons();
    drawTimerBar();
    drawToast();
    drawEffects();
    ctx.restore();
  }

  // ── Background ───────────────────────────────────────────

  function drawBackground(W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
    grad.addColorStop(0, '#1a7a2e');
    grad.addColorStop(0.5, '#0f5a1e');
    grad.addColorStop(1, '#062e10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Table felt texture circles
    ctx.strokeStyle = 'rgba(255,255,255,0.012)';
    ctx.lineWidth = 0.5;
    const step = 36 * Layout.scale();
    for (let x = step; x < W; x += step) {
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, step * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── Ghost turn indicator (pulsing background for current player area) ──

  function drawGhostTurnIndicator() {
    const s = gameState;
    if (s.phase !== 'PLAYING') return;
    const cp = s.currentPlayerIndex;
    if (cp < 0) return;

    const dispPos = (cp - s.mySeat + 3) % 3;
    let area;
    if (dispPos === 0) area = Layout.p0Area();
    else if (dispPos === 1) area = Layout.p1Area();
    else area = Layout.p2Area();

    if (!area) return;
    const pulse = 0.04 + 0.03 * Math.sin(Date.now() / 600);
    ctx.fillStyle = `rgba(255,215,0,${pulse})`;
    ctx.fillRect(area.x, area.y, area.w, area.h);
  }

  // ── Info bar ─────────────────────────────────────────────

  function drawInfoBar() {
    const s = gameState;
    const ib = Layout.infoBar();
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(ib.x, ib.y, ib.w, ib.h);

    ctx.textBaseline = 'middle';
    const fontSize = isMob ? 11 * sc : 13 * sc;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;

    let x = 12 * sc;

    // Room code badge
    if (s.roomCode) {
      const txt = `房间 ${s.roomCode}`;
      const tw = ctx.measureText(txt).width + 16 * sc;
      drawBadge(x, ib.y + ib.h / 2 - 8 * sc, tw, 20 * sc, 'rgba(255,255,255,0.15)');
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, x + 8 * sc, ib.y + ib.h / 2);
      x += tw + 12 * sc;
    }

    // Phase info
    if (s.phase === 'BIDDING') {
      const bidText = `叫地主  ${s.currentBid || 0}分`;
      const tw = ctx.measureText(bidText).width + 16 * sc;
      drawBadge(x, ib.y + ib.h / 2 - 8 * sc, tw, 20 * sc, 'rgba(255,193,7,0.2)');
      ctx.fillStyle = '#ffc107';
      ctx.fillText(bidText, x + 8 * sc, ib.y + ib.h / 2);
      x += tw + 12 * sc;
    }

    if (s.phase === 'PLAYING' || s.phase === 'FINISHED') {
      const base = Math.max(s.currentBid || 0, 1);
      const mText = `底分 ${base}  倍数 ×${s.multiplier}`;
      const tw = ctx.measureText(mText).width + 16 * sc;
      const bg = s.multiplier >= 4 ? 'rgba(255,82,82,0.25)' : 'rgba(255,255,255,0.12)';
      drawBadge(x, ib.y + ib.h / 2 - 8 * sc, tw, 20 * sc, bg);
      ctx.fillStyle = s.multiplier >= 4 ? '#ff8a80' : '#fff';
      ctx.fillText(mText, x + 8 * sc, ib.y + ib.h / 2);
      x += tw + 12 * sc;
    }

    ctx.textBaseline = 'alphabetic';
  }

  function drawBadge(x, y, w, h, color) {
    ctx.fillStyle = color;
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // ── Opponents ────────────────────────────────────────────

  function drawBidResults() {
    const s = gameState;
    if (!s.bidResults || s.bidResults.length === 0) return;
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction
    const pa = Layout.playArea();
    const now = Date.now();

    // Filter to results shown in last 5 seconds
    const recent = s.bidResults.filter(r => now - r.time < 5000);
    if (recent.length === 0) return;

    // Show each bid result as a floating label in the center area
    const startY = pa.y + pa.h * 0.15;
    const lineH = isMob ? 24 * sc : 28 * sc;

    ctx.textAlign = 'center';
    ctx.font = `bold ${isMob ? 13 : 16 * sc}px "Microsoft YaHei", sans-serif`;

    for (let i = 0; i < recent.length; i++) {
      const r = recent[i];
      const elapsed = now - r.time;
      const alpha = elapsed < 4000 ? 1 : Math.max(0, 1 - (elapsed - 4000) / 1000);
      const label = r.amount > 0 ? `${r.playerName}：叫 ${r.amount} 分` : `${r.playerName}：不叫`;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = r.amount > 0 ? '#ffd700' : 'rgba(255,255,255,0.5)';
      ctx.fillText(label, pa.x + pa.w / 2, startY + i * lineH);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'start';

    // Clean up expired results
    s.bidResults = recent;
  }

  function drawScoreBoard() {
    const s = gameState;
    if (!s.players || s.players.length === 0) return;
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction
    const ib = Layout.infoBar();

    // Position: right side of info bar
    const fontSize = isMob ? 10 : 13;
    ctx.font = `bold ${fontSize * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'middle';

    let x = Layout.cssW() - 10 * sc;
    for (let i = s.players.length - 1; i >= 0; i--) {
      const p = s.players[i];
      const label = p.name.slice(0, 3) + ': ' + (p.score >= 0 ? '+' : '') + p.score;
      const tw = ctx.measureText(label).width;
      x -= tw + 20 * sc;
      ctx.fillStyle = p.seatIndex === s.mySeat ? '#ffd700' : 'rgba(255,255,255,0.7)';
      ctx.fillText(label, x, ib.y + ib.h / 2);
      x -= 4 * sc;
    }
    ctx.textBaseline = 'alphabetic';
  }

  function drawOpponents() {
    const s = gameState;
    const mySeat = s.mySeat;

    for (const player of s.players) {
      if (player.seatIndex === mySeat) continue;
      const dispPos = (player.seatIndex - mySeat + 3) % 3;
      if (dispPos === 2) drawTopOpponent(player);
      else if (dispPos === 1) drawLeftOpponent(player);
    }
  }

  function drawTopOpponent(player) {
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction
    const area = Layout.p2Area();
    const positions = Layout.getOpponentHPositions(player.cardCount);
    const isActive = player.seatIndex === gameState.currentPlayerIndex && gameState.phase === 'PLAYING';

    // Name with status
    let nameStr = player.name;
    if (player.isLandlord) nameStr = '👑 ' + nameStr;
    if (!player.isConnected) nameStr += ' 🔴';

    ctx.font = `bold ${isMob ? 11 : 14 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.8)';
      ctx.shadowBlur = 8 * sc;
      ctx.fillStyle = '#ffd700';
    } else {
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fff';
    }
    ctx.fillText(nameStr, area.x + area.w / 2, area.y - 2 * sc);
    ctx.shadowColor = 'transparent';

    // Card count badge
    ctx.font = `${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${player.cardCount}张`, area.x + area.w / 2,
      area.y + area.h - 4 * sc);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Card backs
    for (const pos of positions) {
      CardDrawer.drawCardBack(ctx, pos.x, pos.y, pos.w, pos.h);
    }
  }

  function drawLeftOpponent(player) {
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction
    const area = Layout.p1Area();
    const positions = Layout.getOpponentVPositions(player.cardCount);
    const isActive = player.seatIndex === gameState.currentPlayerIndex && gameState.phase === 'PLAYING';

    // Name below cards
    let nameStr = player.name;
    if (player.isLandlord) nameStr = '👑 ' + nameStr;
    if (!player.isConnected) nameStr += ' 🔴';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${isMob ? 11 : 14 * sc}px "Microsoft YaHei", sans-serif`;

    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.8)';
      ctx.shadowBlur = 8 * sc;
      ctx.fillStyle = '#ffd700';
    } else {
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fff';
    }

    const nameX = area.x + area.w / 2;
    const nameY = area.y + area.h + 8 * sc;
    ctx.fillText(nameStr, nameX, nameY);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`${player.cardCount}张`, nameX, nameY + 16 * sc);
    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Rotated card backs
    for (const pos of positions) {
      ctx.save();
      ctx.translate(pos.x + pos.h / 2, pos.y + pos.w / 2);
      ctx.rotate(-Math.PI / 2);
      CardDrawer.drawCardBack(ctx, -pos.w / 2, -pos.h / 2, pos.w, pos.h);
      ctx.restore();
    }
  }

  // ── Play area ─────────────────────────────────────────────

  function drawPlayerActions() {
    const s = gameState;
    if (!s.playerLastActions || s.phase !== 'PLAYING') return;
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction
    const cw = Layout.cardW(), ch = Layout.cardH();

    for (const player of s.players) {
      const lastAct = s.playerLastActions[player.seatIndex];
      if (!lastAct) continue;

      const dispPos = player.seatIndex === s.mySeat ? 0 : (player.seatIndex - s.mySeat + 3) % 3;
      const zone = Layout.getActionZone(dispPos);

      if (lastAct.action === 'pass') {
        // Show "不出" centered in zone
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `bold ${isMob ? 13 : 16 * sc}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('不出', zone.x + zone.w / 2, zone.y + zone.h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      } else if (lastAct.action === 'play' && lastAct.cardIds) {
        // Show played cards (smaller, face-up) + pattern name
        const smallW = cw * 0.6;
        const smallH = ch * 0.6;
        const count = lastAct.cardIds.length;
        const spacing = Math.min(smallW * 0.4, (zone.w - smallW) / Math.max(count - 1, 1));
        const totalW = smallW + (count - 1) * spacing;
        const startX = zone.x + (zone.w - totalW) / 2;
        const startY = zone.y + 2 * sc;

        // Pattern label above the cards
        if (lastAct.pattern) {
          const patName = PATTERN_LABELS[lastAct.pattern.type] || lastAct.pattern.type;
          ctx.fillStyle = 'rgba(255,215,0,0.8)';
          ctx.font = `bold ${isMob ? 9 : 10 * sc}px "Microsoft YaHei", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(patName, zone.x + zone.w / 2, startY - 2 * sc);
          ctx.textAlign = 'start';
        }

        // Draw small cards
        for (let i = 0; i < count; i++) {
          CardDrawer.drawCardFace(ctx, lastAct.cardIds[i],
            startX + i * spacing, startY, smallW, smallH, false);
        }
      }
    }
  }

  function drawPlayArea() {
    const s = gameState;
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction

    // Show each player's last play or "pass" status
    // We use lastPlayedCards + passCount to determine what to show
    if (s.lastPlayedCards && s.lastPlayedCards.length > 0 && s.lastPlayedBy >= 0) {
      const player = s.players.find(p => p.seatIndex === s.lastPlayedBy);
      const dispPos = (s.lastPlayedBy - s.mySeat + 3) % 3;
      const positions = Layout.getPlayedCardPositions(s.lastPlayedCards, dispPos);

      // Player name above cards
      if (player) {
        const pos = positions[0];
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${13 * sc}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name + ' 出牌', pos.x + pos.w / 2,
          pos.y - 4 * sc);
        ctx.textAlign = 'start';
      }

      // Pattern label
      if (s.lastPattern) {
        const lbl = PATTERN_LABELS[s.lastPattern.type] || s.lastPattern.type;
        ctx.font = `bold ${isMob ? 9 : 11 * sc}px "Microsoft YaHei", sans-serif`;
        const tw = ctx.measureText(lbl).width;
        const pos = positions[Math.floor(positions.length / 2)];
        const bx = pos.x + pos.w / 2 - tw / 2 - 6 * sc;
        const by = pos.y + positions[0].h + 2 * sc;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const r = 4 * sc;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + tw + 12 * sc - r, by);
        ctx.arcTo(bx + tw + 12 * sc, by, bx + tw + 12 * sc, by + r, r);
        ctx.lineTo(bx + tw + 12 * sc, by + 16 * sc - r);
        ctx.arcTo(bx + tw + 12 * sc, by + 16 * sc, bx + tw + 12 * sc - r, by + 16 * sc, r);
        ctx.lineTo(bx + r, by + 16 * sc);
        ctx.arcTo(bx, by + 16 * sc, bx, by + 16 * sc - r, r);
        ctx.lineTo(bx, by + r);
        ctx.arcTo(bx, by, bx + r, by, r);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, bx + tw / 2 + 6 * sc, by + 11 * sc);
        ctx.textAlign = 'start';
      }

      // Draw cards
      for (let i = 0; i < s.lastPlayedCards.length; i++) {
        CardDrawer.drawCardFace(ctx, s.lastPlayedCards[i],
          positions[i].x, positions[i].y, positions[i].w, positions[i].h, false);
      }
    }

    // Show pass markers — display which players said "不出"
    if (s.passCount > 0) {
      const pa = Layout.playArea();
      const passPlayer = s.players[s.currentPlayerIndex]; // last player who acted
      ctx.font = `bold ${isMob ? 12 : 15 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textBaseline = 'middle';
      const txt = s.passCount >= 2 ? '不出 ×2' : '不出';
      ctx.fillText(txt, pa.x + pa.w / 4, pa.y + pa.h * 0.7);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ── Bonus cards ──────────────────────────────────────────

  function drawBonusCards() {
    const s = gameState;
    // Show bonus cards in DEALING, BIDDING, and at the start of PLAYING
    if (s.phase === 'WAITING' || s.phase === 'FINISHED') return;
    if (!s.bonusCards || s.bonusCards.length === 0) return;

    const positions = Layout.getBonusCardPositions();
    const isMob = false; // unified layout, no mobile distinction
    const sc = Layout.scale();

    // After landlord is determined, show cards face-up; during bidding show face-down
    const showFaceUp = s.phase === 'PLAYING';

    for (let i = 0; i < s.bonusCards.length; i++) {
      if (showFaceUp) {
        CardDrawer.drawCardFace(ctx, s.bonusCards[i],
          positions[i].x, positions[i].y, positions[i].w, positions[i].h, false);
      } else {
        CardDrawer.drawCardBack(ctx, positions[i].x, positions[i].y,
          positions[i].w, positions[i].h);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('底牌', positions[1].x + positions[1].w / 2,
      positions[1].y + positions[1].h + 14 * sc);
    ctx.textAlign = 'start';
  }

  // ── Own hand ─────────────────────────────────────────────

  function drawOwnHand() {
    const s = gameState;
    if (!s.hand || s.hand.length === 0) return;

    const positions = Layout.getHandPositions(s.hand.length);
    const isMob = false; // unified layout, no mobile distinction
    const sc = Layout.scale();

    // Card count indicator
    const p0 = Layout.p0Area();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.hand.length}张`, p0.x + p0.w / 2, p0.y - 2 * sc);
    ctx.textAlign = 'start';

    // Selected count
    if (s.selectedCards && s.selectedCards.size > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`已选 ${s.selectedCards.size} 张`,
        p0.x + p0.w - 60 * sc, p0.y - 2 * sc);
    }

    for (let i = 0; i < s.hand.length; i++) {
      const selected = s.selectedCards && s.selectedCards.has(i);
      CardDrawer.drawCardFace(ctx, s.hand[i],
        positions[i].x, positions[i].y, positions[i].w, positions[i].h, selected);
    }
  }

  // ── Buttons ──────────────────────────────────────────────

  function drawButtons() {
    const s = gameState;
    const area = Layout.buttonArea();
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction

    const btns = getButtonLayout();
    s._buttonLayout = btns;

    for (const btn of btns) {
      const r = btn.h / 2; // pill shape

      // Shadow
      if (!btn.disabled) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4 * sc;
        ctx.shadowOffsetY = 2 * sc;
      }

      // Background gradient
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (btn.disabled) {
        grad.addColorStop(0, 'rgba(255,255,255,0.06)');
        grad.addColorStop(1, 'rgba(255,255,255,0.04)');
      } else if (btn.type === 'primary') {
        grad.addColorStop(0, '#FF9800');
        grad.addColorStop(1, '#F57C00');
      } else if (btn.type === 'danger') {
        grad.addColorStop(0, '#EF5350');
        grad.addColorStop(1, '#D32F2F');
      } else if (btn.type === 'bid') {
        grad.addColorStop(0, '#42A5F5');
        grad.addColorStop(1, '#1E88E5');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,0.18)');
        grad.addColorStop(1, 'rgba(255,255,255,0.10)');
      }
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(btn.x + r, btn.y);
      ctx.lineTo(btn.x + btn.w - r, btn.y);
      ctx.arcTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + r, r);
      ctx.lineTo(btn.x + btn.w, btn.y + btn.h - r);
      ctx.arcTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - r, btn.y + btn.h, r);
      ctx.lineTo(btn.x + r, btn.y + btn.h);
      ctx.arcTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - r, r);
      ctx.lineTo(btn.x, btn.y + r);
      ctx.arcTo(btn.x, btn.y, btn.x + r, btn.y, r);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent';

      // Top highlight
      if (!btn.disabled) {
        const hl = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h * 0.45);
        hl.addColorStop(0, 'rgba(255,255,255,0.3)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.fill();
      }

      // Border
      ctx.strokeStyle = btn.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.2 * sc;
      ctx.stroke();

      // Text
      ctx.fillStyle = btn.disabled ? 'rgba(255,255,255,0.25)'
        : ((btn.type === 'primary' || btn.type === 'danger' || btn.type === 'bid') ? '#fff' : '#fff');
      ctx.font = `bold ${isMob ? 13 : 16 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  function getButtonLayout() {
    const s = gameState;
    const area = Layout.buttonArea();
    const sc = Layout.scale();
    const btns = [];

    if (s.phase === 'BIDDING' && s.myTurn) {
      const labels = ['不叫', '1分', '2分', '3分'];
      const types = ['secondary', 'bid', 'primary', 'danger'];
      const bW = (area.w - 9 * sc) / 4;
      for (let i = 0; i < 4; i++) {
        btns.push({
          id: i === 0 ? 'bid_0' : `bid_${i}`,
          label: labels[i],
          x: area.x + i * (bW + 3 * sc),
          y: area.y,
          w: bW,
          h: area.h,
          type: types[i],
          disabled: false
        });
      }
    } else if (s.phase === 'PLAYING' && s.myTurn) {
      const bW = (area.w - 8 * sc) / 3;
      btns.push({
        id: 'play', label: '出牌', x: area.x, y: area.y,
        w: bW, h: area.h, type: 'primary',
        disabled: !s.selectedCards || s.selectedCards.size === 0
      });
      btns.push({
        id: 'pass', label: '不出', x: area.x + bW + 4 * sc, y: area.y,
        w: bW, h: area.h, type: 'secondary', disabled: !s.canPass
      });
      btns.push({
        id: 'hint', label: '提示', x: area.x + 2 * (bW + 4 * sc), y: area.y,
        w: bW, h: area.h, type: 'secondary', disabled: false
      });
    } else if (s.phase === 'PLAYING' && !s.myTurn) {
      const cp = s.players.find(p => p.seatIndex === s.currentPlayerIndex);
      const name = cp ? cp.name : '';
      btns.push({
        id: 'waiting', label: `${name} 正在出牌...`,
        x: area.x, y: area.y, w: area.w, h: area.h,
        type: 'secondary', disabled: true
      });
    }

    return btns;
  }

  // ── Timer bar ────────────────────────────────────────────

  function drawTimerBar() {
    const s = gameState;
    if (!s.turnTimeLeft || s.turnTimeLeft <= 0) return;
    if (!s.myTurn) return;

    const area = Layout.timerArea();
    const progress = s.turnTimeLeft / s.turnTimeTotal;
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction

    // Background track
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(area.x, area.y, area.w, area.h);

    // Color gradient based on remaining time
    let color;
    if (progress > 0.6) color = '#4caf50';
    else if (progress > 0.25) color = '#ffc107';
    else color = '#ff5252';

    // Progress fill
    const fillW = area.w * progress;
    const grad = ctx.createLinearGradient(area.x, 0, area.x + fillW, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(1, progress < 0.25 ? '#ff1744' : color);
    ctx.fillStyle = grad;
    ctx.fillRect(area.x, area.y, fillW, area.h);

    // Pulsing effect when low
    if (progress < 0.25) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
      ctx.fillStyle = `rgba(255,23,68,${pulse})`;
      ctx.fillRect(area.x, area.y, fillW, area.h);
    }

    // Timer text
    const secs = Math.ceil(s.turnTimeLeft);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${isMob ? 14 : 18 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${secs}s`, area.x + area.w / 2, area.y - 4 * sc);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Toast system ─────────────────────────────────────────

  function drawToast() {
    const s = gameState;
    if (!s._toast || !s._toast.text) return;

    const elapsed = Date.now() - s._toast.startTime;
    if (elapsed > s._toast.duration) {
      s._toast = null;
      return;
    }

    const area = Layout.toastArea();
    const sc = Layout.scale();
    const isMob = false; // unified layout, no mobile distinction

    // Fade in/out
    let alpha = 1;
    const fadeMs = 400;
    if (elapsed < fadeMs) alpha = elapsed / fadeMs;
    else if (elapsed > s._toast.duration - fadeMs) {
      alpha = (s._toast.duration - elapsed) / fadeMs;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const tw = Math.min(area.w, ctx.measureText(s._toast.text).width + 40 * sc);
    const bx = area.x + (area.w - tw) / 2;
    const r = area.h / 2;
    ctx.beginPath();
    ctx.moveTo(bx + r, area.y);
    ctx.lineTo(bx + tw - r, area.y);
    ctx.arcTo(bx + tw, area.y, bx + tw, area.y + r, r);
    ctx.lineTo(bx + tw, area.y + area.h - r);
    ctx.arcTo(bx + tw, area.y + area.h, bx + tw - r, area.y + area.h, r);
    ctx.lineTo(bx + r, area.y + area.h);
    ctx.arcTo(bx, area.y + area.h, bx, area.y + area.h - r, r);
    ctx.lineTo(bx, area.y + r);
    ctx.arcTo(bx, area.y, bx + r, area.y, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${isMob ? 12 : 14 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s._toast.text, bx + tw / 2, area.y + area.h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  // ── Special effects ──────────────────────────────────────

  let flashAlpha = 0;
  let particles = [];
  let lastBombTime = 0;
  let lastWinTime = 0;

  function triggerBombFlash() {
    flashAlpha = 0.35;
    lastBombTime = Date.now();
  }

  function triggerWinParticles(W, H) {
    lastWinTime = Date.now();
    const sc = Layout.scale();
    particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: W * 0.1 + Math.random() * W * 0.8,
        y: H * 0.3 + Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 4 * sc,
        vy: -Math.random() * 6 * sc - 2 * sc,
        life: 1,
        size: 3 * sc + Math.random() * 5 * sc,
        color: ['#ffd700', '#ff6b6b', '#4caf50', '#2196f3', '#ff9800'][Math.floor(Math.random() * 5)]
      });
    }
  }

  function drawEffects() {
    const W = Layout.cssW();
    const H = Layout.cssH();
    const s = gameState;
    const now = Date.now();

    // Bomb flash
    if (flashAlpha > 0) {
      const elapsed = (now - lastBombTime) / 1000;
      flashAlpha = Math.max(0, 0.35 - elapsed * 0.5);
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 50, 50, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        // Also slight shake via shadow
        const shake = Math.sin(elapsed * 60) * 4 * flashAlpha;
        ctx.translate(shake, 0);
      }
    }

    // Win particles
    if (particles.length > 0) {
      const elapsed = (now - lastWinTime) / 1000;
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.life -= 0.015;
        if (p.life <= 0) continue;
        alive = true;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (!alive) particles = [];
    }
  }

  // Expose effect triggers
  window.triggerBombEffect = triggerBombFlash;
  window.triggerWinEffect = () => triggerWinParticles(Layout.cssW(), Layout.cssH());

  return { init, draw };
})();
