import React, { useEffect, useState } from 'react';

const UpdateChecker = ({ children }) => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const response = await fetch('/version.json');
        if (!response.ok) throw new Error('Failed to fetch version');
        const data = await response.json();
        const latestVersion = data.latest_version;
        const url = data.download_url;
        const currentVersion = process.env.REACT_APP_VERSION || '1.0.0';

        // Simple string comparison – can use semver for better
        if (latestVersion && latestVersion > currentVersion) {
          setShowUpdate(true);
          setDownloadUrl(url);
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    };

    checkForUpdate();
  }, []);

  if (!showUpdate) return children;

  return (
    <>
      {children}
      {/* Modal overlay – same as before */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        <div
          style={{
            background: '#1A1A2E',
            borderRadius: '24px',
            padding: '32px 24px 24px',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>📱</div>
          <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            Update Available
          </h2>
          <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            A new version of ECHO is ready. Please download and install it to continue using the latest features.
          </p>
          <a
            href={downloadUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '14px 40px',
              borderRadius: '50px',
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '16px',
              marginBottom: '12px',
              boxShadow: '0 4px 20px rgba(108,60,225,0.3)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Download Now
          </a>
          <br />
          <button
            onClick={() => setShowUpdate(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#555',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 16px',
              fontFamily: 'inherit',
            }}
          >
            Remind me later
          </button>
        </div>
      </div>
    </>
  );
};

export default UpdateChecker;