import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import SEO from '../../common/SEO';
import Avatar from '../../common/Avatar';
import { listEchoArchive, removeEchoArchive, unpinBookmarkedMessage } from '../../../services/echoArchive';
import './Bookmarks.css';

const Bookmarks = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    listEchoArchive(user.uid).then((rows) => {
      setBookmarks(rows);
      rows.forEach((row) => {
        const sid = row.message?.senderId;
        if (sid && sid !== user.uid) fetchProfile?.(sid);
      });
    }).catch(() => {});
  }, [user?.uid, fetchProfile]);

  const openBookmark = (row) => {
    const msgId = row.message?.id;
    if (row.source === 'community' && (row.communityId || row.chatId)) {
      navigate(`/community/${row.communityId || row.chatId}/chat?focus=${msgId || ''}`);
      return;
    }
    const partnerId = row.partnerId || (row.chatId || '').split('_').find((id) => id && id !== user.uid);
    if (partnerId) navigate(`/chat/${partnerId}?focus=${msgId || ''}`);
  };

  const removeBookmark = async (row) => {
    await unpinBookmarkedMessage(row);
    await removeEchoArchive(row.archiveId);
    setBookmarks(await listEchoArchive(user.uid));
  };

  return (
    <>
      <SEO title="Bookmarks" description="Messages you saved on this device." />
      <div className="bookmarks-page">
        {bookmarks.length === 0 ? (
          <div className="bookmarks-empty">
            <i className="fas fa-bookmark" aria-hidden="true" />
            <p>No bookmarks yet</p>
            <span>Hover a message and tap the bookmark to save it here.</span>
          </div>
        ) : (
          <ul className="echo-bookmark-list">
            {bookmarks.map((row) => {
              const sid = row.message?.senderId;
              const mine = sid === user.uid;
              const profile = sid ? getProfile?.(sid) : null;
              const name = mine ? 'You' : (row.message?.senderName || profile?.name || 'User');
              const avatar = row.message?.senderAvatar || profile?.avatar || '';
              return (
                <li key={row.archiveId} className="echo-bookmark-item">
                  <button type="button" className="echo-bookmark-main" onClick={() => openBookmark(row)}>
                    <Avatar src={avatar} name={name} size={36} />
                    <div>
                      <strong>{name}</strong>
                      <span className="echo-bookmark-source"> · {row.source === 'community' ? 'Community' : 'Chat'}</span>
                      <p>{row.message?.text || (row.message?.mediaType ? 'Media' : 'Saved message')}</p>
                    </div>
                  </button>
                  <button type="button" className="echo-bookmark-remove" onClick={() => removeBookmark(row)}>
                    <i className="fas fa-bookmark" />
                    <span>Remove</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};

export default Bookmarks;
