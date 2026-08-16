// src/components/pages/Chat/EchoInput.jsx
import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';

// ─── Store roots for cleanup ────────────────────────────────────
const rootMap = new WeakMap();

const EchoInput = forwardRef(({ placeholder, onSend, activeSkinId, onChange }, ref) => {
  const editableRef = useRef(null);
  const placeholderRef = useRef(null);
  const observerRef = useRef(null);
  const rootsRef = useRef(new Set()); // store container elements that have roots

  // ─── Check if content is empty ──────────────────────────────
  const isEmpty = () => {
    const el = editableRef.current;
    if (!el) return true;
    const nodes = el.childNodes;
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        return false;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('echomoji-inline')) {
        return false;
      }
    }
    return true;
  };

  // ─── Notify parent of content change ────────────────────────
  const notifyChange = () => {
    const hasContent = !isEmpty();
    onChange?.(hasContent);
    updatePlaceholderVisibility();
  };

  // ─── Update placeholder visibility ──────────────────────────
  const updatePlaceholderVisibility = () => {
    const el = editableRef.current;
    const ph = placeholderRef.current;
    if (!el || !ph) return;
    ph.style.opacity = isEmpty() ? '1' : '0';
  };

  // ─── Render ECHOMOJI into container using createRoot ──────
  const renderEchomojiInContainer = (container, mood) => {
    const skin = activeSkinId ? getSkinById(activeSkinId) : null;
    let root = rootMap.get(container);
    if (!root) {
      root = createRoot(container);
      rootMap.set(container, root);
      rootsRef.current.add(container);
    }
    root.render(
      <ECHOMOJI
        mood={mood}
        skin={skin}
        size={28}
        interactive={false}
        animated={true}
      />
    );
    return root;
  };

  // ─── Unmount all roots (for cleanup) ────────────────────────
  const unmountAllRoots = () => {
    for (const container of rootsRef.current) {
      const root = rootMap.get(container);
      if (root) {
        root.unmount();
        rootMap.delete(container);
      }
    }
    rootsRef.current.clear();
  };

  // ─── Insert ECHOMOJI at cursor ─────────────────────────────
  const insertEchomoji = (mood) => {
    const el = editableRef.current;
    if (!el) return;

    // Create container
    const container = document.createElement('span');
    container.className = 'echomoji-inline';
    container.dataset.mood = mood;
    container.contentEditable = false;
    container.style.display = 'inline-block';
    container.style.verticalAlign = 'middle';
    container.style.margin = '0 2px';
    container.style.lineHeight = '0';

    // Render ECHOMOJI into container
    renderEchomojiInContainer(container, mood);

    // Insert at cursor or end
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        range.insertNode(container);
        range.setStartAfter(container);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        range.deleteContents();
        range.insertNode(container);
        range.setStartAfter(container);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      el.appendChild(container);
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    el.focus();
    notifyChange();
  };

  // ─── Insert text at cursor ──────────────────────────────────
  const insertText = (text) => {
    const el = editableRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      el.appendChild(document.createTextNode(text));
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.focus();
    notifyChange();
  };

  // ─── Get compiled text ──────────────────────────────────────
  const getCompiledText = () => {
    const el = editableRef.current;
    if (!el) return '';
    let result = '';
    const nodes = el.childNodes;
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('echomoji-inline')) {
        const mood = node.dataset.mood || 'neutral';
        result += `{echo:${mood}}`;
      }
    }
    return result;
  };

  // ─── Clear all content ──────────────────────────────────────
  const clear = () => {
    const el = editableRef.current;
    if (el) {
      // Unmount all roots before clearing
      unmountAllRoots();
      el.innerHTML = '';
      notifyChange();
    }
  };

  // ─── Focus ──────────────────────────────────────────────────
  const focus = () => {
    if (editableRef.current) {
      editableRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // ─── Expose methods ─────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    insertEchomoji,
    insertText,
    getCompiledText,
    clear,
    focus,
  }));

  // ─── MutationObserver to detect DOM changes ────────────────
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;

    const observer = new MutationObserver((mutations) => {
      // Check if any echomoji-inline nodes were removed
      for (const mutation of mutations) {
        for (const removedNode of mutation.removedNodes) {
          if (removedNode.nodeType === Node.ELEMENT_NODE && removedNode.classList.contains('echomoji-inline')) {
            // Unmount root if exists
            const root = rootMap.get(removedNode);
            if (root) {
              root.unmount();
              rootMap.delete(removedNode);
              rootsRef.current.delete(removedNode);
            }
          }
        }
      }
      notifyChange();
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observerRef.current = observer;

    notifyChange();
    return () => {
      observer.disconnect();
      // Clean up roots when component unmounts
      unmountAllRoots();
    };
  }, []);

  // ─── Handle keydown ─────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const compiled = getCompiledText();
      if (compiled.trim()) {
        onSend(compiled);
        clear();
      }
    }
  };

  // ─── Handle paste ───────────────────────────────────────────
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="echo-input-wrapper">
      <div
        ref={editableRef}
        className="echo-input"
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={updatePlaceholderVisibility}
        onBlur={updatePlaceholderVisibility}
        style={{
          flex: 1,
          padding: '10px 16px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          color: '#fff',
          fontSize: '14px',
          outline: 'none',
          minHeight: '44px',
          maxHeight: '120px',
          overflowY: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2px',
          cursor: 'text',
          lineHeight: '1.4',
          transition: 'border-color 0.2s',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      />
      <span
        ref={placeholderRef}
        className="echo-input-placeholder"
        style={{
          position: 'absolute',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#666',
          pointerEvents: 'none',
          fontSize: '14px',
          transition: 'opacity 0.2s',
        }}
      >
        {placeholder}
      </span>
    </div>
  );
});

EchoInput.displayName = 'EchoInput';

export default EchoInput;