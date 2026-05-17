// Enhanced card rendering with gradients, layered shadows, and polished visuals
const CardDrawer = (() => {
  const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'];
  const SUIT_COLORS = ['#1a1a1a', '#d32f2f', '#1a1a1a', '#d32f2f'];
  const SUIT_LIGHT = ['#555', '#ff6b6b', '#555', '#ff6b6b'];
  const RANK_NAMES = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

  function decode(id) {
    if (id === 52) return { suit: -1, rank: 13, isJoker: true, jokerType: 'small' };
    if (id === 53) return { suit: -1, rank: 14, isJoker: true, jokerType: 'big' };
    return {
      suit: Math.floor(id / 13),
      rank: id % 13,
      isJoker: false
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  // Draw layered shadow under card
  function drawShadow(ctx, x, y, w, h, s, lifted) {
    const l = lifted ? 15 * s : 4 * s;
    ctx.save();
    // Outer soft shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = l;
    ctx.shadowOffsetX = 2 * s;
    ctx.shadowOffsetY = (2 + (lifted ? 6 : 0)) * s;
    roundRect(ctx, x, y, w, h, 6 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();
  }

  function drawCardFace(ctx, cardId, x, y, w, h, selected) {
    const card = decode(cardId);
    const s = Math.min(w, h) / 70;
    const lift = selected ? -22 * s : 0;

    ctx.save();
    ctx.translate(x, y + lift);

    // Layered shadow
    drawShadow(ctx, 0, 0, w, h, s, selected);

    // Card body with subtle gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#fafafa');
    grad.addColorStop(1, '#f0f0f0');
    roundRect(ctx, 0, 0, w, h, 6 * s);
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner subtle border
    roundRect(ctx, 1.5 * s, 1.5 * s, w - 3 * s, h - 3 * s, 5 * s);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();

    // Outer border
    roundRect(ctx, 0, 0, w, h, 6 * s);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();

    if (card.isJoker) {
      drawJokerFace(ctx, card, w, h, s);
    } else {
      drawStandardFace(ctx, card, w, h, s);
    }

    // Selection highlight
    if (selected) {
      roundRect(ctx, -1 * s, -1 * s, w + 2 * s, h + 2 * s, 7 * s);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3 * s;
      ctx.shadowColor = 'rgba(255,215,0,0.7)';
      ctx.shadowBlur = 10 * s;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }

    ctx.restore();
  }

  function drawStandardFace(ctx, card, w, h, s) {
    const color = SUIT_COLORS[card.suit];
    const lightColor = SUIT_LIGHT[card.suit];
    const rankTxt = RANK_NAMES[card.rank];
    const suitTxt = SUIT_SYMBOLS[card.suit];

    const fontSize = 14 * s;
    const suitFontSize = 11 * s;

    // Top-left rank + suit
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillText(rankTxt, 5 * s, 17 * s);
    ctx.font = `${suitFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(suitTxt, 6 * s, 32 * s);

    // Bottom-right (rotated 180°)
    ctx.save();
    ctx.translate(w - 5 * s, h - 5 * s);
    ctx.rotate(Math.PI);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillText(rankTxt, 0, 14 * s);
    ctx.font = `${suitFontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(suitTxt, 1 * s, 27 * s);
    ctx.restore();

    // Center suit symbol — larger, semi-transparent for elegance
    ctx.fillStyle = lightColor;
    ctx.globalAlpha = 0.45;
    ctx.font = `bold ${28 * s}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitTxt, w / 2, h / 2 + 2 * s);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  function drawJokerFace(ctx, card, w, h, s) {
    const isBig = card.jokerType === 'big';
    const darkColor = '#1a1a1a';
    const redColor = '#c62828';

    // Joker gradient background
    const grad = ctx.createLinearGradient(0, 0, w, h * 0.3);
    grad.addColorStop(0, isBig ? 'rgba(200,30,30,0.12)' : 'rgba(0,0,0,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, 0, 0, w, h, 6 * s);
    ctx.fillStyle = grad;
    ctx.fill();

    const jokerColor = isBig ? redColor : darkColor;
    const label = isBig ? '大' : '小';
    const fullLabel = isBig ? '大王' : '小王';

    // Top-left mini label
    ctx.fillStyle = jokerColor;
    ctx.font = `bold ${13 * s}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(fullLabel, 4 * s, 16 * s);

    // Large center 王 character
    ctx.fillStyle = jokerColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${36 * s}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillText('王', w / 2, h / 2 - 5 * s);

    // Subtitle
    ctx.font = `bold ${15 * s}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(label, w / 2, h / 2 + 24 * s);

    // Decorative corner stars
    ctx.font = `${10 * s}px "Microsoft YaHei", sans-serif`;
    const star = isBig ? '★' : '☆';
    ctx.fillText(star, w - 14 * s, 14 * s);
    ctx.fillText(star, 14 * s, h - 10 * s);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawCardBack(ctx, x, y, w, h) {
    const s = Math.min(w, h) / 70;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4 * s;
    ctx.shadowOffsetX = 1 * s;
    ctx.shadowOffsetY = 2 * s;
    roundRect(ctx, 0, 0, w, h, 5 * s);
    ctx.fillStyle = '#1a237e';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Outer border
    roundRect(ctx, 0, 0, w, h, 5 * s);
    ctx.strokeStyle = '#0d1555';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Inner border 1
    const inset1 = 5 * s;
    roundRect(ctx, inset1, inset1, w - 2 * inset1, h - 2 * inset1, 3 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();

    // Inner border 2 (dashed)
    const inset2 = 10 * s;
    roundRect(ctx, inset2, inset2, w - 2 * inset2, h - 2 * inset2, 2 * s);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8 * s;
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center diamond motif
    const cx = w / 2, cy = h / 2;
    const d = Math.min(w, h) * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d * 0.6, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d * 0.6, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    // Tiny center symbol
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = `${16 * s}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🂠', cx, cy);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  return { drawCardFace, drawCardBack, decode };
})();
