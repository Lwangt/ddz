// Polished card rendering — premium casino-quality card faces
const CardDrawer = (() => {
  const SUITS = ['♠', '♥', '♣', '♦'];
  const SUIT_COLORS = ['#1a1a1a', '#d32f2f', '#1a1a1a', '#d32f2f'];
  const RANK_NAMES = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

  function decode(id) {
    if (id === 52) return { suit: -1, rank: 13, isJoker: true, jokerType: 'small' };
    if (id === 53) return { suit: -1, rank: 14, isJoker: true, jokerType: 'big' };
    return { suit: Math.floor(id / 13), rank: id % 13, isJoker: false };
  }

  function rr(ctx, x, y, w, h, r) {
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

  function drawCardFace(ctx, cardId, x, y, w, h, selected) {
    const card = decode(cardId);
    const s = Math.min(w, h) / 75;
    const lift = selected ? -26 * s : 0;

    ctx.save();
    ctx.translate(x, y + lift);

    // Outer shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = selected ? 14 * s : 6 * s;
    ctx.shadowOffsetX = 2 * s;
    ctx.shadowOffsetY = selected ? 6 * s : 3 * s;
    rr(ctx, 0, 0, w, h, 7 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Card border
    rr(ctx, 0, 0, w, h, 7 * s);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();

    // Inner bevel (3D effect)
    rr(ctx, 2 * s, 2 * s, w - 4 * s, h - 4 * s, 5 * s);
    const bevelGrad = ctx.createLinearGradient(0, 0, w, h);
    bevelGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    bevelGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    bevelGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.strokeStyle = bevelGrad;
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    if (card.isJoker) {
      drawJoker(ctx, card, w, h, s);
    } else {
      drawStandard(ctx, card, w, h, s);
    }

    // Selection glow
    if (selected) {
      rr(ctx, -2 * s, -2 * s, w + 4 * s, h + 4 * s, 8 * s);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3.5 * s;
      ctx.shadowColor = 'rgba(255,215,0,0.9)';
      ctx.shadowBlur = 16 * s;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }

    ctx.restore();
  }

  function drawStandard(ctx, card, w, h, s) {
    const color = SUIT_COLORS[card.suit];
    const rank = RANK_NAMES[card.rank];
    const suit = SUITS[card.suit];
    const fs = 15 * s;

    // Top-left corner
    ctx.fillStyle = color;
    ctx.font = `bold ${fs}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(rank, 5 * s, 18 * s);
    ctx.font = `${fs * 0.75}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(suit, 6 * s, 32 * s);

    // Bottom-right (rotated)
    ctx.save();
    ctx.translate(w - 5 * s, h - 5 * s);
    ctx.rotate(Math.PI);
    ctx.fillStyle = color;
    ctx.font = `bold ${fs}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(rank, 0, 15 * s);
    ctx.font = `${fs * 0.75}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(suit, 2 * s, 27 * s);
    ctx.restore();

    // Center icon — large elegant suit
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.font = `bold ${fs * 1.8}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suit, w / 2, h / 2 + 2 * s);

    // Small center pip
    ctx.globalAlpha = 1;
    ctx.font = `bold ${fs * 1.2}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(suit, w / 2, h / 2 + 2 * s);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawJoker(ctx, card, w, h, s) {
    const isBig = card.jokerType === 'big';
    const color = isBig ? '#c62828' : '#1a1a1a';

    // Subtle background tint
    rr(ctx, 0, 0, w, h, 7 * s);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, isBig ? 'rgba(200,30,30,0.08)' : 'rgba(0,0,0,0.05)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.fill();

    // Top label
    const label = isBig ? '大王' : '小王';
    ctx.fillStyle = color;
    ctx.font = `bold ${13 * s}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(label, 4 * s, 18 * s);

    // Center 王 character
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${38 * s}px "Microsoft YaHei", sans-serif`;
    ctx.fillText('王', w / 2, h / 2 - 3 * s);

    // Subtitle
    ctx.font = `bold ${14 * s}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(isBig ? '大' : '小', w / 2, h / 2 + 25 * s);

    // Corner stars
    ctx.font = `${11 * s}px "Microsoft YaHei", sans-serif`;
    const star = isBig ? '★' : '☆';
    const starColor = isBig ? '#ff5252' : '#888';
    ctx.fillStyle = starColor;
    ctx.fillText(star, w - 16 * s, 17 * s);
    ctx.fillText(star, 16 * s, h - 12 * s);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawCardBack(ctx, x, y, w, h) {
    const s = Math.min(w, h) / 75;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4 * s;
    ctx.shadowOffsetX = 1 * s;
    ctx.shadowOffsetY = 2 * s;
    rr(ctx, 0, 0, w, h, 6 * s);
    ctx.fillStyle = '#1a237e';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Outer border
    rr(ctx, 0, 0, w, h, 6 * s);
    ctx.strokeStyle = '#0d1555';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Inner white border
    rr(ctx, 5 * s, 5 * s, w - 10 * s, h - 10 * s, 3 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();

    // Dashed inner border
    rr(ctx, 10 * s, 10 * s, w - 20 * s, h - 20 * s, 2 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.8 * s;
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center diamond pattern
    const cx = w / 2, cy = h / 2;
    const d = Math.min(w, h) * 0.22;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(-d / 2, -d / 2, d, d);
    ctx.restore();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Tiny center spade
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `${14 * s}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♠', cx, cy);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  return { drawCardFace, drawCardBack, decode };
})();
