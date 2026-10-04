// src/components/pages/Chat/LinkPreviewCard.jsx
import React, { useState } from 'react';
import { prettyHost } from '../../../utils/linkPreview';

const LinkPreviewCard = ({ preview }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [favFailed, setFavFailed] = useState(false);

  if (!preview || !preview.url) return null;

  const host = prettyHost(preview.url);

  const handleOpen = (e) => {
    e.stopPropagation();
    window.open(preview.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="link-preview-card"
      onClick={handleOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(e); }}
    >
      {preview.image && !imgFailed && (
        <div className="link-preview-image">
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        </div>
      )}

      <div className="link-preview-body">
        <div className="link-preview-host">
          {preview.favicon && !favFailed ? (
            <img
              src={preview.favicon}
              alt=""
              className="link-preview-favicon"
              onError={() => setFavFailed(true)}
            />
          ) : (
            <span className="link-preview-favicon-fallback">
              <i className="fas fa-link" />
            </span>
          )}
          <span className="link-preview-host-text">{preview.siteName || host}</span>
        </div>

        {preview.title && (
          <div className="link-preview-title">{preview.title}</div>
        )}

        {preview.description && (
          <div className="link-preview-description">{preview.description}</div>
        )}

        <div className="link-preview-url">{host}</div>
      </div>
    </div>
  );
};

export default LinkPreviewCard;
