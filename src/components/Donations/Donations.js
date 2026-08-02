import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const Donations = () => {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const donationsRef = ref(db, 'donations');
    onValue(donationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data);
        const sum = list.reduce((acc, d) => acc + (d.amount || 0), 0);
        setTotal(sum);
        setCount(list.length);
        setRecent(list.sort((a,b) => b.timestamp - a.timestamp).slice(0,5));
      }
    });
  }, []);

  const donate = (amount) => {
    if (!user) return;
    push(ref(db, 'donations'), {
      userId: user.uid,
      username: user.username,
      amount,
      timestamp: Date.now()
    });
    alert('Thank you for donating ₦' + amount.toLocaleString() + '!');
  };

  return (
    <div style={{ maxWidth:'600px', margin:'0 auto', padding:'16px' }}>
      <div style={{
        background:'linear-gradient(135deg, rgba(108,60,225,0.15), rgba(236,72,153,0.08))',
        border:'1px solid rgba(108,60,225,0.1)',
        borderRadius:'20px',
        padding:'36px 28px',
        textAlign:'center'
      }}>
        <div style={{ fontSize:'52px', marginBottom:'14px' }}>❤️</div>
        <h1 className="gradient-text" style={{ fontSize:'30px', fontWeight:800 }}>Support ECHO</h1>
        <p style={{ color:'#888', fontSize:'15px' }}>Keep the community thriving, ad‑free, and growing</p>
      </div>

      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)',
        gap:'10px', marginTop:'18px'
      }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'14px 10px', textAlign:'center' }}>
          <div style={{ fontSize:'22px', fontWeight:700, background:'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>₦{total.toLocaleString()}</div>
          <div style={{ fontSize:'11px', color:'#888' }}>Raised</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'14px 10px', textAlign:'center' }}>
          <div style={{ fontSize:'22px', fontWeight:700, background:'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{count}</div>
          <div style={{ fontSize:'11px', color:'#888' }}>Donations</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'14px 10px', textAlign:'center' }}>
          <div style={{ fontSize:'22px', fontWeight:700 }}>--</div>
          <div style={{ fontSize:'11px', color:'#888' }}>Supporters</div>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'14px 10px', textAlign:'center' }}>
          <div style={{ fontSize:'22px', fontWeight:700 }}>{Math.min(Math.round((total/1000000)*100), 100)}%</div>
          <div style={{ fontSize:'11px', color:'#888' }}>Goal</div>
        </div>
      </div>

      <div style={{ marginTop:'18px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
        {[500, 2500, 10000].map(amount => (
          <button key={amount} onClick={() => donate(amount)} style={{
            background:'#12121A',
            border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'12px',
            padding:'20px 14px',
            textAlign:'center',
            cursor:'pointer',
            transition:'all 0.3s ease',
            color:'white'
          }}>
            <div style={{ fontSize:'22px', fontWeight:800 }}>₦{amount.toLocaleString()}</div>
            <div style={{ fontSize:'12px', color:'#888' }}>Donate</div>
          </button>
        ))}
      </div>

      <button onClick={() => {
        const amt = parseInt(prompt('Enter amount (₦):'));
        if (amt && amt >= 100) donate(amt);
      }} className="donate-btn-main" style={{ width:'100%', marginTop:'18px' }}>
        <i className="fas fa-heart"></i> Donate Now
      </button>

      {recent.length > 0 && (
        <div style={{ marginTop:'18px', background:'#12121A', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', padding:'20px' }}>
          <h3 style={{ fontSize:'15px', fontWeight:700, marginBottom:'12px' }}>🔄 Recent Donations</h3>
          {recent.map((d, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{
                width:'36px', height:'36px', borderRadius:'50%',
                background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight:700, fontSize:'14px', color:'white'
              }}>{d.username?.[0]?.toUpperCase() || 'A'}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'14px', fontWeight:600 }}>{d.username || 'Anonymous'}</div>
                <div style={{ fontSize:'12px', color:'#888' }}>{new Date(d.timestamp).toLocaleDateString()}</div>
              </div>
              <div style={{ fontSize:'15px', fontWeight:700, color:'#10B981' }}>₦{d.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Donations;