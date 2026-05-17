// Responsive layout calculator — desktop, tablet, and mobile modes
const Layout = (() => {
  let w, h, scale;
  let mode = 'desktop';       // 'desktop' | 'tablet' | 'mobile'
  let baseCardW, baseCardH;   // base card dimensions for current mode
  let handOverlap = 0.6;      // dynamic overlap ratio

  // Breakpoints
  const DESKTOP_MIN_W = 900;
  const TABLET_MIN_W = 600;

  function recalculate(cssW, cssH) {
    w = cssW;
    h = cssH;

    if (w >= DESKTOP_MIN_W) {
      mode = 'desktop';
      baseCardW = 70;
      baseCardH = 100;
      handOverlap = 0.6;
    } else if (w >= TABLET_MIN_W) {
      mode = 'tablet';
      baseCardW = 56;
      baseCardH = 80;
      handOverlap = 0.65;
    } else {
      mode = 'mobile';
      baseCardW = 48;
      baseCardH = 68;
      handOverlap = 0.72;
    }

    scale = Math.min(w / 1200, h / 800);
  }

  function cardW()  { return baseCardW * scale; }
  function cardH()  { return baseCardH * scale; }
  function cardR()  { return Math.max(3, 6 * scale); }
  function isMobile() { return mode === 'mobile'; }
  function isDesktop() { return mode === 'desktop'; }
  function getMode() { return mode; }

  // ── Layout zones ─────────────────────────────────────────

  function infoBar() {
    return { x: 0, y: 0, w, h: Math.max(32, 44 * scale) };
  }

  // Top opponent (seat 2 in display)
  function p2Area() {
    const cw = cardW(), ch = cardH();
    const cols = Math.min(10, Math.floor((w * 0.6) / (cw * 0.3)));
    return {
      x: (w - cw * cols * 0.3) / 2,
      y: infoBar().h + Math.max(4, 8 * scale),
      w: cw * cols * 0.3,
      h: ch + Math.max(20, 30 * scale)
    };
  }

  // Left opponent (seat 1 in display)
  function p1Area() {
    const cw = cardW(), ch = cardH();
    if (isMobile()) {
      return {
        x: 4 * scale,
        y: h * 0.15,
        w: ch * 0.6 + 4 * scale,
        h: h * 0.35
      };
    }
    return {
      x: 6 * scale,
      y: h * 0.18,
      w: ch + 8 * scale,
      h: h * 0.45
    };
  }

  // Center play area
  function playArea() {
    const p1 = p1Area();
    const p2 = p2Area();
    const marginX = isMobile() ? 8 * scale : 20 * scale;
    const leftEdge = p1.x + p1.w + marginX;
    return {
      x: leftEdge,
      y: p2.y + p2.h + Math.max(4, 6 * scale),
      w: w - leftEdge * 2 + marginX,
      h: h * (isMobile() ? 0.28 : 0.32)
    };
  }

  // Bottom player (seat 0 = you)
  function p0Area() {
    const ch = cardH();
    const btnH = isMobile() ? 80 * scale : 52 * scale;
    return {
      x: w * 0.02,
      y: h - ch - btnH - Math.max(10, 20 * scale),
      w: w * 0.96,
      h: ch + Math.max(20, 40 * scale)
    };
  }

  // Action buttons area
  function buttonArea() {
    const p0 = p0Area();
    if (isMobile()) {
      return {
        x: w * 0.03,
        y: p0.y + p0.h + 4 * scale,
        w: w * 0.94,
        h: 52 * scale
      };
    }
    return {
      x: w * 0.2,
      y: p0.y + p0.h + 6 * scale,
      w: w * 0.6,
      h: 46 * scale
    };
  }

  // Timer bar area
  function timerArea() {
    const ch = cardH();
    if (isMobile()) {
      return {
        x: w * 0.1,
        y: h - ch - 100 * scale,
        w: w * 0.8,
        h: 8 * scale
      };
    }
    return {
      x: w * 0.15,
      y: h - ch - 150 * scale,
      w: w * 0.7,
      h: 10 * scale
    };
  }

  // ── Card positioning ─────────────────────────────────────

  // Adaptive hand overlap: increase if cards would overflow
  function adaptiveOverlap(count) {
    const cw = cardW();
    const area = p0Area();
    const available = area.w * 0.95;
    const minVisible = cw * 0.28; // at least 28% of a card visible for clicking
    const overlap = 1 - (available - cw) / ((count - 1) * cw);
    return Math.min(0.82, Math.max(handOverlap, overlap));
  }

  function getHandPositions(count) {
    if (count === 0) return [];
    const cw = cardW(), ch = cardH();
    const area = p0Area();
    const overlap = adaptiveOverlap(count);
    const visibleW = cw * (1 - overlap);
    const totalW = cw + (count - 1) * visibleW;
    const startX = area.x + (area.w - totalW) / 2;

    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push({
        x: startX + i * visibleW,
        y: area.y + (isMobile() ? 8 : 20) * scale,
        w: cw,
        h: ch
      });
    }
    return positions;
  }

  function getOpponentHPositions(count) {
    if (count === 0) return [];
    const cw = cardW() * (isMobile() ? 0.55 : 0.7);
    const ch = cardH() * (isMobile() ? 0.55 : 0.7);
    const area = p2Area();
    const overlapRatio = isMobile() ? 0.82 : 0.75;
    const visibleW = cw * (1 - overlapRatio);
    const totalW = cw + (count - 1) * visibleW;
    const startX = area.x + (area.w - totalW) / 2;

    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push({
        x: startX + i * visibleW,
        y: area.y + (isMobile() ? 4 : 8) * scale,
        w: cw,
        h: ch
      });
    }
    return positions;
  }

  function getOpponentVPositions(count) {
    if (count === 0) return [];
    const cw = cardH() * (isMobile() ? 0.5 : 0.7);
    const ch = cardW() * (isMobile() ? 0.5 : 0.7);
    const area = p1Area();
    const visibleH = ch * 0.25;
    const totalH = ch + (count - 1) * visibleH;
    const startY = area.y + (area.h - totalH) / 2;

    const positions = [];
    for (let i = 0; i < count; i++) {
      positions.push({
        x: area.x + 2 * scale,
        y: startY + i * visibleH,
        w: cw,
        h: ch,
        rotated: true
      });
    }
    return positions;
  }

  function getPlayedCardPositions(cardIds, playerSeat) {
    const cw = cardW(), ch = cardH();
    const area = playArea();
    const count = cardIds.length;
    if (count === 0) return [];

    const spacing = Math.min(cw * 0.5, (area.w - cw) / Math.max(count - 1, 1));
    const totalW = cw + (count - 1) * spacing;
    let cx = area.x + (area.w - totalW) / 2;
    let cy = area.y + area.h / 2;

    if (playerSeat === 1) cy = area.y + area.h * 0.3;
    else if (playerSeat === 2) cy = area.y + area.h * 0.15;

    return cardIds.map((_, i) => ({
      x: cx + i * spacing,
      y: cy - ch / 2,
      w: cw,
      h: ch
    }));
  }

  function getBonusCardPositions() {
    const cw = cardW(), ch = cardH();
    const pa = playArea();
    const gap = isMobile() ? cw * 0.6 : cw * 1.1;
    return [0, 1, 2].map(i => ({
      x: pa.x + pa.w / 2 - gap * 1.5 + i * gap,
      y: pa.y + pa.h / 2 - ch / 2,
      w: cw,
      h: ch
    }));
  }

  // ── Hit testing ──────────────────────────────────────────

  function hitTestHand(mx, my, handSize) {
    const positions = getHandPositions(handSize);
    const overlap = adaptiveOverlap(handSize);
    // On mobile, expand hit area by 8px (in CSS coords) for touch friendliness
    const expand = isMobile() ? 8 : 0;

    for (let i = positions.length - 1; i >= 0; i--) {
      const p = positions[i];
      const clickableLeft = p.x + p.w * overlap;
      if (mx >= clickableLeft - expand && mx <= p.x + p.w + expand &&
          my >= p.y - expand && my <= p.y + p.h + expand) {
        return i;
      }
    }
    return -1;
  }

  function hitTestButton(mx, my, buttonLayout) {
    if (!buttonLayout) return null;
    const expand = isMobile() ? 6 : 0;
    for (const btn of buttonLayout) {
      if (mx >= btn.x - expand && mx <= btn.x + btn.w + expand &&
          my >= btn.y - expand && my <= btn.y + btn.h + expand) {
        return btn.id;
      }
    }
    return null;
  }

  // ── Toast position ───────────────────────────────────────

  function toastArea() {
    return {
      x: w * 0.15,
      y: infoBar().h + 8 * scale,
      w: w * 0.7,
      h: 36 * scale
    };
  }

  return {
    recalculate,
    scale: () => scale,
    cssW: () => w,
    cssH: () => h,
    cardW, cardH, cardR,
    isMobile, isDesktop, getMode,
    infoBar, p0Area, p1Area, p2Area, playArea, buttonArea, timerArea, toastArea,
    getHandPositions,
    getOpponentHPositions,
    getOpponentVPositions,
    getPlayedCardPositions,
    getBonusCardPositions,
    hitTestHand,
    hitTestButton,
  };
})();
