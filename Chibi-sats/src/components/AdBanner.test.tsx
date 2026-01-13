import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdBanner from './AdBanner';

describe('AdBanner Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  it('should not be visible initially', () => {
    render(<AdBanner theme="dark" />);
    const banner = screen.queryByText(/Ad: Buy BTC on Bybit/i);
    // The component is rendered but has no 'visible' class initially
    expect(banner?.parentElement).not.toHaveClass('visible');
  });

  it('should become visible after 2 seconds', () => {
    render(<AdBanner theme="dark" />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const banner = screen.getByText(/Ad: Buy BTC on Bybit/i);
    expect(banner.parentElement).toHaveClass('visible');
  });

  it('should close when close button is clicked', () => {
    render(<AdBanner theme="dark" />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    const banner = screen.queryByText(/Ad: Buy BTC on Bybit/i);
    expect(banner).toBeNull();
    expect(sessionStorage.getItem('adBannerClosed')).toBe('true');
  });

  it('should apply theme class', () => {
    render(<AdBanner theme="anime" />);
    const banner = screen.getByText(/Ad: Buy BTC on Bybit/i);
    expect(banner.parentElement).toHaveClass('anime');
  });
});
