import React, { useState, useEffect } from 'react';
import './AdBanner.css';

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

  /*
  const handleAdClick = () => {
    open('https://www.google.com'); // Используем open для открытия в браузере
  };
  */

  if (isClosed) {
    return null;
  }

  return (
    <div className={`ad-banner ${theme} ${isVisible ? 'visible' : ''}`}>
      <a href="https://www.bybit.com/invite?ref=WQKDQG4" target="_blank" rel="noopener noreferrer" className="ad-link">
                Ad: Buy BTC on Bybit
              </a>
      <button onClick={handleClose} className="close-button">
        &times;
      </button>
    </div>
  );
};

export default AdBanner;
