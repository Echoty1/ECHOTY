// src/components/common/SEO.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({
  title = 'ECHO – The Future of Conversations',
  description = 'Discover, connect, and echo with real-time chat, animated avatars, and expressive features. Join ECHO today.',
  image = '/featured-graphic.png',
  url = 'https://echoty.xyz',
  type = 'website',
  keywords = 'chat, messaging, animated avatars, ECHOMOJI, real-time, social, communities',
  noindex = false,
}) => {
  const siteTitle = 'ECHO';
  const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteTitle} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      <meta name="theme-color" content="#6C3CE1" />
    </Helmet>
  );
};

export default SEO;