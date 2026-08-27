// src/components/pages/CommunityChat/CommunityWall.jsx
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ref, onValue, push, remove, set, get, update } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import Avatar from '../../common/Avatar';
import MediaPreview from '../../common/MediaPreview';
import ConfirmModal from '../../common/ConfirmModal';
import Modal from '../../common/Modal';
import ReactDOM from 'react-dom';
import CustomVideoPlayer from '../../common/CustomVideoPlayer';
import { useCachedBlobUrl } from '../../../hooks/useCachedBlobUrl';
import { getCache, setCache, clearCacheEntry } from '../../../services/cacheService';
import './CommunityWall.css';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const POST_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// ─── Memoized Media Item ──────────────────────────────────────
const MediaItem = memo(({ mediaUrl, mediaType, caption, onClick }) => {
  const { blobUrl, isLoading, error } = useCachedBlobUrl(mediaUrl);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (blobUrl && !isLoading) {
      setIsLoaded(true);
    }
  }, [blobUrl, isLoading]);

  const handleLoad = () => setIsLoaded(true);

  const src = blobUrl || mediaUrl;

  if (mediaType === 'video') {
    return (
      <div className="wall-post-media" onClick={onClick}>
        <video
          src={src}
          playsInline
          className="wall-post-video"
          style={{ 
            opacity: isLoaded ? 1 : 0,
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: '500px',
            objectFit: 'contain',
          }}
          onLoadedData={handleLoad}
          preload="metadata"
        />
        {(!isLoaded || isLoading) && (
          <div className="wall-post-media-loader">
            <div className="loader-spinner" />
          </div>
        )}
        <div className="wall-post-media-overlay">
          <i className="fas fa-expand" />
        </div>
      </div>
    );
  }

  return (
    <div className="wall-post-media" onClick={onClick}>
      <img
        src={src}
        alt={caption || 'Post media'}
        className="wall-post-image"
        style={{ 
          opacity: isLoaded ? 1 : 0,
          display: 'block',
          width: '100%',
          height: 'auto',
          maxHeight: '500px',
          objectFit: 'contain',
        }}
        onLoad={handleLoad}
        loading="lazy"
      />
      {(!isLoaded || isLoading) && (
        <div className="wall-post-media-loader">
          <div className="loader-spinner" />
        </div>
      )}
      <div className="wall-post-media-overlay">
        <i className="fas fa-expand" />
      </div>
    </div>
  );
});

// ─── Memoized Post ─────────────────────────────────────────────
const Post = memo(({ post, authorProfile, isOwn, onDelete, onMediaClick, onPostClick, isRead }) => {
  const authorName = authorProfile?.name || 'User';
  const authorAvatar = authorProfile?.avatar || '';

  const handleClick = (e) => {
    if (e.target.closest('.wall-post-delete')) return;
    onPostClick(post.id);
  };

  return (
    <div 
      className={`wall-post ${isRead ? 'read' : 'unread'}`} 
      onClick={handleClick}
    >
      <div className="wall-post-header">
        <Avatar src={authorAvatar} name={authorName} size={40} />
        <div className="wall-post-author">
          <span className="wall-post-name">{authorName}</span>
          <span className="wall-post-time">
            {new Date(post.timestamp).toLocaleString()}
          </span>
        </div>
        {isOwn && (
          <button
            className="wall-post-delete"
            onClick={() => onDelete(post.id)}
            title="Delete post"
          >
            <i className="fas fa-trash-alt" />
          </button>
        )}
        {!isRead && <span className="wall-post-unread-badge">New</span>}
      </div>
      {post.text && <div className="wall-post-text">{post.text}</div>}
      {post.mediaUrl && (
        <MediaItem
          mediaUrl={post.mediaUrl}
          mediaType={post.mediaType}
          caption={post.text}
          onClick={() => onMediaClick(post)}
        />
      )}
    </div>
  );
});

