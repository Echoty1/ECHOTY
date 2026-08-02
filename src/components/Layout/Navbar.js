import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

const Navbar = () => {
  const { user } = useAuth();

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'rgba(10,10,15,0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 20px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'24px', fontWeight:900 }}>
        <span style={{
          width:'32px', height:'32px', borderRadius:'10px',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'16px', color:'white', boxShadow:'0 4px 15px rgba(108,60,225,0.3)'
        }}>E</span>
        <span>ECHO</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'13px', color:'#888' }}>{user?.username}</span>
        <button
          onClick={() => signOut(auth)}
          style={{
            background:'none', border:'none', color:'#888', fontSize:'18px',
            cursor:'pointer', padding:'4px 8px', borderRadius:'8px',
            transition:'all 0.3s ease'
          }}
          onMouseEnter={(e) => { e.target.style.color = 'white'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.target.style.color = '#888'; e.target.style.background = 'transparent'; }}
        >
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;