// Touch-optimized input handler with expanded hit areas on mobile
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
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    // Prevent double-tap zoom on canvas
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
  }

  function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function onMouseMove(e) {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const handSize = controller.gameState ? controller.gameState.hand.length : 0;
    const hoveredCard = Layout.hitTestHand(x, y, handSize);
    const btnLayout = controller.gameState ? controller.gameState._buttonLayout : null;
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
      const touch = e.changedTouches[0];
      handleTap(touch.clientX, touch.clientY);
    }
  }

  function onTouchMove(e) {
    // Allow scrolling if not on canvas elements, prevent on game area
    const touch = e.touches[0];
    if (touch) {
      const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
      const handSize = controller.gameState ? controller.gameState.hand.length : 0;
      const onCard = Layout.hitTestHand(x, y, handSize) >= 0;
      if (onCard) e.preventDefault();
    }
  }

  function handleTap(clientX, clientY) {
    const { x, y } = getCanvasCoords(clientX, clientY);
    const gs = controller.gameState;
    if (!gs) return;

    // Check buttons first
    const btnLayout = gs._buttonLayout;
    const btnId = Layout.hitTestButton(x, y, btnLayout);
    if (btnId && controller.onButtonClick && !isDisabledBtn(btnId, btnLayout)) {
      controller.onButtonClick(btnId);
      return;
    }

    // Check hand cards
    const handSize = gs.hand.length;
    const cardIdx = Layout.hitTestHand(x, y, handSize);
    if (cardIdx >= 0 && controller.onCardClick) {
      controller.onCardClick(cardIdx);
    }
  }

  function isDisabledBtn(btnId, btnLayout) {
    const btn = btnLayout.find(b => b.id === btnId);
    return btn && btn.disabled;
  }

  return { init };
})();
