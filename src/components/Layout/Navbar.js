import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { ref, update } from 'firebase/database';

const Navbar = () => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    if (user) {
      // Set offline before signing out
      await update(ref(db, `users/${user.uid}`), { online: false, status: 'offline' });
    }
    signOut(auth);
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 20px', height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'24px', fontWeight:900 }}>
        <span style={{
          width:'32px', height:'32px', borderRadius:'10px',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'16px', color:'white'
        }}>E</span>
        <span>ECHO</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'13px', color:'#888' }}>{user?.username}</span>
        <button
          onClick={handleSignOut}
          style={{ background:'none', border:'none', color:'#888', fontSize:'18px', cursor:'pointer' }}
        >
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;