// src/components/pages/Other/About.js
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './About.css';

const About = () => {
  const sections = [
    {
      icon: 'fa-pen-fancy',
      title: 'The Beginning',
      text: (
        <>
          <Link to="/lawal-abdulmalik" className="about-founder-link">
            Lawal Abdul Malik
          </Link>{' '}
          wrote the first ECHO by hand in HTML, CSS, and JavaScript. It was a raw
          idea: a chat that felt like you.
        </>
      ),
    },
    {
      icon: 'fa-code-branch',
      title: 'The Rebuild',
      text: 'Abdullah Bashir rebuilt it in React so the app could grow without losing that original spark – a visual identity that moves with you.'
    },
    {
      icon: 'fa-face-smile',
      title: 'ECHOMOJI & Skins',
      text: 'Your avatar isn\'t static. It changes with your mood, and you can style it with skins that make it truly yours.'
    },
    {
      icon: 'fa-message',
      title: 'Chats that Echo',
      text: 'Private conversations flow like tides – unless you bookmark them. They stay until you let them go.'
    },
    {
      icon: 'fa-users',
      title: 'Communities & Live',
      text: 'Join branded spaces, go live, and interact with people who share your vibe. Communities are created on brand.echoty.xyz.'
    },
    {
      icon: 'fa-robot',
      title: 'ECHO AI',
      text: 'Ask anything about the app – ECHO AI knows everything and is always ready to help.'
    },
    {
      icon: 'fa-heart',
      title: 'The Team',
      text: 'A small, passionate team. A little over 50 people already using it. Growing every day.'
    },
    {
      icon: 'fa-globe',
      title: 'Find Us',
      text: 'Home: echoty.xyz · Support: echoinfoteam@gmail.com · Discover. Connect. Echo.'
    }
  ];

  // ─── Intersection Observer for scroll animations ──────────────
  const itemRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('about-item-visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <SEO
        title="About ECHO — Founded by Lawal Abdulmalik"
        description="The story and product behind ECHO (Echoty), the future of chat. Founded by Lawal Abdulmalik in 2024."
        image="https://echoty.xyz/lawal-abdulmalik.jpg"
      />
      <StructuredData />
      <div className="about-page">
        <header className="about-hero">
          <p className="about-kicker">ECHO</p>
          <h1>Made to be heard.</h1>
          <p>Discover. Connect. Echo.</p>

          {/* ─── Founder card (SEO signal for Knowledge Panel) ─── */}
          <Link to="/lawal-abdulmalik" className="about-founder-card">
            <img
              src="/lawal-abdulmalik.jpg"
              alt="Lawal Abdulmalik, Founder & CEO of ECHO"
              className="about-founder-photo"
              loading="lazy"
            />
            <div className="about-founder-meta">
              <span className="about-founder-name">Lawal Abdulmalik</span>
              <span className="about-founder-role">Founder &amp; CEO of ECHO</span>
            </div>
          </Link>
        </header>

        <div className="about-timeline">
          {sections.map((section, index) => (
            <div
              key={index}
              className={`about-item ${index % 2 === 0 ? 'about-item-left' : 'about-item-right'}`}
              ref={(el) => (itemRefs.current[index] = el)}
            >
              <div className="about-item-icon">
                <i className={`fas ${section.icon}`} />
              </div>
              <div className="about-item-content">
                <h3>{section.title}</h3>
                {typeof section.text === 'string' ? <p>{section.text}</p> : <p>{section.text}</p>}
              </div>
              {index < sections.length - 1 && <div className="about-item-line" />}
            </div>
          ))}
        </div>

        <div className="about-footer">
          <p>ECHO · echoty.xyz</p>
        </div>
      </div>
    </>
  );
};

export default About;
