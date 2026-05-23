// Input handler — correct coordinate mapping for letterboxed game area
const InputHandler = (() => {
  let canvas = null;
  let controller = null;

  function init(cvs, ctrl) {
    canvas = cvs;
    controller = ctrl;
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  }

  function getGameCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const ga = window.gameArea || { x: 0, y: 0 };
    return {
      x: cssX - ga.x,
      y: cssY - ga.y
    };
  }

  function onMouseMove(e) {
    const { x, y } = getGameCoords(e.clientX, e.clientY);
    const gs = controller.gameState;
    if (!gs) return;
    const handSize = gs.hand ? gs.hand.length : 0;
    const hoveredCard = Layout.hitTestHand(x, y, handSize);
    const btnLayout = gs._buttonLayout;
    const hoveredBtn = Layout.hitTestButton(x, y, btnLayout);
    canvas.style.cursor = (hoveredCard >= 0 || hoveredBtn) ? 'pointer' : 'default';
  }

  function onClick(e) {
    handleTap(e.clientX, e.clientY);
  }

  function onTouchStart(e) {
    e.preventDefault();
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length === 1) {
      handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
  }

  function handleTap(clientX, clientY) {
    const { x, y } = getGameCoords(clientX, clientY);
    const gs = controller.gameState;
    if (!gs) return;

    const btnLayout = gs._buttonLayout;
    const btnId = Layout.hitTestButton(x, y, btnLayout);
    if (btnId && controller.onButtonClick) {
      const btn = btnLayout.find(b => b.id === btnId);
      if (!btn || !btn.disabled) {
        controller.onButtonClick(btnId);
        return;
      }
    }

    const handSize = gs.hand.length;
    const cardIdx = Layout.hitTestHand(x, y, handSize);
    if (cardIdx >= 0 && controller.onCardClick) {
      controller.onCardClick(cardIdx);
    }
  }

  return { init };
})();