// ─── Main CommunityWall Component ──────────────────────────────
const CommunityWall = ({ communityId, isMember }) => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPost, setShowAddPost] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, postId: null });
  const [filterUid, setFilterUid] = useState(null);
  const [filterName, setFilterName] = useState('');
  const [uploadError, setUploadError] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  const [showReadPosts, setShowReadPosts] = useState(false);
  const [readPosts, setReadPosts] = useState({});

  // ─── Load read status from Firebase + localStorage fallback ──
  useEffect(() => {
    if (!user?.uid || !communityId) return;

    // Load from localStorage first (fast)
    const localKey = `echo_read_posts_${user.uid}_${communityId}`;
    try {
      const localData = localStorage.getItem(localKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        setReadPosts(parsed);
      }
    } catch (_) {}

    // Then listen to Firebase
    const readRef = ref(db, `communityPostReads/${user.uid}/${communityId}`);
    const unsub = onValue(readRef, (snap) => {
      const data = snap.val() || {};
      setReadPosts(data);
      // Update localStorage with Firebase data
      try {
        localStorage.setItem(localKey, JSON.stringify(data));
      } catch (_) {}
    }, (error) => {
      console.warn('Read status listener error:', error);
    });

    return () => unsub();
  }, [user?.uid, communityId]);

  // ─── Load posts with expiry check ─────────────────────────────
  useEffect(() => {
    if (!communityId) {
      setPosts([]);
      setFilteredPosts([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        console.warn('Wall loading timeout - forcing loaded state');
      }
    }, 5000);

    const postsRef = ref(db, `communityPosts/${communityId}`);
    const unsub = onValue(
      postsRef,
      async (snapshot) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        const data = snapshot.val() || {};
        const now = Date.now();
        const postList = [];
        const toDelete = [];

        for (const [id, post] of Object.entries(data)) {
          if (post.expiresAt && post.expiresAt < now) {
            toDelete.push(id);
            continue;
          }
          postList.push({ id, ...post });
        }

        if (toDelete.length > 0) {
          for (const id of toDelete) {
            try {
              await remove(ref(db, `communityPosts/${communityId}/${id}`));
              await clearCacheEntry(`community_post_${id}`);
              console.log(`🗑️ Deleted expired post: ${id}`);
            } catch (err) {
              console.warn('Failed to delete expired post:', err);
            }
          }
        }

        postList.sort((a, b) => b.timestamp - a.timestamp);
        setPosts(postList);

        // Apply filters
        let filtered = postList;
        if (filterUid) {
          filtered = filtered.filter(p => p.uid === filterUid);
        }
        if (!showReadPosts) {
          filtered = filtered.filter(p => !readPosts[p.id]);
        }
        setFilteredPosts(filtered);
        setLoading(false);

        try {
          await setCache(`community_posts_${communityId}`, postList, 60);
        } catch (_) {}
      },
      (error) => {
        console.warn('Wall posts error:', error);
        if (isMounted) {
          setPosts([]);
          setFilteredPosts([]);
          setLoading(false);
        }
      }
    );

    const loadCached = async () => {
      try {
        const cached = await getCache(`community_posts_${communityId}`);
        if (cached && cached.length > 0 && isMounted) {
          setPosts(cached);
          let filtered = cached;
          if (filterUid) {
            filtered = filtered.filter(p => p.uid === filterUid);
          }
          if (!showReadPosts) {
            filtered = filtered.filter(p => !readPosts[p.id]);
          }
          setFilteredPosts(filtered);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (_) {}
    };
    loadCached();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [communityId, filterUid, showReadPosts, readPosts, loading]);

  // ─── Mark post as read (Firebase + localStorage fallback) ────
  const markPostAsRead = async (postId) => {
    if (!user?.uid || !communityId) return;
    if (readPosts[postId]) return;

    // Optimistically update UI immediately
    const updatedReadPosts = { ...readPosts, [postId]: true };
    setReadPosts(updatedReadPosts);

    // Store in localStorage as fallback
    const localKey = `echo_read_posts_${user.uid}_${communityId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify(updatedReadPosts));
    } catch (_) {}

    // Try to write to Firebase
    try {
      const readRef = ref(db, `communityPostReads/${user.uid}/${communityId}/${postId}`);
      await set(readRef, true);
    } catch (err) {
      console.warn('Failed to mark post as read in Firebase (using localStorage fallback):', err.message);
      // Already stored in localStorage, so the UI will still hide the post.
    }
  };

  // ─── Upload to Cloudinary ─────────────────────────────────────
  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } catch (err) {
            reject(new Error('Invalid response from Cloudinary'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  // ─── Handle post submission ──────────────────────────────────
  const handleAddPost = async (e) => {
    e.preventDefault();
    if (!selectedFile || !user?.uid || !communityId || !isMember) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(true);
      setUploadErrorMessage('File size exceeds 20 MB. Please choose a smaller file.');
      return;
    }

    setUploading(true);
    setUploadError(false);
    setUploadErrorMessage('');

    try {
      const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      const downloadURL = await uploadToCloudinary(selectedFile, (progress) => {});
      
      const postRef = push(ref(db, `communityPosts/${communityId}`));
      const now = Date.now();
      await set(postRef, {
        uid: user.uid,
        text: caption.trim() || '',
        mediaUrl: downloadURL,
        mediaType,
        timestamp: now,
        expiresAt: now + POST_EXPIRY_MS,
      });

      setShowAddPost(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
    } catch (err) {
      console.error('Post error:', err);
      setUploadError(true);
      setUploadErrorMessage(err.message || 'Failed to post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Delete post with confirmation ────────────────────────────
  const confirmDeletePost = (postId) => {
    setDeleteConfirm({ isOpen: true, postId });
  };

  const handleDeletePost = async () => {
    const { postId } = deleteConfirm;
    if (!postId) return;
    try {
      await remove(ref(db, `communityPosts/${communityId}/${postId}`));
      await clearCacheEntry(`community_post_${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (filterUid) {
        setFilteredPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (err) {
      alert('Could not delete post.');
    } finally {
      setDeleteConfirm({ isOpen: false, postId: null });
    }
  };

  // ─── Click handler for user avatar - FILTER the feed ──────────
  const handleUserClick = (uid, name) => {
    if (filterUid === uid) {
      setFilterUid(null);
      setFilterName('');
    } else {
      setFilterUid(uid);
      setFilterName(name);
    }
  };

  // ─── Clear filter ──────────────────────────────────────────────
  const clearFilter = () => {
    setFilterUid(null);
    setFilterName('');
  };

  // ─── Toggle read posts visibility ──────────────────────────────
  const toggleReadPosts = () => {
    setShowReadPosts(prev => !prev);
  };

  // ─── Add Post Modal ────────────────────────────────────────────
  const renderAddPostModal = () => {
    if (!showAddPost) return null;
    return ReactDOM.createPortal(
      <div className="wall-add-post-overlay" onClick={() => setShowAddPost(false)}>
        <div className="wall-add-post-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Create a Post</h3>
          <div className="wall-add-post-preview">
            {previewUrl ? (
              selectedFile?.type.startsWith('video/') ? (
                <video src={previewUrl} controls playsInline className="wall-preview-video" />
              ) : (
                <img src={previewUrl} alt="Preview" className="wall-preview-image" />
              )
            ) : (
              <div
                className="wall-add-post-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-cloud-upload-alt" />
                <span>Tap to choose image or video (max 20 MB)</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > MAX_FILE_SIZE) {
                    setUploadError(true);
                    setUploadErrorMessage('File size exceeds 20 MB. Please choose a smaller file.');
                    e.target.value = '';
                    return;
                  }
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                  setUploadError(false);
                  setUploadErrorMessage('');
                }
                e.target.value = '';
              }}
            />
          </div>
          {uploadError && (
            <div className="wall-upload-error">
              <i className="fas fa-exclamation-circle" />
              <span>{uploadErrorMessage}</span>
            </div>
          )}
          <textarea
            placeholder="Write a caption… (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <div className="wall-add-post-actions">
            <button onClick={() => setShowAddPost(false)} disabled={uploading}>
              Cancel
            </button>
            <button
              onClick={handleAddPost}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (loading) {
    return <div className="wall-loading">Loading wall…</div>;
  }

  const displayPosts = filteredPosts;

  return (
    <div className="community-wall-container">
      {/* ─── Posts Feed ──────────────────────────────────────────── */}
      <div className="wall-feed">
        <div className="wall-feed-header">
          <div className="wall-feed-header-left">
            <span className="wall-feed-title">📰 Posts</span>
            {filterUid && (
              <button className="wall-filter-clear" onClick={clearFilter}>
                <i className="fas fa-arrow-left" /> All Posts
              </button>
            )}
          </div>
          <div className="wall-feed-header-right">
            <button 
              className={`wall-toggle-read ${showReadPosts ? 'active' : ''}`}
              onClick={toggleReadPosts}
            >
              {showReadPosts ? 'Hide Read' : 'Show Read'}
            </button>
            {isMember && (
              <button
                className="wall-add-post-btn"
                onClick={() => setShowAddPost(true)}
              >
                <i className="fas fa-plus" /> Add Post
              </button>
            )}
          </div>
        </div>

        {filterUid && (
          <div className="wall-filter-badge">
            <i className="fas fa-user-circle" /> Showing posts by <strong>{filterName}</strong>
          </div>
        )}

        {displayPosts.length === 0 ? (
          <div className="wall-feed-empty">
            <i className="fas fa-image" />
            <p>
              {filterUid 
                ? `${filterName} hasn't posted in the last 24 hours.` 
                : showReadPosts 
                  ? 'No posts to show.' 
                  : 'No unread posts. Check "Show Read" to see all.'}
            </p>
          </div>
        ) : (
          displayPosts.map((post) => {
            const authorProfile = getProfile(post.uid) || {};
            const isOwn = post.uid === user?.uid;
            const isRead = !!readPosts[post.id];

            return (
              <Post
                key={post.id}
                post={post}
                authorProfile={authorProfile}
                isOwn={isOwn}
                isRead={isRead}
                onDelete={confirmDeletePost}
                onPostClick={markPostAsRead}
                onMediaClick={(p) => {
                  markPostAsRead(p.id);
                  if (p.mediaType === 'video') {
                    setVideoPreview({ src: p.mediaUrl });
                  } else {
                    setMediaPreview({
                      src: p.mediaUrl,
                      type: 'image',
                      alt: p.text || 'Post media',
                    });
                  }
                }}
              />
            );
          })
        )}
      </div>

      {renderAddPostModal()}

      {/* Media Preview */}
      {mediaPreview && (
        <MediaPreview
          src={mediaPreview.src}
          type={mediaPreview.type}
          alt={mediaPreview.alt}
          onClose={() => setMediaPreview(null)}
        />
      )}

      {videoPreview && (
        <CustomVideoPlayer
          src={videoPreview.src}
          onClose={() => setVideoPreview(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, postId: null })}
        onConfirm={handleDeletePost}
        title="Delete Post"
        message="Are you sure you want to delete this post? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Upload Error Modal */}
      <Modal
        isOpen={uploadError}
        onClose={() => setUploadError(false)}
        title="Upload Failed"
        message={uploadErrorMessage || 'Failed to upload. Please try again.'}
        type="error"
      />
    </div>
  );
};

export default CommunityWall;