// src/components/common/MediaPreview.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './MediaPreview.css';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_DISMISS_PX = 100;

const MediaPreview = ({ src, alt = '', onClose }) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);

  // Pinch state
  const pinchRef = useRef({
    active: false,
    startDist: 0,
    startScale: 1,
    startMid: { x: 0, y: 0 },
    startTranslate: { x: 0, y: 0 },
  });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const lastTapRef = useRef(0);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose?.(), 180);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const resetTransform = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setDragY(0);
  };

  const clampTranslate = (tx, ty, s) => {
    const max = ((s - 1) * (containerRef.current?.clientWidth || 0)) / 2;
    const maxY = ((s - 1) * (containerRef.current?.clientHeight || 0)) / 2;
    return {
      x: Math.max(-max, Math.min(max, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  };

  // ─── Wheel zoom (desktop) ────────────────────────────────
  const handleWheel = (e) => {
    e.preventDefault();
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale - e.deltaY * 0.002));
    setScale(next);
    if (next === 1) setTranslate({ x: 0, y: 0 });
  };

  // ─── Touch: pinch / pan / double-tap / drag-to-dismiss ──
  const getDistance = (t1, t2) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        active: true,
        startDist: getDistance(e.touches[0], e.touches[1]),
        startScale: scale,
        startMid: {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        },
        startTranslate: translate,
      };
      return;
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double-tap zoom toggle
        if (scale > 1) {
          resetTransform();
        } else {
          setScale(DOUBLE_TAP_ZOOM);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      dragRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: translate.x,
        startTy: translate.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (pinchRef.current.active && e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchRef.current.startDist;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.startScale * ratio));
      setScale(nextScale);
      return;
    }

    if (dragRef.current.active && e.touches.length === 1) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;

      if (scale > 1) {
        // Pan while zoomed
        const next = clampTranslate(
          dragRef.current.startTx + dx,
          dragRef.current.startTy + dy,
          scale
        );
        setTranslate(next);
      } else {
        // Drag-to-dismiss
        setDragY(dy);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (pinchRef.current.active && e.touches.length < 2) {
      pinchRef.current.active = false;
      if (scale < 1.05) resetTransform();
    }

    if (dragRef.current.active && e.touches.length === 0) {
      dragRef.current.active = false;
      if (scale === 1 && Math.abs(dragY) > SWIPE_DISMISS_PX) {
        handleClose();
      } else if (dragY !== 0) {
        setDragY(0);
      }
    }
  };

  // ─── Mouse drag (desktop when zoomed) ────────────────────
  const handleMouseDown = (e) => {
    if (scale === 1) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTx: translate.x,
      startTy: translate.y,
    };
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTranslate(clampTranslate(dragRef.current.startTx + dx, dragRef.current.startTy + dy, scale));
  };
  const handleMouseUp = () => { dragRef.current.active = false; };

  const overlayOpacity = Math.max(0.4, 1 - Math.abs(dragY) / 400);

  return (
    <div
      className={`media-lightbox-overlay ${closing ? 'closing' : ''}`}
      style={{ background: `rgba(0, 0, 0, ${overlayOpacity * 0.95})` }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="media-lightbox-close"
        onClick={handleClose}
        aria-label="Close"
      >
        <i className="fas fa-times" />
      </button>

      <div
        ref={containerRef}
        className="media-lightbox-content"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ transform: `translateY(${dragY}px)`, transition: dragY === 0 ? 'transform 0.2s ease-out' : 'none' }}
      >
        <img
          src={src}
          alt={alt}
          className="media-lightbox-image"
          draggable={false}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: dragRef.current.active ? 'none' : 'transform 0.2s ease-out',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      {alt && <div className="media-lightbox-caption">{alt}</div>}

      {scale > 1 && (
        <button
          type="button"
          className="media-lightbox-reset"
          onClick={resetTransform}
          aria-label="Reset zoom"
        >
          <i className="fas fa-compress" />
        </button>
      )}
    </div>
  );
};

export default MediaPreview;
