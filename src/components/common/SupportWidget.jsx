import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './SupportWidget.css';

const SCRIPT_SRC = 'https://myhappr.com/widget.js';

function shouldShow(pathname) {
  return (
    pathname === '/' ||
    pathname === '/chats' ||
    pathname === '/communities' ||
    pathname === '/shop' ||
    pathname === '/other'
  );
}

const SupportWidget = () => {
  const { pathname } = useLocation();
  const visible = shouldShow(pathname);

  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute('data-username', 'echoty');
    script.setAttribute('data-color', '#9D5EFF');
    script.setAttribute('data-button-color', '#9D5EFF');
    script.setAttribute('data-text-color', '#FFFFFF');
    script.setAttribute('data-radius', '8px');
    script.setAttribute('data-text', 'Support ECHO');
    script.setAttribute('data-title', 'Keep the Echo Alive');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-card-bg', '#FFFFFF');
    script.setAttribute('data-card-text', '#09090b');
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('echo-support-visible', visible);
    return () => document.body.classList.remove('echo-support-visible');
  }, [visible]);

  return null;
};

export default SupportWidget;
