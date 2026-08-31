// src/components/common/SkeletonLoader.jsx
import React from 'react';

export const SkeletonMessage = () => (
  <div style={{ display: 'flex', padding: '12px 16px', gap: '12px', alignItems: 'flex-start' }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-input)', flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ height: '12px', width: '60%', background: 'var(--bg-input)', borderRadius: '4px', marginBottom: '6px' }} />
      <div style={{ height: '10px', width: '80%', background: 'var(--bg-input)', borderRadius: '4px' }} />
    </div>
  </div>
);

export const SkeletonChatItem = () => (
  <div style={{ display: 'flex', padding: '16px', gap: '14px', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-input)', flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ height: '14px', width: '50%', background: 'var(--bg-input)', borderRadius: '4px', marginBottom: '6px' }} />
      <div style={{ height: '10px', width: '70%', background: 'var(--bg-input)', borderRadius: '4px' }} />
    </div>
  </div>
);

export const SkeletonSearchResult = () => (
  <div style={{ display: 'flex', padding: '12px 16px', gap: '12px', alignItems: 'center' }}>
    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-input)', flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ height: '12px', width: '40%', background: 'var(--bg-input)', borderRadius: '4px', marginBottom: '4px' }} />
      <div style={{ height: '10px', width: '60%', background: 'var(--bg-input)', borderRadius: '4px' }} />
    </div>
  </div>
);

export const SkeletonECHOMoji = () => (
  <div style={{ opacity: 0.6, padding: '16px' }}>
    <div style={{ height: '180px', background: 'var(--bg-input)', borderRadius: '20px', marginBottom: '16px' }} />
    <div style={{ height: '80px', background: 'var(--bg-input)', borderRadius: '16px', marginBottom: '16px' }} />
    <div style={{ height: '200px', background: 'var(--bg-input)', borderRadius: '16px' }} />
  </div>
);

const SkeletonLoader = ({ type }) => {
  switch (type) {
    case 'chat':
      return <SkeletonChatItem />;
    case 'message':
      return <SkeletonMessage />;
    case 'search':
      return <SkeletonSearchResult />;
    case 'echomoji':
      return <SkeletonECHOMoji />;
    default:
      return <SkeletonChatItem />;
  }
};

export default SkeletonLoader;