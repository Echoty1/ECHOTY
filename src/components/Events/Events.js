import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const eventsRef = ref(db, 'events');
    onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        setEvents(list);
      }
    });
  }, []);

  const joinEvent = (eventId) => {
    if (!user) return;
    push(ref(db, `events/${eventId}/attendees`), user.uid);
  };

  return (
    <div>
      <div className="page-header">
        <h2>📅 Events</h2>
        <p>Discover and join upcoming events</p>
      </div>
      <div style={{ padding:'14px 18px' }}>
        {events.length === 0 ? (
          <div style={{ textAlign:'center', color:'#888', padding:'40px 20px' }}>No events yet</div>
        ) : (
          events.map(e => (
            <div key={e.id} style={{
              background:'#12121A',
              border:'1px solid rgba(255,255,255,0.06)',
              borderRadius:'12px',
              padding:'16px',
              marginBottom:'12px',
              transition:'all 0.3s ease'
            }}>
              <div style={{
                width:'100%', height:'120px', borderRadius:'10px',
                background: e.color || 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'36px', marginBottom:'10px'
              }}>{e.icon || '🎉'}</div>
              <div style={{ fontSize:'16px', fontWeight:600 }}>{e.title}</div>
              <div style={{ fontSize:'12px', color:'#888', marginTop:'4px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                <span><i className="fas fa-calendar"></i> {e.date}</span>
                <span><i className="fas fa-clock"></i> {e.time}</span>
                <span><i className="fas fa-map-marker-alt"></i> {e.location}</span>
              </div>
              <div style={{ marginTop:'10px', display:'flex', gap:'8px' }}>
                <button onClick={() => joinEvent(e.id)} className="btn-primary btn-sm">Join Event</button>
              </div>
            </div>
          ))
        )}
        <button onClick={() => {
          if (!user) return;
          const title = prompt('Event title:');
          if (!title) return;
          const date = prompt('Date:');
          const time = prompt('Time:');
          const location = prompt('Location:');
          push(ref(db, 'events'), {
            title, date, time, location,
            icon: '🎉',
            createdBy: user.uid,
            createdAt: Date.now()
          });
        }} className="btn-primary" style={{ width:'100%', marginTop:'12px' }}>Create Event</button>
      </div>
    </div>
  );
};

export default Events;