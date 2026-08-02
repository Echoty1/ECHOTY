import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue, remove } from 'firebase/database';

const Notifications = () => {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!user) return;
    const notifRef = ref(db, `notifications/${user.uid}`);
    onValue(notifRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        setNotifs(list.reverse());
      } else {
        setNotifs([]);
      }
    });
  }, [user]);

  const clearAll = () => {
    if (!user) return;
    remove(ref(db, `notifications/${user.uid}`));
  };

  return (
    <div>
      <div className="page-header">
        <h2><i className="fas fa-bell"></i> Notifications</h2>
      </div>
      <div style={{ padding:'14px 18px' }}>
        {notifs.length === 0 ? (
          <div style={{ textAlign:'center', color:'#888', padding:'40px 20px' }}>No notifications yet</div>
        ) : (
          notifs.map(n => (
            <div key={n.id} style={{
              padding:'12px 16px',
              background:'rgba(255,255,255,0.04)',
              borderRadius:'12px',
              marginBottom:'8px',
              border:'1px solid rgba(255,255,255,0.06)'
            }}>
              <p style={{ fontSize:'14px' }}>{n.message}</p>
              <span style={{ fontSize:'12px', color:'#888' }}>{n.time || 'Just now'}</span>
            </div>
          ))
        )}
        {notifs.length > 0 && (
          <button onClick={clearAll} className="btn-outline" style={{ width:'100%', marginTop:'12px' }}>Clear All</button>
        )}
      </div>
    </div>
  );
};

export default Notifications;