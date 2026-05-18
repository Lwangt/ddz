// Unified layout — fixed 16:9 ratio (1200×675), uniform scaling for all devices
const Layout = (() => {
  let w, h, scale;

  function recalculate(cssW, cssH) {
    w = cssW;
    h = cssH;
    scale = Math.min(w / 1200, h / 675);
  }

  function cardW() { return 75 * scale; }
  function cardH() { return 108 * scale; }
  function cardR() { return 6 * scale; }

  // ── Zones ────────────────────────────────────────────────

  function infoBar() {
    return { x: 0, y: 0, w, h: 46 * scale };
  }

  // Play area (center)
  function playArea() {
    const ib = infoBar();
    const ch = cardH();
    const margin = 160 * scale; // space for left/right opponents
    return {
      x: margin,
      y: ib.y + ib.h + 60 * scale,
      w: w - margin * 2,
      h: h - ib.h - ch - 130 * scale - 60 * scale
    };
  }

  // Bottom player (you)
  function p0Area() {
    const ch = cardH();
    const btnH = 52 * scale;
    return {
      x: w * 0.03,
      y: h - ch - btnH - 18 * scale,
      w: w * 0.94,
      h: ch + 30 * scale
    };
  }

  // Top opponent
  function p2Area() {
    const ib = infoBar();
    const ch = cardH() * 0.7;
    return {
      x: w * 0.25,
      y: ib.y + ib.h + 4 * scale,
      w: w * 0.5,
      h: ch + 26 * scale
    };
  }

  // Left opponent
  function p1Area() {
    const cw = cardW(), ch = cardH();
    const pa = playArea();
    return {
      x: 8 * scale,
      y: pa.y + 20 * scale,
      w: ch * 0.6 + 8 * scale,
      h: pa.h * 0.7
    };
  }

  // Buttons
  function buttonArea() {
    const p0 = p0Area();
    return {
      x: w * 0.12,
      y: p0.y + p0.h + 4 * scale,
      w: w * 0.76,
      h: 48 * scale
    };
  }

  function timerArea() {
    const ch = cardH();
    return {
      x: w * 0.12,
      y: h - ch - 130 * scale,
      w: w * 0.76,
      h: 8 * scale
    };
  }

  function toastArea() {
    const ib = infoBar();
    return { x: w * 0.2, y: ib.y + ib.h + 6 * scale, w: w * 0.6, h: 32 * scale };
  }

  // ── Card positioning ─────────────────────────────────────

  const HAND_OVERLAP = 0.62;

  function getHandPositions(count) {
    if (count === 0) return [];
    const cw = cardW(), ch = cardH();
    const area = p0Area();
    const visibleW = cw * (1 - HAND_OVERLAP);
    const totalW = cw + (count - 1) * visibleW;
    const startX = area.x + (area.w - totalW) / 2;
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push({ x: startX + i * visibleW, y: area.y + 14 * scale, w: cw, h: ch });
    }
    return pos;
  }

  function getOpponentHPositions(count) {
    if (count === 0) return [];
    const cw = cardW() * 0.6, ch = cardH() * 0.6;
    const area = p2Area();
    const overlap = 0.78;
    const visibleW = cw * (1 - overlap);
    const totalW = cw + (count - 1) * visibleW;
    const startX = area.x + (area.w - totalW) / 2;
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push({ x: startX + i * visibleW, y: area.y + 6 * scale, w: cw, h: ch });
    }
    return pos;
  }

  function getOpponentVPositions(count) {
    if (count === 0) return [];
    const cw = cardH() * 0.55, ch = cardW() * 0.55;
    const area = p1Area();
    const visibleH = ch * 0.22;
    const totalH = ch + (count - 1) * visibleH;
    const startY = area.y + (area.h - totalH) / 2;
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push({ x: area.x + 2 * scale, y: startY + i * visibleH, w: cw, h: ch, rotated: true });
    }
    return pos;
  }

  function getPlayedCardPositions(cardIds, playerSeat) {
    const cw = cardW(), ch = cardH();
    const area = playArea();
    const count = cardIds.length;
    if (count === 0) return [];
    const spacing = Math.min(cw * 0.45, (area.w - cw) / Math.max(count - 1, 1));
    const totalW = cw + (count - 1) * spacing;
    let cx = area.x + (area.w - totalW) / 2;
    let cy = area.y + area.h * 0.45;
    if (playerSeat === 1) cy = area.y + area.h * 0.3;
    else if (playerSeat === 2) cy = area.y + area.h * 0.15;
    return cardIds.map((_, i) => ({ x: cx + i * spacing, y: cy - ch / 2, w: cw, h: ch }));
  }

  function getBonusCardPositions() {
    const cw = cardW(), ch = cardH();
    const ib = infoBar();
    const gap = cw * 0.5;
    return [0, 1, 2].map(i => ({
      x: 10 * scale + i * (cw * 0.75 + gap),
      y: ib.y + ib.h + 6 * scale,
      w: cw * 0.75,
      h: ch * 0.75
    }));
  }

  // ── Action zones ─────────────────────────────────────────

  function selfActionZone() {
    const p0 = p0Area();
    const ch = cardH();
    return { x: p0.x, y: p0.y - ch * 0.5 - 2 * scale, w: p0.w, h: ch * 0.45 };
  }

  function leftActionZone() {
    const p1 = p1Area();
    const cw = cardW();
    return { x: p1.x + p1.w + 2 * scale, y: p1.y + p1.h * 0.25, w: w * 0.1, h: cardH() * 0.45 };
  }

  function topActionZone() {
    const p2 = p2Area();
    return { x: p2.x, y: p2.y + p2.h + 2 * scale, w: p2.w, h: cardH() * 0.45 };
  }

  function getActionZone(dispPos) {
    if (dispPos === 0) return selfActionZone();
    if (dispPos === 1) return leftActionZone();
    return topActionZone();
  }

  // ── Hit testing ──────────────────────────────────────────

  function hitTestHand(mx, my, handSize) {
    const positions = getHandPositions(handSize);
    const expand = 6;
    for (let i = positions.length - 1; i >= 0; i--) {
      const p = positions[i];
      const isLast = (i === positions.length - 1);
      const clickR = isLast ? p.x + p.w : p.x + p.w * (1 - HAND_OVERLAP);
      if (mx >= p.x - expand && mx <= clickR + expand && my >= p.y - expand && my <= p.y + p.h + expand) {
        return i;
      }
    }
    return -1;
  }

  function hitTestButton(mx, my, buttonLayout) {
    if (!buttonLayout) return null;
    const expand = 8;
    for (const btn of buttonLayout) {
      if (mx >= btn.x - expand && mx <= btn.x + btn.w + expand &&
          my >= btn.y - expand && my <= btn.y + btn.h + expand) {
        return btn.id;
      }
    }
    return null;
  }

  return {
    recalculate, scale: () => scale, cssW: () => w, cssH: () => h,
    cardW, cardH, cardR,
    infoBar, p0Area, p1Area, p2Area, playArea, buttonArea, timerArea, toastArea,
    getHandPositions, getOpponentHPositions, getOpponentVPositions,
    getPlayedCardPositions, getBonusCardPositions,
    selfActionZone, leftActionZone, topActionZone, getActionZone,
    hitTestHand, hitTestButton,
  };
})();
