// src/components/pages/Chat/SwipeToReply.jsx
import React, { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 60; // px of drag needed to trigger reply
const MAX_DRAG = 80; // px cap before rubber-banding kicks in

/**
 * Wraps a message bubble so it can be swiped horizontally (like WhatsApp)
 * to trigger a reply. Only fires `onReply` once per gesture, when the
 * drag passes SWIPE_THRESHOLD. Works with touch and mouse.
 *
 * direction="right" (default) → swipe left-to-right triggers reply,
 *   icon reveals on the left. Use for incoming/partner messages.
 * direction="left" → swipe right-to-left triggers reply,
 *   icon reveals on the right. Use for your own/outgoing messages.
 */
const SwipeToReply = ({ children, onReply, enabled = true, direction = 'right' }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const lockedAxis = useRef(null); // 'x' | 'y' | null, decided after a small move
  const triggered = useRef(false);

  const sign = direction === 'left' ? -1 : 1;

  const handleStart = (clientX, clientY) => {
    if (!enabled) return;
    startX.current = clientX;
    startY.current = clientY;
    dragging.current = true;
    lockedAxis.current = null;
    triggered.current = false;
    setIsDragging(true);
  };

  const handleMove = (clientX, clientY) => {
    if (!enabled || !dragging.current) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;

    // Decide once whether this gesture is a horizontal swipe or a vertical
    // scroll, so we never fight the message list's own scrolling.
    if (!lockedAxis.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxis.current !== 'x') return;

    // Only the configured direction triggers reply; the opposite
    // direction is ignored (dragged distance stays at 0).
    const directional = dx * sign; // positive when dragging the "correct" way
    const clamped = Math.max(0, directional);
    const rubberBanded =
      clamped < MAX_DRAG ? clamped : MAX_DRAG + (clamped - MAX_DRAG) * 0.15;

    setDragX(rubberBanded * sign);

    if (rubberBanded >= SWIPE_THRESHOLD && !triggered.current) {
      triggered.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
      }
    }
  };

  const handleEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);

    if (triggered.current) {
      onReply?.();
    }
    setDragX(0);
    lockedAxis.current = null;
    triggered.current = false;
  };

  // ─── Touch ──────────────────────────────────────────────────
  const onTouchStart = (e) => {
    const t = e.touches[0];
    handleStart(t.clientX, t.clientY);
  };
  const onTouchMove = (e) => {
    const t = e.touches[0];
    handleMove(t.clientX, t.clientY);
  };
  const onTouchEnd = () => handleEnd();

  // ─── Mouse (handy for desktop testing) ─────────────────────
  const onMouseDown = (e) => {
    handleStart(e.clientX, e.clientY);
    const onMouseMove = (ev) => handleMove(ev.clientX, ev.clientY);
    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!enabled) {
    return <>{children}</>;
  }

  const iconProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const iconSide = direction === 'left' ? { right: '6px' } : { left: '6px' };

  return (
    <div className="swipe-to-reply-wrapper" style={{ position: 'relative' }}>
      <div
        className="swipe-reply-icon"
        style={{
          position: 'absolute',
          ...iconSide,
          top: '50%',
          transform: `translateY(-50%) scale(${0.6 + iconProgress * 0.4})`,
          opacity: iconProgress,
          color: 'var(--text-muted)',
          fontSize: '18px',
          pointerEvents: 'none',
          transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <i className="fas fa-reply" />
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onMouseDown}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToReply;