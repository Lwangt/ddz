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

    // Clear with identity transform
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    ctx.save();
    drawBackground(W, H);
    drawGhostTurnIndicator();
    drawInfoBar();
    drawOpponents();
    drawPlayArea();
    drawBonusCards();
    drawOwnHand();
    drawButtons();
    drawTimerBar();
    drawToast();
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
    const isMob = Layout.isMobile();

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
    const isMob = Layout.isMobile();
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
    const isMob = Layout.isMobile();
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

  function drawPlayArea() {
    const s = gameState;
    const sc = Layout.scale();
    const isMob = Layout.isMobile();

    if (s.lastPlayedCards && s.lastPlayedCards.length > 0 && s.lastPlayedBy >= 0) {
      const player = s.players.find(p => p.seatIndex === s.lastPlayedBy);
      const dispPos = (s.lastPlayedBy - s.mySeat + 3) % 3;
      const positions = Layout.getPlayedCardPositions(s.lastPlayedCards, dispPos);

      // Pattern label background
      if (s.lastPattern) {
        const lbl = PATTERN_LABELS[s.lastPattern.type] || s.lastPattern.type;
        ctx.font = `bold ${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
        const tw = ctx.measureText(lbl).width;
        const pos = positions[Math.floor(positions.length / 2)];
        const bx = pos.x + pos.w / 2 - tw / 2 - 8 * sc;
        const by = pos.y - 6 * sc;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        const r = 4 * sc;
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + tw + 16 * sc - r, by);
        ctx.arcTo(bx + tw + 16 * sc, by, bx + tw + 16 * sc, by + r, r);
        ctx.lineTo(bx + tw + 16 * sc, by + 20 * sc - r);
        ctx.arcTo(bx + tw + 16 * sc, by + 20 * sc, bx + tw + 16 * sc - r, by + 20 * sc, r);
        ctx.lineTo(bx + r, by + 20 * sc);
        ctx.arcTo(bx, by + 20 * sc, bx, by + 20 * sc - r, r);
        ctx.lineTo(bx, by + r);
        ctx.arcTo(bx, by, bx + r, by, r);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, bx + tw / 2 + 8 * sc, by + 14 * sc);
        ctx.textAlign = 'start';
      }

      // Draw cards
      for (let i = 0; i < s.lastPlayedCards.length; i++) {
        CardDrawer.drawCardFace(ctx, s.lastPlayedCards[i],
          positions[i].x, positions[i].y, positions[i].w, positions[i].h, false);
      }

      // Player name below cards
      if (player) {
        const firstPos = positions[0];
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${isMob ? 10 : 12 * sc}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name, firstPos.x + firstPos.w / 2,
          firstPos.y + firstPos.h + 14 * sc);
        ctx.textAlign = 'start';
      }
    }

    // Pass markers
    if (s.passCount > 0) {
      const pa = Layout.playArea();
      ctx.font = `bold ${isMob ? 14 : 18 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.textBaseline = 'middle';

      if (s.passCount === 1) {
        ctx.fillText('不出', pa.x + pa.w / 2, pa.y + pa.h / 2);
      } else {
        ctx.fillText('不出 ×2', pa.x + pa.w / 2, pa.y + pa.h / 2);
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ── Bonus cards ──────────────────────────────────────────

  function drawBonusCards() {
    const s = gameState;
    if (s.phase !== 'DEALING' && s.phase !== 'BIDDING') return;
    if (!s.bonusCards || s.bonusCards.length === 0) return;

    const positions = Layout.getBonusCardPositions();
    const isMob = Layout.isMobile();
    const sc = Layout.scale();

    for (let i = 0; i < s.bonusCards.length; i++) {
      CardDrawer.drawCardBack(ctx, positions[i].x, positions[i].y,
        positions[i].w, positions[i].h);
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
    const isMob = Layout.isMobile();
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
    const isMob = Layout.isMobile();

    const btns = getButtonLayout();
    s._buttonLayout = btns;

    for (const btn of btns) {
      // Button background with hover simulation
      let bgColor;
      if (btn.disabled) {
        bgColor = 'rgba(255,255,255,0.08)';
      } else if (btn.type === 'primary') {
        bgColor = '#ffc107';
      } else if (btn.type === 'danger') {
        bgColor = '#ff5252';
      } else if (btn.type === 'bid') {
        bgColor = '#2196f3';
      } else {
        bgColor = 'rgba(255,255,255,0.18)';
      }

      ctx.fillStyle = bgColor;
      const r = 8 * sc;
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

      // Subtle top highlight on active buttons
      if (!btn.disabled && (btn.type === 'primary' || btn.type === 'danger')) {
        const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h * 0.5);
        grad.addColorStop(0, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Text
      ctx.fillStyle = btn.disabled ? 'rgba(255,255,255,0.3)'
        : ((btn.type === 'primary') ? '#1a1a1a' : '#fff');
      ctx.font = `bold ${isMob ? 13 : 15 * sc}px "Microsoft YaHei", sans-serif`;
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
        const canBid = i === 0 || s.canBid.includes(i);
        btns.push({
          id: i === 0 ? 'bid_0' : `bid_${i}`,
          label: labels[i],
          x: area.x + i * (bW + 3 * sc),
          y: area.y,
          w: bW,
          h: area.h,
          type: types[i],
          disabled: i > 0 && !canBid
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
    const isMob = Layout.isMobile();

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
    const isMob = Layout.isMobile();

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

  return { init, draw };
})();
