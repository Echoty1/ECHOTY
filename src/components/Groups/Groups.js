import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const Groups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const groupsRef = ref(db, 'groups');
    onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        setGroups(list);
      }
    });
  }, []);

  const joinGroup = (groupId) => {
    if (!user) return;
    update(ref(db, `groups/${groupId}/members`), { [user.uid]: user.username });
  };

  return (
    <div>
      <div className="page-header">
        <h2>👥 Groups</h2>
        <p>Find communities that share your interests</p>
      </div>
      <div style={{ padding:'14px 18px' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign:'center', color:'#888', padding:'40px 20px' }}>No groups yet</div>
        ) : (
          groups.map(g => {
            const isMember = g.members && g.members[user?.uid];
            return (
              <div key={g.id} style={{
                display:'flex', alignItems:'center', gap:'14px',
                background:'#12121A',
                border:'1px solid rgba(255,255,255,0.06)',
                borderRadius:'12px',
                padding:'16px',
                marginBottom:'12px'
              }}>
                <div style={{
                  width:'48px', height:'48px', borderRadius:'50%',
                  background: g.color || 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'20px', fontWeight:700, color:'white'
                }}>{g.icon || '👥'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'15px', fontWeight:600 }}>{g.name}</div>
                  <div style={{ fontSize:'12px', color:'#888' }}>
                    <i className="fas fa-users"></i> {g.members ? Object.keys(g.members).length : 0} members
                  </div>
                </div>
                {isMember ? (
                  <span style={{ color:'#10B981', fontSize:'11px' }}>Joined</span>
                ) : (
                  <button onClick={() => joinGroup(g.id)} className="btn-primary btn-sm">Join</button>
                )}
              </div>
            );
          })
        )}
        <button onClick={() => {
          if (!user) return;
          const name = prompt('Group name:');
          if (!name) return;
          push(ref(db, 'groups'), {
            name,
            icon: '👥',
            createdBy: user.uid,
            createdAt: Date.now(),
            members: { [user.uid]: user.username }
          });
        }} className="btn-primary" style={{ width:'100%', marginTop:'12px' }}>Create New Group</button>
      </div>
    </div>
  );
};

export default Groups;