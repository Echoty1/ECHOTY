import React from 'react';
import EchoDrop from '../../EchoDrop/EchoDrop';
import SEO from '../../common/SEO';

const EchoDropPage = () => {
  return (
    <>
      <SEO 
        title="Echo Drop – Share Photos Instantly" 
        description="Share photos with nearby Echo users instantly." 
      />
      <EchoDrop onClose={() => window.history.back()} />
    </>
  );
};

export default EchoDropPage;
