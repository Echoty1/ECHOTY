import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        const filtered = list.filter(u =>
          u.username &&
          u.username.toLowerCase().includes(q) &&
          !u.username.toLowerCase().includes('test')
        );
        setResults(filtered);
      }
    }, { onlyOnce: true });
  };

  return (
    <div>
      <div className="page-header">
        <h2><i className="fas fa-search"></i> Search</h2>
      </div>
      <div style={{ padding:'14px 18px' }}>
        <input
          type="text"
          placeholder="Search users..."
          value={query}
          onChange={handleSearch}
          style={{
            width:'100%',
            padding:'12px 18px',
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'14px',
            color:'white',
            outline:'none',
            fontSize:'14px',
            fontFamily:'inherit'
          }}
        />
        <div style={{ marginTop:'12px' }}>
          {results.length === 0 && query.length >= 2 ? (
            <div style={{ textAlign:'center', color:'#888', padding:'20px' }}>No users found</div>
          ) : (
            results.map(u => (
              <div key={u.id} style={{
                display:'flex', alignItems:'center', gap:'12px',
                padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)',
                cursor:'pointer'
              }}>
                <div className="avatar-sm">{u.avatar || u.username[0].toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'14px', fontWeight:600 }}>{u.username}</div>
                  <div style={{ fontSize:'13px', color:'#888' }}>{u.bio || 'ECHO user'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;