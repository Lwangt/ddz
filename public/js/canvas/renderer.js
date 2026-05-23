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
    // Rich dark green felt — radial with subtle off-center glow
    const grad = ctx.createRadialGradient(W * 0.45, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.9);
    grad.addColorStop(0, '#1d4a28');
    grad.addColorStop(0.4, '#14381e');
    grad.addColorStop(0.75, '#0c2414');
    grad.addColorStop(1, '#061a0c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle diagonal shimmer lines
    const sc = Layout.scale();
    ctx.strokeStyle = 'rgba(255,255,255,0.008)';
    ctx.lineWidth = 0.5 * sc;
    const step = 48 * sc;
    for (let i = -H; i < W + H; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - H, H);
      ctx.stroke();
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
    const pulse = 0.03 + 0.025 * Math.sin(Date.now() / 500);
    ctx.fillStyle = `rgba(255,215,0,${pulse})`;
    const r = 8 * Layout.scale();
    rr(area.x, area.y, area.w, area.h, r);
  }

  function rr(x, y, w, h, r) {
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

  // ── Info bar ─────────────────────────────────────────────

  function drawInfoBar() {
    const s = gameState;
    const ib = Layout.infoBar();
    const sc = Layout.scale();

    // Glass-morphism panel
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const r = 6 * sc;
    ctx.beginPath();
    ctx.moveTo(ib.x + r, ib.y);
    ctx.lineTo(ib.x + ib.w - r, ib.y);
    ctx.arcTo(ib.x + ib.w, ib.y, ib.x + ib.w, ib.y + r, r);
    ctx.lineTo(ib.x + ib.w, ib.y + ib.h);
    ctx.lineTo(ib.x, ib.y + ib.h);
    ctx.lineTo(ib.x, ib.y + r);
    ctx.arcTo(ib.x, ib.y, ib.x + r, ib.y, r);
    ctx.closePath();
    ctx.fill();

    // Subtle top highlight line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ib.x + r, ib.y + 1);
    ctx.lineTo(ib.x + ib.w - r, ib.y + 1);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.font = `bold ${12 * sc}px "Microsoft YaHei", sans-serif`;

    let x = 14 * sc;

    if (s.roomCode) {
      const txt = `房间 ${s.roomCode}`;
      const tw = ctx.measureText(txt).width + 14 * sc;
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, 'rgba(255,255,255,0.1)');
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(txt, x + 7 * sc, ib.y + ib.h / 2);
      x += tw + 10 * sc;
    }

    if (s.phase === 'BIDDING') {
      const bidText = `叫地主  ${s.currentBid || 0}分`;
      const tw = ctx.measureText(bidText).width + 14 * sc;
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, 'rgba(255,193,7,0.18)');
      ctx.fillStyle = '#ffc107';
      ctx.fillText(bidText, x + 7 * sc, ib.y + ib.h / 2);
      x += tw + 10 * sc;
    }

    if (s.phase === 'PLAYING' || s.phase === 'FINISHED') {
      const base = Math.max(s.currentBid || 0, 1);
      const mText = `底分 ${base}  倍数 ×${s.multiplier}`;
      const tw = ctx.measureText(mText).width + 14 * sc;
      const bg = s.multiplier >= 4 ? 'rgba(255,82,82,0.22)' : 'rgba(255,255,255,0.08)';
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, bg);
      ctx.fillStyle = s.multiplier >= 4 ? '#ffa0a0' : '#e0e0e0';
      ctx.fillText(mText, x + 7 * sc, ib.y + ib.h / 2);
    }

    ctx.textBaseline = 'alphabetic';
  }

  function drawPill(x, y, w, h, color) {
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
    const ib = Layout.infoBar();

    ctx.font = `bold ${12 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'middle';

    let x = Layout.cssW() - 8 * sc;
    for (let i = s.players.length - 1; i >= 0; i--) {
      const p = s.players[i];
      const isMe = p.seatIndex === s.mySeat;
      const scoreStr = `${p.score >= 0 ? '+' : ''}${p.score}`;
      const name = p.name.slice(0, 4);

      // Draw score first (right-aligned)
      ctx.font = `bold ${12 * sc}px "Microsoft YaHei", sans-serif`;
      const scoreW = ctx.measureText(scoreStr).width;
      ctx.fillStyle = p.score > 0 ? '#ffd700' : p.score < 0 ? '#ff8a80' : 'rgba(255,255,255,0.5)';
      ctx.fillText(scoreStr, x - scoreW, ib.y + ib.h / 2);

      // Draw name
      ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
      const nameW = ctx.measureText(name).width;
      ctx.fillStyle = isMe ? '#ffd700' : 'rgba(255,255,255,0.6)';
      ctx.fillText(name, x - scoreW - nameW - 10 * sc, ib.y + ib.h / 2);

      x -= (scoreW + nameW + 18 * sc);
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

    // Name with crown
    let nameStr = player.name;
    if (player.isLandlord) nameStr = '👑 ' + nameStr;
    if (!player.isConnected) nameStr += ' ⊘';

    const nameY = area.y - 4 * sc;

    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.7)';
      ctx.shadowBlur = 10 * sc;
    }
    ctx.font = `bold ${14 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isActive ? '#ffd700' : '#e8e8e8';
    ctx.fillText(nameStr, area.x + area.w / 2, nameY);
    ctx.shadowColor = 'transparent';

    // Card count
    ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textBaseline = 'top';
    ctx.fillText(`${player.cardCount}张`, area.x + area.w / 2, nameY + 4 * sc);
    ctx.textBaseline = 'alphabetic';

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
    if (!player.isConnected) nameStr += ' ⊘';

    ctx.textAlign = 'center';
    ctx.font = `bold ${14 * sc}px "Microsoft YaHei", sans-serif`;

    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.7)';
      ctx.shadowBlur = 10 * sc;
    }

    const nameX = area.x + area.w / 2;
    const nameY = area.y + area.h + 10 * sc;
    ctx.fillStyle = isActive ? '#ffd700' : '#e8e8e8';
    ctx.textBaseline = 'top';
    ctx.fillText(nameStr, nameX, nameY);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(`${player.cardCount}张`, nameX, nameY + 18 * sc);
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

    const btns = getButtonLayout();
    s._buttonLayout = btns;

    for (const btn of btns) {
      const r = btn.h / 2;

      ctx.save();

      // Shadow
      if (!btn.disabled) {
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6 * sc;
        ctx.shadowOffsetY = 3 * sc;
      }

      // Background
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (btn.disabled) {
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0.03)');
      } else if (btn.type === 'primary') {
        grad.addColorStop(0, '#FFB74D');
        grad.addColorStop(0.5, '#FF9800');
        grad.addColorStop(1, '#F57C00');
      } else if (btn.type === 'danger') {
        grad.addColorStop(0, '#EF5350');
        grad.addColorStop(0.5, '#E53935');
        grad.addColorStop(1, '#C62828');
      } else if (btn.type === 'bid') {
        grad.addColorStop(0, '#64B5F6');
        grad.addColorStop(0.5, '#42A5F5');
        grad.addColorStop(1, '#1E88E5');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,0.16)');
        grad.addColorStop(1, 'rgba(255,255,255,0.08)');
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

      // Top glossy highlight
      if (!btn.disabled) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(btn.x + r, btn.y);
        ctx.lineTo(btn.x + btn.w - r, btn.y);
        ctx.arcTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + r, r);
        ctx.lineTo(btn.x + btn.w, btn.y + r);
        ctx.lineTo(btn.x, btn.y + r);
        ctx.lineTo(btn.x, btn.y + r);
        ctx.arcTo(btn.x, btn.y, btn.x + r, btn.y, r);
        ctx.closePath();
        ctx.clip();
        const hl = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + r);
        hl.addColorStop(0, 'rgba(255,255,255,0.35)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.fillRect(btn.x, btn.y, btn.w, r);
        ctx.restore();
      }

      // Border
      ctx.strokeStyle = btn.disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1 * sc;
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
      ctx.stroke();

      // Text
      ctx.fillStyle = btn.disabled ? 'rgba(255,255,255,0.2)' : '#fff';
      ctx.font = `bold ${15 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = btn.disabled ? 'transparent' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2 * sc;
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx.shadowColor = 'transparent';
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      ctx.restore();
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

    // Track
    const trackR = area.h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.moveTo(area.x + trackR, area.y);
    ctx.lineTo(area.x + area.w - trackR, area.y);
    ctx.arcTo(area.x + area.w, area.y, area.x + area.w, area.y + trackR, trackR);
    ctx.lineTo(area.x + area.w, area.y + area.h - trackR);
    ctx.arcTo(area.x + area.w, area.y + area.h, area.x + area.w - trackR, area.y + area.h, trackR);
    ctx.lineTo(area.x + trackR, area.y + area.h);
    ctx.arcTo(area.x, area.y + area.h, area.x, area.y + area.h - trackR, trackR);
    ctx.lineTo(area.x, area.y + trackR);
    ctx.arcTo(area.x, area.y, area.x + trackR, area.y, trackR);
    ctx.closePath();
    ctx.fill();

    if (progress <= 0) return;

    // Color
    let color;
    if (progress > 0.6) color = '#66BB6A';
    else if (progress > 0.25) color = '#FFA726';
    else color = '#EF5350';

    // Fill
    const fillW = area.w * progress;
    if (fillW > trackR * 2) {
      const fillGrad = ctx.createLinearGradient(area.x, 0, area.x + fillW, 0);
      fillGrad.addColorStop(0, color);
      fillGrad.addColorStop(1, progress < 0.25 ? '#ff1744' : color);
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(area.x + trackR, area.y);
      ctx.lineTo(area.x + fillW - trackR, area.y);
      ctx.arcTo(area.x + fillW, area.y, area.x + fillW, area.y + trackR, trackR);
      ctx.lineTo(area.x + fillW, area.y + area.h - trackR);
      ctx.arcTo(area.x + fillW, area.y + area.h, area.x + fillW - trackR, area.y + area.h, trackR);
      ctx.lineTo(area.x + trackR, area.y + area.h);
      ctx.arcTo(area.x, area.y + area.h, area.x, area.y + area.h - trackR, trackR);
      ctx.lineTo(area.x, area.y + trackR);
      ctx.arcTo(area.x, area.y, area.x + trackR, area.y, trackR);
      ctx.closePath();
      ctx.fill();
    }

    // Pulse when low
    if (progress < 0.25) {
      const pulse = 0.25 + 0.25 * Math.sin(Date.now() / 180);
      ctx.fillStyle = `rgba(255,23,68,${pulse})`;
      ctx.fill();
    }

    // Countdown text
    const secs = Math.ceil(s.turnTimeLeft);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${16 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4 * sc;
    ctx.fillText(`${secs}s`, area.x + area.w / 2, area.y - 6 * sc);
    ctx.shadowColor = 'transparent';
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
    const tw = Math.min(area.w, ctx.measureText(s._toast.text).width + 36 * sc);
    const bx = area.x + (area.w - tw) / 2;
    const r = area.h / 2;

    // Glass background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
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
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${13 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 2 * sc;
    ctx.fillText(s._toast.text, bx + tw / 2, area.y + area.h / 2);
    ctx.shadowColor = 'transparent';
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
