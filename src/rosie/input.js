// Drag to turn the orb; a tap (a press that doesn't move) greets her with a pulse.
const TAP_SLOP = 8;   // px a press may move and still count as a tap

export function bindInput(canvas, orb) {
  const drag = orb.drag;
  let lastX = 0, lastY = 0, downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', e => {
    drag.active = true; lastX = downX = e.clientX; lastY = downY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag.active) return;
    drag.x += (e.clientX - lastX) * .008; drag.y += (e.clientY - lastY) * .008;
    drag.y = Math.max(-1, Math.min(1, drag.y)); lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', e => {
    drag.active = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < TAP_SLOP) orb.tap();
  });
}
