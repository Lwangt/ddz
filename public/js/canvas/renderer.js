// Premium casino-style renderer — dark wood table, golden accents, player avatars
const GameRenderer = (() => {
  let ctx = null;
  let gameState = null;

  // Image caches
  const avatarCache = {};
  const bgCache = {};
  function preloadImages() {
    for (let i = 1; i <= 5; i++) {
      const img = new Image();
      img.src = `image/role/角色${i}.png`;
      avatarCache[i] = img;
    }
    for (let i = 1; i <= 2; i++) {
      const img = new Image();
      img.src = `image/bg/bg${i}.png`;
      bgCache[i] = img;
    }
  }
  preloadImages();

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
    const W = Layout.cssW(), H = Layout.cssH();
    ctx.save();
    ctx.fillStyle = '#0d1b0e';
    ctx.fillRect(0, 0, W, H);

    // Draw background image as bottom layer
    const bgId = gameState.bg;
    if (bgId && bgCache[bgId] && bgCache[bgId].complete && bgCache[bgId].naturalWidth > 0) {
      const bgImg = bgCache[bgId];
      const bgRatio = bgImg.naturalWidth / bgImg.naturalHeight;
      const screenRatio = W / H;
      let dw, dh, dx, dy;
      if (screenRatio > bgRatio) {
        dw = W;
        dh = W / bgRatio;
        dx = 0;
        dy = (H - dh) / 2;
      } else {
        dh = H;
        dw = H * bgRatio;
        dx = (W - dw) / 2;
        dy = 0;
      }
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } else {
      drawBackground(W, H);
    }
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

  // ── Background: dark radial with subtle texture ──────────

  function drawBackground(W, H) {
    const grad = ctx.createRadialGradient(W * 0.45, H * 0.38, 0, W / 2, H / 2, Math.max(W, H) * 0.85);
    grad.addColorStop(0, '#1a2f1a');
    grad.addColorStop(0.35, '#132213');
    grad.addColorStop(0.7, '#0b180c');
    grad.addColorStop(1, '#050c06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise dots
    const sc = Layout.scale();
    ctx.fillStyle = 'rgba(255,255,255,0.006)';
    const step = 16 * sc;
    for (let x = step; x < W; x += step) {
      for (let y = step; y < H; y += step) {
        if (Math.random() < 0.3) {
          ctx.fillRect(x, y, 1 * sc, 1 * sc);
        }
      }
    }
  }

  // ── Table oval: dark green felt play surface ─────────────

  function drawTableOval(W, H) {
    const sc = Layout.scale();
    const marginX = W * 0.04;
    const marginY = H * 0.06;
    const ox = marginX, oy = marginY;
    const ow = W - marginX * 2, oh = H - marginY * 2;
    const rx = ow / 2, ry = oh / 2;

    // Outer golden glow ring
    ctx.shadowColor = 'rgba(200,160,60,0.25)';
    ctx.shadowBlur = 20 * sc;
    ctx.strokeStyle = 'rgba(180,140,50,0.5)';
    ctx.lineWidth = 4 * sc;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, rx + 3 * sc, ry + 3 * sc, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    // Inner green felt oval
    const feltGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(rx, ry));
    feltGrad.addColorStop(0, '#1e5a2e');
    feltGrad.addColorStop(0.6, '#164522');
    feltGrad.addColorStop(1, '#0e3016');
    ctx.fillStyle = feltGrad;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner gold trim
    ctx.strokeStyle = 'rgba(200,160,60,0.35)';
    ctx.lineWidth = 2 * sc;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, rx - 6 * sc, ry - 6 * sc, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Corner ornaments — small golden diamonds at 4 corners of the screen
    drawCornerOrnament(ox + 12 * sc, oy + 12 * sc, sc);           // top-left
    drawCornerOrnament(W - ox - 12 * sc, oy + 12 * sc, sc);       // top-right
    drawCornerOrnament(ox + 12 * sc, H - oy - 12 * sc, sc);       // bottom-left
    drawCornerOrnament(W - ox - 12 * sc, H - oy - 12 * sc, sc);   // bottom-right
  }

  function drawCornerOrnament(cx, cy, sc) {
    const s = 6 * sc;
    ctx.fillStyle = 'rgba(200,160,60,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();
  }

  // ── Ghost turn indicator ─────────────────────────────────

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

    const sc = Layout.scale();
    const pulse = 0.18 + 0.12 * Math.sin(Date.now() / 380);
    const r = 8 * sc;

    ctx.shadowColor = `rgba(255,215,0,${pulse})`;
    ctx.shadowBlur = 16 * sc;
    ctx.strokeStyle = `rgba(255,200,50,${pulse})`;
    ctx.lineWidth = 3 * sc;
    roundRectPath(area.x, area.y, area.w, area.h, r);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
  }

  function roundRectPath(x, y, w, h, r) {
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
  }

  function fillRoundRect(x, y, w, h, r) {
    roundRectPath(x, y, w, h, r);
    ctx.fill();
  }

  function strokeRoundRect(x, y, w, h, r) {
    roundRectPath(x, y, w, h, r);
    ctx.stroke();
  }

  // ── Info bar: slim glass top bar ─────────────────────────

  function drawInfoBar() {
    const s = gameState;
    const ib = Layout.infoBar();
    const sc = Layout.scale();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    fillRoundRect(ib.x, ib.y, ib.w, ib.h, 6 * sc);

    // Gold bottom line
    ctx.strokeStyle = 'rgba(200,160,60,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ib.x, ib.y + ib.h);
    ctx.lineTo(ib.x + ib.w, ib.y + ib.h);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.font = `bold ${12 * sc}px "Microsoft YaHei", sans-serif`;

    let x = 14 * sc;

    if (s.roomCode) {
      const txt = `房间 ${s.roomCode}`;
      const tw = ctx.measureText(txt).width + 14 * sc;
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = '#d0c8b0';
      ctx.fillText(txt, x + 7 * sc, ib.y + ib.h / 2);
      x += tw + 10 * sc;
    }

    if (s.phase === 'BIDDING') {
      const bidText = `叫地主  ${s.currentBid || 0}分`;
      const tw = ctx.measureText(bidText).width + 14 * sc;
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, 'rgba(255,193,7,0.15)');
      ctx.fillStyle = '#ffd700';
      ctx.fillText(bidText, x + 7 * sc, ib.y + ib.h / 2);
      x += tw + 10 * sc;
    }

    if (s.phase === 'PLAYING' || s.phase === 'FINISHED') {
      const base = Math.max(s.currentBid || 0, 1);
      const mText = `底分 ${base}  倍数 ×${s.multiplier}`;
      const tw = ctx.measureText(mText).width + 14 * sc;
      const bg = s.multiplier >= 4 ? 'rgba(255,82,82,0.2)' : 'rgba(255,255,255,0.06)';
      drawPill(x, ib.y + ib.h / 2 - 9 * sc, tw, 18 * sc, bg);
      ctx.fillStyle = s.multiplier >= 4 ? '#ffa0a0' : '#d0c8b0';
      ctx.fillText(mText, x + 7 * sc, ib.y + ib.h / 2);
    }

    ctx.textBaseline = 'alphabetic';
  }

  function drawPill(x, y, w, h, color) {
    ctx.fillStyle = color;
    fillRoundRect(x, y, w, h, h / 2);
  }

  // ── Score board: casino-chip style ───────────────────────

  function drawScoreBoard() {
    const s = gameState;
    if (!s.players || s.players.length === 0) return;
    const sc = Layout.scale();
    const ib = Layout.infoBar();

    let x = Layout.cssW() - 10 * sc;
    for (let i = s.players.length - 1; i >= 0; i--) {
      const p = s.players[i];
      const isMe = p.seatIndex === s.mySeat;

      // Chip-style score circle
      const chipR = 11 * sc;
      const chipX = x - chipR;
      const chipY = ib.y + ib.h / 2;

      // Chip background
      ctx.beginPath();
      ctx.arc(chipX, chipY, chipR, 0, Math.PI * 2);
      const chipGrad = ctx.createRadialGradient(chipX - 2 * sc, chipY - 2 * sc, 0, chipX, chipY, chipR);
      if (p.score > 0) {
        chipGrad.addColorStop(0, '#ffd54f');
        chipGrad.addColorStop(0.5, '#ffc107');
        chipGrad.addColorStop(1, '#e6a800');
      } else if (p.score < 0) {
        chipGrad.addColorStop(0, '#ef9a9a');
        chipGrad.addColorStop(0.5, '#ef5350');
        chipGrad.addColorStop(1, '#c62828');
      } else {
        chipGrad.addColorStop(0, '#e0e0e0');
        chipGrad.addColorStop(0.5, '#bdbdbd');
        chipGrad.addColorStop(1, '#757575');
      }
      ctx.fillStyle = chipGrad;
      ctx.fill();

      // Chip rim
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.2 * sc;
      ctx.stroke();

      // Score number
      const scoreStr = p.score === 0 ? '0' : `${p.score >= 0 ? '+' : ''}${p.score}`;
      ctx.fillStyle = p.score > 0 ? '#5d4037' : p.score < 0 ? '#fff' : '#424242';
      ctx.font = `bold ${11 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreStr, chipX, chipY);

      // Player name
      ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = isMe ? '#ffd700' : 'rgba(255,255,255,0.6)';
      const name = p.name.slice(0, 4);
      ctx.fillText(name, chipX, chipY - chipR - 10 * sc);

      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      x -= (chipR * 2 + 20 * sc);
    }
  }

  // ── Opponents: character illustrations + cards ──────────

  function drawOpponents() {
    const s = gameState;
    for (const player of s.players) {
      if (player.seatIndex === s.mySeat) continue;
      const dispPos = (player.seatIndex - s.mySeat + 3) % 3;
      if (dispPos === 2) drawTopOpponent(player);
      else if (dispPos === 1) drawLeftOpponent(player);
    }
  }

  // Draw a full character illustration with correct aspect ratio
  function drawCharacterIllustration(player, x, y, maxW, maxH, sc) {
    const img = avatarCache[player.avatar];
    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const isActive = player.seatIndex === gameState.currentPlayerIndex && gameState.phase === 'PLAYING';
    const imgRatio = img.naturalWidth / img.naturalHeight;

    // Calculate size fitting within bounds, preserving aspect ratio
    let drawW, drawH;
    if (maxW / maxH > imgRatio) {
      drawH = maxH;
      drawW = maxH * imgRatio;
    } else {
      drawW = maxW;
      drawH = maxW / imgRatio;
    }

    const cx = x + (maxW - drawW) / 2;
    const cy = y + (maxH - drawH) / 2;

    // Active glow behind the character
    if (isActive) {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 400);
      ctx.shadowColor = `rgba(255,215,0,${pulse})`;
      ctx.shadowBlur = 20 * sc;
    }

    ctx.drawImage(img, cx, cy, drawW, drawH);
    ctx.shadowColor = 'transparent';
  }

  function drawTopOpponent(player) {
    const sc = Layout.scale();
    const isActive = player.seatIndex === gameState.currentPlayerIndex && gameState.phase === 'PLAYING';
    const charZ = Layout.topCharZone();
    const area = Layout.p2Area();
    const positions = Layout.getOpponentHPositions(player.cardCount);

    // Character illustration
    drawCharacterIllustration(player, charZ.x, charZ.y, charZ.w, charZ.h, sc);

    // Name between character and cards
    const labelY = charZ.y + charZ.h + (area.y - charZ.y - charZ.h) / 2;
    let nameStr = player.name;
    if (player.isLandlord) nameStr = '👑 ' + nameStr;
    if (!player.isConnected) nameStr += ' ⊘';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${14 * sc}px "Microsoft YaHei", sans-serif`;
    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.7)';
      ctx.shadowBlur = 8 * sc;
    }
    ctx.fillStyle = isActive ? '#ffd700' : '#d0c8b0';
    ctx.fillText(nameStr, charZ.x + charZ.w / 2, labelY);
    ctx.shadowColor = 'transparent';

    // Card count above cards
    ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${player.cardCount}张`, area.x + area.w / 2, area.y - 2 * sc);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Card backs
    for (const pos of positions) {
      CardDrawer.drawCardBack(ctx, pos.x, pos.y, pos.w, pos.h);
    }
  }

  function drawLeftOpponent(player) {
    const sc = Layout.scale();
    const isActive = player.seatIndex === gameState.currentPlayerIndex && gameState.phase === 'PLAYING';
    const charZ = Layout.leftCharZone();
    const area = Layout.p1Area();
    const positions = Layout.getOpponentVPositions(player.cardCount);

    // Character illustration
    drawCharacterIllustration(player, charZ.x, charZ.y, charZ.w, charZ.h, sc);

    // Name between character and cards
    const labelY = charZ.y + charZ.h + (area.y - charZ.y - charZ.h) / 2;
    let nameStr = player.name;
    if (player.isLandlord) nameStr = '👑 ' + nameStr;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${13 * sc}px "Microsoft YaHei", sans-serif`;
    if (isActive) {
      ctx.shadowColor = 'rgba(255,215,0,0.7)';
      ctx.shadowBlur = 8 * sc;
    }
    ctx.fillStyle = isActive ? '#ffd700' : '#d0c8b0';
    ctx.fillText(nameStr, charZ.x + charZ.w / 2, labelY);
    ctx.shadowColor = 'transparent';

    // Card count
    ctx.font = `${10 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${player.cardCount}张`, area.x + area.w / 2, area.y + area.h + 4 * sc);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // Card backs (rotated)
    for (const pos of positions) {
      ctx.save();
      ctx.translate(pos.x + pos.h / 2, pos.y + pos.w / 2);
      ctx.rotate(-Math.PI / 2);
      CardDrawer.drawCardBack(ctx, -pos.w / 2, -pos.h / 2, pos.w, pos.h);
      ctx.restore();
    }
  }

  // ── Bid results ──────────────────────────────────────────

  function drawBidResults() {
    const s = gameState;
    if (!s.bidResults || s.bidResults.length === 0) return;
    const sc = Layout.scale();
    const pa = Layout.playArea();
    const now = Date.now();

    const recent = s.bidResults.filter(r => now - r.time < 5000);
    if (recent.length === 0) return;

    const startY = pa.y + pa.h * 0.15;
    const lineH = 26 * sc;

    ctx.textAlign = 'center';
    ctx.font = `bold ${15 * sc}px "Microsoft YaHei", sans-serif`;

    for (let i = 0; i < recent.length; i++) {
      const r = recent[i];
      const elapsed = now - r.time;
      const alpha = elapsed < 4000 ? 1 : Math.max(0, 1 - (elapsed - 4000) / 1000);
      const label = r.amount > 0 ? `${r.playerName}：叫 ${r.amount} 分` : `${r.playerName}：不叫`;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = r.amount > 0 ? '#ffd700' : 'rgba(255,255,255,0.5)';
      ctx.fillText(label, pa.x + pa.w / 2, startY + i * lineH);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    s.bidResults = recent;
  }

  // ── Player action zones ──────────────────────────────────

  function drawPlayerActions() {
    const s = gameState;
    if (!s.playerLastActions || s.phase !== 'PLAYING') return;
    const sc = Layout.scale();
    const cw = Layout.cardW(), ch = Layout.cardH();

    for (const player of s.players) {
      const lastAct = s.playerLastActions[player.seatIndex];
      if (!lastAct) continue;

      const dispPos = player.seatIndex === s.mySeat ? 0 : (player.seatIndex - s.mySeat + 3) % 3;
      const zone = Layout.getActionZone(dispPos);
      const isMe = player.seatIndex === s.mySeat;

      if (lastAct.action === 'pass') {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `bold ${14 * sc}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('不出', zone.x + zone.w / 2, zone.y + zone.h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      } else if (lastAct.action === 'play' && lastAct.cardIds) {
        const smallW = cw * 0.58;
        const smallH = ch * 0.58;
        const count = lastAct.cardIds.length;
        const spacing = Math.min(smallW * 0.4, (zone.w - smallW) / Math.max(count - 1, 1));
        const totalW = smallW + (count - 1) * spacing;
        const startX = zone.x + (zone.w - totalW) / 2;
        const startY = zone.y + 4 * sc;

        // Player name
        ctx.fillStyle = isMe ? '#ffd700' : 'rgba(255,255,255,0.6)';
        ctx.font = `bold ${10 * sc}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(isMe ? '你' : player.name, zone.x + zone.w / 2, startY - 2 * sc);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        // Pattern type badge
        if (lastAct.pattern) {
          const patName = PATTERN_LABELS[lastAct.pattern.type] || lastAct.pattern.type;
          ctx.fillStyle = '#ffd700';
          ctx.font = `bold ${10 * sc}px "Microsoft YaHei", sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 3 * sc;
          ctx.fillText(patName, zone.x + zone.w / 2, startY + smallH + 14 * sc);
          ctx.shadowColor = 'transparent';
          ctx.textAlign = 'start';
        }

        for (let i = 0; i < count; i++) {
          CardDrawer.drawCardFace(ctx, lastAct.cardIds[i],
            startX + i * spacing, startY, smallW, smallH, false);
        }
      }
    }
  }

  // ── Play area: turn indicator ────────────────────────────

  function drawPlayArea() {
    const s = gameState;
    if (s.phase !== 'PLAYING') return;
    const sc = Layout.scale();
    const pa = Layout.playArea();

    const cp = s.players.find(p => p.seatIndex === s.currentPlayerIndex);
    if (!cp) return;

    const isMe = cp.seatIndex === s.mySeat;
    const fullText = isMe ? '轮到你出牌' : `${cp.name} 正在出牌...`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = 17 * sc;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    const tw = ctx.measureText(fullText).width;
    const padX = 22 * sc, padY = 12 * sc;
    const bx = pa.x + pa.w / 2 - tw / 2 - padX;
    const by = pa.y + pa.h * 0.55;
    const bw = tw + padX * 2, bh = fontSize + padY * 2;

    // Glow
    ctx.shadowColor = isMe ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.shadowBlur = 14 * sc;

    // Dark badge
    const badgeGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    badgeGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
    badgeGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = badgeGrad;
    fillRoundRect(bx, by, bw, bh, 10 * sc);
    ctx.shadowColor = 'transparent';

    // Gold border for self, subtle for others
    ctx.strokeStyle = isMe ? 'rgba(255,200,50,0.5)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = isMe ? 2 * sc : 1 * sc;
    strokeRoundRect(bx, by, bw, bh, 10 * sc);

    ctx.fillStyle = isMe ? '#ffd700' : '#d0c8b0';
    ctx.fillText(fullText, bx + bw / 2, by + bh / 2);

    if (s.passCount > 0) {
      ctx.font = `${12 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      const passText = s.passCount >= 2 ? `已连续不出 ×${s.passCount}` : '已有人不出';
      ctx.fillText(passText, pa.x + pa.w / 2, by + bh + 20 * sc);
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Bonus cards ──────────────────────────────────────────

  function drawBonusCards() {
    const s = gameState;
    if (s.phase === 'WAITING' || s.phase === 'FINISHED') return;
    if (!s.bonusCards || s.bonusCards.length === 0) return;

    const positions = Layout.getBonusCardPositions();
    const sc = Layout.scale();
    const showFaceUp = s.phase === 'PLAYING';

    // "底牌" label above the group
    const mid = positions[1];
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.font = `bold ${10 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('底牌', mid.x + mid.w / 2, mid.y - 3 * sc);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i < s.bonusCards.length; i++) {
      if (showFaceUp) {
        CardDrawer.drawCardFace(ctx, s.bonusCards[i],
          positions[i].x, positions[i].y, positions[i].w, positions[i].h, false);
      } else {
        CardDrawer.drawCardBack(ctx, positions[i].x, positions[i].y,
          positions[i].w, positions[i].h);
      }
    }
  }

  // ── Own hand ─────────────────────────────────────────────

  function drawOwnHand() {
    const s = gameState;
    if (!s.hand || s.hand.length === 0) return;

    const sc = Layout.scale();
    const charZ = Layout.selfCharZone();
    const p0 = Layout.p0Area();
    const positions = Layout.getHandPositions(s.hand.length);

    // Self player character illustration (bottom-left)
    const self = s.players.find(p => p.seatIndex === s.mySeat);
    if (self) {
      drawCharacterIllustration(self, charZ.x, charZ.y, charZ.w, charZ.h, sc);

      // Name above character
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = `bold ${13 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#ffd700';
      ctx.fillText(self.name, charZ.x + charZ.w / 2, charZ.y - 2 * sc);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    // Card count above hand
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${11 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.hand.length}张`, p0.x + p0.w / 2, p0.y - 2 * sc);
    ctx.textAlign = 'start';

    if (s.selectedCards && s.selectedCards.size > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`已选 ${s.selectedCards.size} 张`, p0.x + p0.w - 60 * sc, p0.y - 2 * sc);
    }

    for (let i = 0; i < s.hand.length; i++) {
      const selected = s.selectedCards && s.selectedCards.has(i);
      CardDrawer.drawCardFace(ctx, s.hand[i],
        positions[i].x, positions[i].y, positions[i].w, positions[i].h, selected);
    }
  }

  // ── Buttons: premium metallic style ─────────────────────

  function drawButtons() {
    const s = gameState;
    const area = Layout.buttonArea();
    const sc = Layout.scale();
    const btns = getButtonLayout();
    s._buttonLayout = btns;

    for (const btn of btns) {
      const r = btn.h / 2;
      ctx.save();

      // Outer glow for enabled buttons
      if (!btn.disabled) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 10 * sc;
        ctx.shadowOffsetY = 4 * sc;
      }

      // Base fill with metallic gradient
      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (btn.disabled) {
        grad.addColorStop(0, '#2a2a2a');
        grad.addColorStop(0.5, '#1f1f1f');
        grad.addColorStop(1, '#151515');
      } else if (btn.type === 'primary') {
        grad.addColorStop(0, '#ffcc80');
        grad.addColorStop(0.2, '#ffb74d');
        grad.addColorStop(0.5, '#f59e2e');
        grad.addColorStop(0.8, '#e68900');
        grad.addColorStop(1, '#cc7700');
      } else if (btn.type === 'danger') {
        grad.addColorStop(0, '#ff8a80');
        grad.addColorStop(0.3, '#ef5350');
        grad.addColorStop(0.7, '#d32f2f');
        grad.addColorStop(1, '#9a0007');
      } else if (btn.type === 'bid') {
        grad.addColorStop(0, '#90caf9');
        grad.addColorStop(0.3, '#64b5f6');
        grad.addColorStop(0.7, '#1e88e5');
        grad.addColorStop(1, '#0d47a1');
      } else {
        grad.addColorStop(0, '#5a5a5a');
        grad.addColorStop(0.3, '#424242');
        grad.addColorStop(0.7, '#333333');
        grad.addColorStop(1, '#1a1a1a');
      }
      ctx.fillStyle = grad;
      fillRoundRect(btn.x, btn.y, btn.w, btn.h, r);
      ctx.shadowColor = 'transparent';

      if (!btn.disabled) {
        // Top bright highlight (glossy reflection)
        ctx.save();
        roundRectPath(btn.x, btn.y, btn.w, r * 1.6, r);
        ctx.clip();
        const hlGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + r * 1.6);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(btn.x, btn.y, btn.w, r * 1.6);
        ctx.restore();

        // Inner bright edge (top rim light)
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2 * sc;
        roundRectPath(btn.x + 1.5 * sc, btn.y + 1.5 * sc, btn.w - 3 * sc, btn.h - 3 * sc, r - 1 * sc);
        ctx.stroke();

        // Bottom shadow edge
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1 * sc;
        ctx.beginPath();
        ctx.moveTo(btn.x + r, btn.y + btn.h - 1.5 * sc);
        ctx.lineTo(btn.x + btn.w - r, btn.y + btn.h - 1.5 * sc);
        ctx.stroke();
      }

      // Outer border
      ctx.strokeStyle = btn.disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1 * sc;
      strokeRoundRect(btn.x, btn.y, btn.w, btn.h, r);

      // Text with depth
      ctx.font = `bold ${15 * sc}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (!btn.disabled) {
        // Text shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2 * sc;
        ctx.shadowOffsetY = 1.5 * sc;
      }
      ctx.fillStyle = btn.disabled ? 'rgba(255,255,255,0.15)' : '#fff';
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
          label: labels[i], x: area.x + i * (bW + 3 * sc), y: area.y,
          w: bW, h: area.h, type: types[i], disabled: false
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
      btns.push({
        id: 'waiting', label: cp ? `${cp.name} 正在出牌...` : '等待中...',
        x: area.x, y: area.y, w: area.w, h: area.h,
        type: 'secondary', disabled: true
      });
    }
    return btns;
  }

  // ── Timer bar with particles and glow ────────────────────

  let timerParticles = [];
  let lastTimerParticleTime = 0;

  function drawTimerBar() {
    const s = gameState;
    if (!s.turnTimeLeft || s.turnTimeLeft <= 0 || !s.myTurn) {
      timerParticles = [];
      return;
    }

    const area = Layout.timerArea();
    const progress = s.turnTimeLeft / s.turnTimeTotal;
    const sc = Layout.scale();
    const trackH = 10 * sc;
    const trackY = area.y + area.h / 2 - trackH / 2;
    const trackR = trackH / 2;
    const now = Date.now();

    // Track background with subtle glow
    ctx.shadowColor = 'rgba(255,255,255,0.08)';
    ctx.shadowBlur = 6 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    fillRoundRect(area.x, trackY, area.w, trackH, trackR);
    ctx.shadowColor = 'transparent';

    if (progress <= 0) return;

    let color, glow;
    if (progress > 0.6) { color = '#66BB6A'; glow = 'rgba(102,187,106,0.6)'; }
    else if (progress > 0.25) { color = '#FFA726'; glow = 'rgba(255,167,38,0.6)'; }
    else { color = '#EF5350'; glow = 'rgba(239,83,80,0.8)'; }

    const fillW = area.w * progress;
    if (fillW > trackR * 2) {
      // Glow behind the fill
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12 * sc;

      const fillGrad = ctx.createLinearGradient(area.x, 0, area.x + fillW, 0);
      fillGrad.addColorStop(0, color);
      fillGrad.addColorStop(0.5, color);
      fillGrad.addColorStop(1, progress < 0.25 ? '#ff1744' : color);
      ctx.fillStyle = fillGrad;
      fillRoundRect(area.x, trackY, fillW, trackH, trackR);
      ctx.shadowColor = 'transparent';

      // Bright edge at the leading tip
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const tipW = Math.min(4 * sc, fillW * 0.1);
      fillRoundRect(area.x + fillW - tipW, trackY + 1 * sc, tipW, trackH - 2 * sc, trackR - 1 * sc);
    }

    // Pulsing overlay when low
    if (progress < 0.25) {
      const pulse = 0.15 + 0.25 * Math.sin(Date.now() / 130);
      ctx.fillStyle = `rgba(255,23,68,${pulse})`;
      fillRoundRect(area.x, trackY, fillW, trackH, trackR);
    }

    // ── Timer particles ───────────────────────────────────
    if (progress < 0.25 && now - lastTimerParticleTime > 60) {
      lastTimerParticleTime = now;
      timerParticles.push({
        x: area.x + fillW,
        y: trackY + trackH / 2,
        vx: 2 * sc + Math.random() * 4 * sc,
        vy: (Math.random() - 0.5) * 3 * sc,
        life: 1,
        size: 1.5 * sc + Math.random() * 3 * sc,
        color: ['#ff5252', '#ff8a80', '#ffd740', '#fff'][Math.floor(Math.random() * 4)]
      });
    }

    // Draw and update existing particles
    for (let i = timerParticles.length - 1; i >= 0; i--) {
      const p = timerParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) { timerParticles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Countdown text with glow
    const secs = Math.ceil(s.turnTimeLeft);
    const fontSize = progress < 0.25 ? 22 * sc : 16 * sc;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Text glow
    if (progress < 0.25) {
      ctx.shadowColor = 'rgba(255,50,50,0.8)';
      ctx.shadowBlur = 14 * sc;
    }
    ctx.fillStyle = progress < 0.25 ? '#ff5252' : '#fff';
    ctx.fillText(progress < 0.25 ? `⏰ ${secs}s` : `${secs}s`, area.x + area.w / 2, trackY - 8 * sc);
    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Toast ────────────────────────────────────────────────

  function drawToast() {
    const s = gameState;
    if (!s._toast || !s._toast.text) return;
    const elapsed = Date.now() - s._toast.startTime;
    if (elapsed > s._toast.duration) { s._toast = null; return; }

    const area = Layout.toastArea();
    const sc = Layout.scale();
    let alpha = 1;
    const fadeMs = 400;
    if (elapsed < fadeMs) alpha = elapsed / fadeMs;
    else if (elapsed > s._toast.duration - fadeMs) alpha = (s._toast.duration - elapsed) / fadeMs;
    alpha = Math.max(0, Math.min(1, alpha));

    ctx.globalAlpha = alpha;
    const tw = Math.min(area.w, ctx.measureText(s._toast.text).width + 32 * sc);
    const bx = area.x + (area.w - tw) / 2, r = area.h / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    fillRoundRect(bx, area.y, tw, area.h, r);
    ctx.strokeStyle = 'rgba(200,160,60,0.3)';
    ctx.lineWidth = 1;
    strokeRoundRect(bx, area.y, tw, area.h, r);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${13 * sc}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s._toast.text, bx + tw / 2, area.y + area.h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  // ── Effects ──────────────────────────────────────────────

  let flashAlpha = 0, particles = [], lastBombTime = 0, lastWinTime = 0;

  function triggerBombFlash() { flashAlpha = 0.35; lastBombTime = Date.now(); }

  function triggerWinParticles(W, H) {
    lastWinTime = Date.now();
    const sc = Layout.scale();
    particles = [];
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: W * 0.15 + Math.random() * W * 0.7,
        y: H * 0.3 + Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 5 * sc,
        vy: -Math.random() * 7 * sc - 2 * sc,
        life: 1,
        size: 2 * sc + Math.random() * 6 * sc,
        color: ['#ffd700', '#ff6b6b', '#4caf50', '#2196f3', '#ff9800', '#e040fb'][Math.floor(Math.random() * 6)]
      });
    }
  }

  function drawEffects() {
    const W = Layout.cssW(), H = Layout.cssH();
    const now = Date.now();

    if (flashAlpha > 0) {
      const elapsed = (now - lastBombTime) / 1000;
      flashAlpha = Math.max(0, 0.35 - elapsed * 0.5);
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,50,50,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        ctx.translate(Math.sin(elapsed * 60) * 4 * flashAlpha, 0);
      }
    }

    if (particles.length > 0) {
      const elapsed = (now - lastWinTime) / 1000;
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
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

  window.triggerBombEffect = triggerBombFlash;
  window.triggerWinEffect = () => triggerWinParticles(Layout.cssW(), Layout.cssH());

  return { init, draw };
})();
