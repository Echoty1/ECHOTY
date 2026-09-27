// src/hooks/useSongPreview.js
import { useEffect, useRef, useState } from 'react';

// Module-level singletons so only one preview plays at a time across the whole app
let globalAudio = null;
let globalStop = null;

/**
 * Plays a 30-second preview URL. Only one preview plays at a time.
 *   const { play, stop, playingId } = useSongPreview();
 *   play({ trackId, previewUrl });
 */
export const useSongPreview = () => {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (_) {}
        audioRef.current = null;
      }
      if (globalAudio === audioRef.current) {
        globalAudio = null;
        globalStop = null;
      }
    };
  }, []);

  const stop = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) {}
      try { audioRef.current.currentTime = 0; } catch (_) {}
      audioRef.current = null;
    }
    if (globalAudio === audioRef.current) {
      globalAudio = null;
      globalStop = null;
    }
    setPlayingId(null);
  };

  const play = async (song) => {
    if (!song) return;

    // Support both { trackId, previewUrl } and full catalog objects
    const id = song.trackId || song.id || song.sourceUrl;
    const url = song.previewUrl || song.preview_url;

    if (!url) return;

    // Same song → toggle off
    if (playingId === id) {
      stop();
      return;
    }

    // Stop whatever's currently playing globally
    if (globalStop) {
      try { globalStop(); } catch (_) {}
    }

    const audio = new Audio(url);
    audio.volume = 0.8;
    audioRef.current = audio;
    globalAudio = audio;
    globalStop = stop;

    audio.addEventListener('ended', () => {
      setPlayingId(null);
      if (globalAudio === audio) {
        globalAudio = null;
        globalStop = null;
      }
    });
    audio.addEventListener('error', () => {
      setPlayingId(null);
    });

    try {
      await audio.play();
      setPlayingId(id);
    } catch (err) {
      console.warn('Audio play failed', err);
      setPlayingId(null);
    }
  };

  return { play, stop, playingId };
};
