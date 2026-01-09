import React, { useState, useEffect } from 'react';
import './AdBanner.css';
import { open } from '@tauri-apps/plugin-shell';

interface AdBannerProps {
  theme: 'light' | 'dark';
}

const AdBanner: React.FC<AdBannerProps> = ({ theme }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    // Check session storage for closed state
    const sessionClosed = sessionStorage.getItem('adBannerClosed');
    if (sessionClosed === 'true') {
      setIsClosed(true);
      return;
    }

    // Animation delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000); // 2-3 seconds delay

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setIsClosed(true);
    sessionStorage.setItem('adBannerClosed', 'true');
  };

  const handleAdClick = () => {
    open('https://www.google.com'); // Используем open для открытия в браузере
  };

  if (isClosed) {
    return null;
  }

  return (
    <div className={`ad-banner ${theme} ${isVisible ? 'visible' : ''}`}>
      <span onClick={handleAdClick} className="ad-link">
        Ad: Click here for a special offer!
      </span>
      <button onClick={handleClose} className="close-button">
        &times;
      </button>
    </div>
  );
};

export default AdBanner;
