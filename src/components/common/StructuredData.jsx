// src/components/common/StructuredData.jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

const StructuredData = () => {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'ECHO',
    description:
      'ECHO is a modern chat platform with animated avatars (ECHOMOJI), real-time messaging, and expressive features.',
    applicationCategory: 'Communication',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '124',
    },
    author: {
      '@type': 'Organization',
      name: 'ECHO Team',
      url: 'https://echoty.xyz',
    },
    screenshot: 'https://echoty.xyz/featured-graphic.png',
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
};

export default StructuredData;