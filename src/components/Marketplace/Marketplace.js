import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const Marketplace = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const itemsRef = ref(db, 'marketplace');
    onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        setItems(list);
      }
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>🛒 Marketplace</h2>
        <p>Buy and sell within the community</p>
      </div>
      <div style={{ padding:'14px 18px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign:'center', color:'#888', padding:'40px 20px' }}>No items yet</div>
        ) : (
          items.map(item => (
            <div key={item.id} style={{
              display:'flex', gap:'14px', alignItems:'center',
              background:'#12121A',
              border:'1px solid rgba(255,255,255,0.06)',
              borderRadius:'12px',
              padding:'16px',
              marginBottom:'12px'
            }}>
              <div style={{
                width:'80px', height:'80px', borderRadius:'10px',
                background: item.color || 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'32px', flexShrink:0
              }}>{item.icon || '📦'}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'15px', fontWeight:600 }}>{item.name}</div>
                <div style={{ fontSize:'16px', fontWeight:700, color:'#10B981' }}>₦{item.price?.toLocaleString()}</div>
                <div style={{ fontSize:'12px', color:'#888' }}>Seller: {item.seller}</div>
              </div>
              <button className="btn-primary btn-sm">Contact</button>
            </div>
          ))
        )}
        <button onClick={() => {
          if (!user) return;
          const name = prompt('Product name:');
          if (!name) return;
          const price = parseInt(prompt('Price (₦):'));
          if (!price) return;
          push(ref(db, 'marketplace'), {
            name, price,
            icon: '📦',
            seller: user.username,
            sellerId: user.uid,
            createdAt: Date.now()
          });
        }} className="btn-primary" style={{ width:'100%', marginTop:'12px' }}>List Your Product</button>
      </div>
    </div>
  );
};

export default Marketplace;