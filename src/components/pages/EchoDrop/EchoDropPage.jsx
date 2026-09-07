import React from 'react';
import EchoDrop from '../../EchoDrop/EchoDrop';
import SEO from '../../common/SEO';
import { useNavigate } from 'react-router-dom';

const EchoDropPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Echo Drop – Share Photos Instantly"
        description="Share photos with nearby Echo users in real-time."
      />
      <EchoDrop onClose={() => navigate(-1)} />
    </>
  );
};

export default EchoDropPage;
