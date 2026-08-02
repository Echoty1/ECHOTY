import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ref, push, update, remove } from 'firebase/database';
import { db } from '../../services/firebase';

const PostCard = ({ post, onEcho }) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');

  const addComment = () => {
    if (!comment.trim()) return;
    const commentRef = ref(db, `posts/${post.id}/commentList`);
    push(commentRef, {
      author: user.username,
      content: comment,
      timestamp: Date.now()
    });
    update(ref(db, `posts/${post.id}`), {
      comments: (post.comments || 0) + 1
    });
    setComment('');
  };

  const deletePost = () => {
    if (window.confirm('Delete this post?')) {
      remove(ref(db, `posts/${post.id}`));
    }
  };

  return (
    <div style={{
      background: '#12121A',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 20px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
        <div style={{
          width:'40px', height:'40px', borderRadius:'50%',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:700, fontSize:'16px', color:'white', flexShrink:0
        }}>
          {post.avatar || post.author?.[0]?.toUpperCase() || 'U'}
        </div>
        <span style={{ fontWeight:600, fontSize:'15px' }}>{post.author || 'Anonymous'}</span>
        <span style={{ fontSize:'12px', color:'#888', marginLeft:'auto' }}>
          {post.time || new Date(post.timestamp).toLocaleDateString()}
        </span>
      </div>
      <div style={{ fontSize:'15px', lineHeight:1.7, color:'rgba(255,255,255,0.9)', marginBottom:'10px' }}>
        {post.content}
      </div>
      {post.image && <img src={post.image} alt="post" style={{ width:'100%', borderRadius:'14px', margin:'8px 0', maxHeight:'420px', objectFit:'cover' }} />}
      {post.video && <video src={post.video} controls style={{ width:'100%', borderRadius:'14px', margin:'8px 0', maxHeight:'420px', background:'#000' }} />}
      <div style={{ display:'flex', gap:'20px', padding:'8px 0 4px', borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:'10px', flexWrap:'wrap' }}>
        <button onClick={() => onEcho(post.id)} style={{ background:'none', border:'none', color:'#888', fontSize:'15px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'8px', transition:'all 0.3s ease' }}>
          <i className="fas fa-heart"></i> <span>{post.echoes || 0}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} style={{ background:'none', border:'none', color:'#888', fontSize:'15px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'8px', transition:'all 0.3s ease' }}>
          <i className="fas fa-comment"></i> {post.comments || 0}
        </button>
        <button style={{ background:'none', border:'none', color:'#888', fontSize:'15px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'8px', transition:'all 0.3s ease' }}>
          <i className="fas fa-retweet"></i> {post.reposts || 0}
        </button>
        {user && (post.author === user.username || post.userId === user.uid) && (
          <button onClick={deletePost} style={{ color:'#EF4444', background:'none', border:'none', fontSize:'15px', cursor:'pointer', padding:'6px 12px', borderRadius:'8px' }}>
            <i className="fas fa-trash"></i>
          </button>
        )}
      </div>
      {showComments && (
        <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <input
              type="text"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                flex:1,
                background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.06)',
                borderRadius:'50px',
                padding:'10px 16px',
                color:'white',
                outline:'none',
                fontSize:'14px',
                fontFamily:'inherit'
              }}
            />
            <button onClick={addComment} className="btn-primary" style={{ padding:'8px 16px', borderRadius:'50px', fontSize:'13px' }}>Post</button>
          </div>
          <div style={{ marginTop:'8px' }}>
            {(post.commentList || []).slice(0,3).map((c, i) => (
              <div key={i} style={{ fontSize:'14px', marginTop:'4px' }}>
                <span style={{ color:'#8B5CF6', fontWeight:600 }}>{c.author}:</span> {c.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;