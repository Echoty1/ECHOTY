// src/pages/Spotlight/SpotlightPost.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  listenToSpotlightLike,
  listenToSpotlightReecho,
  listenToEchoAuthor,
  toggleSpotlightLike,
  toggleSpotlightReecho,
  toggleEchoAuthor,
  markSpotlightSeen,
} from '../../services/spotlightService';
import SpotlightActions from './SpotlightActions';
import EchoLoader from '../../common/EchoLoader';

const LONG_PRESS_MS = 500;

const SpotlightPost = ({
  post,
  isActive,
  currentUser,
  onOpenComments,
  onOpenShare,
  onOpenProfile,
  onRegisterVideo,
  onOpenOptions,
  muted,
  onToggleMute,
}) => {
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [reechoed, setReechoed] = useState(false);
  const [echoed, setEchoed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [videoReady, setVideoReady] = useState(post.mediaType !== 'video');
  const lastTapRef = useRef(0);
  const pressTimerRef = useRef(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    if (!post?.id || !currentUser?.
