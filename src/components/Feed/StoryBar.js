import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const StoryBar = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({ ...data[key], id: key }));
        // Filter out test users
        const filtered = userList.filter(u => 
          u.username && 
          !u.username.toLowerCase().includes('test') &&
          u.id !== user?.uid
        );
        setUsers(filtered);
      }
    });
  }, [user]);

  return (
    <div style={{
      display:'flex',
      gap:'12px',
      padding:'12px 16px',
      overflowX:'auto',
      borderBottom:'1px solid rgba(255,255,255,0.06)',
      background:'#12121A',
      scrollbarWidth:'none'
    }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', flexShrink:0 }}>
        <div style={{
          width:'64px', height:'64px', borderRadius:'50%', padding:'3px',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center', position:'relative'
        }}>
          <div style={{
            width:'100%', height:'100%', borderRadius:'50%',
            background:'#12121A', display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:700, fontSize:'18px', color:'white'
          }}>
            {user?.avatar || user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{
            position:'absolute', bottom:'-2px', right:'-2px',
            width:'22px', height:'22px', borderRadius:'50%',
            background:'#6C3CE1', color:'white', fontSize:'12px',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid #12121A', fontWeight:700
          }}>+</div>
        </div>
        <span style={{ fontSize:'10px', color:'#888', maxWidth:'64px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Your Story</span>
      </div>

      {users.slice(0,8).map(u => (
        <div key={u.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', flexShrink:0 }}>
          <div style={{
            width:'64px', height:'64px', borderRadius:'50%', padding:'3px',
            background: u.isFeatured ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <div style={{
              width:'100%', height:'100%', borderRadius:'50%',
              background:'#12121A', display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:700, fontSize:'18px', color:'white'
            }}>
              {u.avatar || u.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
          <span style={{ fontSize:'10px', color:'#888', maxWidth:'64px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {u.username}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StoryBar;