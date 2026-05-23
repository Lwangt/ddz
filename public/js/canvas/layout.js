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

  // Play area (center table)
  function playArea() {
    const ib = infoBar();
    const ch = cardH();
    const marginX = 180 * scale; // left/right for character pods
    const topMargin = 170 * scale; // top for character + name
    return {
      x: marginX,
      y: ib.y + ib.h + topMargin,
      w: w - marginX * 2,
      h: h - ib.h - ch - 130 * scale - topMargin
    };
  }

  // Bottom player (self) — character on left, hand cards on right
  function p0Area() {
    const ch = cardH();
    const btnH = 52 * scale;
    const charW = 115 * scale;
    return {
      x: charW + 10 * scale,
      y: h - ch - btnH - 18 * scale,
      w: w - charW - 16 * scale,
      h: ch + 30 * scale
    };
  }

  // Self character zone: bottom-left
  function selfCharZone() {
    const p0 = p0Area();
    const ch = cardH();
    const btnH = 52 * scale;
    const charW = 110 * scale;
    const charH = 140 * scale;
    const podBottom = h - btnH - 4 * scale;
    return {
      x: 6 * scale,
      y: podBottom - charH,
      w: charW,
      h: charH
    };
  }

  // Top opponent pod — character + cards below
  function p2Area() {
    const ib = infoBar();
    const charH = 130 * scale;
    const ch = cardH() * 0.55;
    return {
      x: w * 0.28,
      y: ib.y + ib.h + charH + 12 * scale,
      w: w * 0.44,
      h: ch + 20 * scale
    };
  }

  // Top opponent character zone: below info bar, above cards
  function topCharZone() {
    const ib = infoBar();
    const p2 = p2Area();
    const charW = 100 * scale;
    const charH = 130 * scale;
    return {
      x: w / 2 - charW / 2,
      y: ib.y + ib.h + 4 * scale,
      w: charW,
      h: Math.min(charH, p2.y - ib.y - ib.h - 8 * scale)
    };
  }

  // Left opponent pod — character above, rotated cards below
  function p1Area() {
    const cw = cardW(), ch = cardH();
    const pa = playArea();
    const charH = 110 * scale;
    const cardAreaH = ch * 0.55 * 4; // vertical cards stacked
    const totalH = charH + 20 * scale + cardAreaH;
    return {
      x: 4 * scale,
      y: pa.y + pa.h / 2 - totalH / 2,
      w: Math.max(ch * 0.55, 55 * scale),
      h: cardAreaH
    };
  }

  // Left opponent character zone: above the rotated cards
  function leftCharZone() {
    const p1 = p1Area();
    const charW = 85 * scale;
    const charH = 110 * scale;
    return {
      x: 4 * scale,
      y: p1.y - charH - 8 * scale,
      w: Math.min(charW, 100 * scale),
      h: charH
    };
  }

  // Buttons
  function buttonArea() {
    const p0 = p0Area();
    const btnH = Math.max(46, 52 * scale);
    return {
      x: w * 0.08,
      y: p0.y + p0.h + 4 * scale,
      w: w * 0.84,
      h: Math.min(btnH, h - p0.y - p0.h - 8 * scale) // don't overflow screen
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

  const HAND_OVERLAP = 0.55;  // Less overlap = more visible area per card

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

  function hitTestHand(mx, my, handSize, selectedSet) {
    const positions = getHandPositions(handSize);
    const expand = 10;

    // Pass 1: find first UNSELECTED card (right to left z-order)
    for (let i = positions.length - 1; i >= 0; i--) {
      if (selectedSet && selectedSet.has(i)) continue;
      const p = positions[i];
      const isLast = (i === positions.length - 1);
      const clickL = p.x;
      const clickR = isLast ? p.x + p.w : p.x + p.w * (1 - HAND_OVERLAP) + expand;
      if (mx >= clickL - expand && mx <= clickR && my >= p.y - expand && my <= p.y + p.h + expand) {
        return i;
      }
    }

    // Pass 2: if no unselected card matched, check SELECTED cards (for deselection)
    if (selectedSet && selectedSet.size > 0) {
      for (let i = positions.length - 1; i >= 0; i--) {
        if (!selectedSet.has(i)) continue;
        const p = positions[i];
        const isLast = (i === positions.length - 1);
        const clickL = p.x;
        const clickR = isLast ? p.x + p.w : p.x + p.w * (1 - HAND_OVERLAP) + expand;
        if (mx >= clickL - expand && mx <= clickR && my >= p.y - expand && my <= p.y + p.h + expand) {
          return i;
        }
      }
    }

    return -1;
  }

  function hitTestButton(mx, my, buttonLayout) {
    if (!buttonLayout) return null;
    const expand = 14;
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
    topCharZone, leftCharZone, selfCharZone,
    hitTestHand, hitTestButton,
  };
})();
