import { describe, it, expect } from 'vitest';
import { calculatePercentageChange, processAlerts, formatPrice, calculateSvgPaths, PriceAlert } from './utils';

describe('calculatePercentageChange', () => {
  it('should return null for empty array', () => {
    expect(calculatePercentageChange([])).toBeNull();
  });

  it('should return null for single price', () => {
    expect(calculatePercentageChange([100])).toBeNull();
  });

  it('should return null if first price is zero', () => {
    expect(calculatePercentageChange([0, 100])).toBeNull();
  });

  it('should calculate positive change correctly', () => {
    expect(calculatePercentageChange([100, 110])).toBe(10);
    expect(calculatePercentageChange([100, 150, 200])).toBe(100);
  });

  it('should calculate negative change correctly', () => {
    expect(calculatePercentageChange([100, 90])).toBe(-10);
    expect(calculatePercentageChange([100, 50])).toBe(-50);
  });

  it('should return 0 if prices are the same', () => {
    expect(calculatePercentageChange([100, 100])).toBe(0);
  });
});

describe('processAlerts', () => {
  const mockAlerts: PriceAlert[] = [
    { id: '1', symbol: 'BTC', currency: 'USD', targetPrice: 50000, direction: 'above', active: true },
    { id: '2', symbol: 'BTC', currency: 'USD', targetPrice: 40000, direction: 'below', active: true },
    { id: '3', symbol: 'ETH', currency: 'USD', targetPrice: 3000, direction: 'above', active: true },
  ];

  it('should trigger "above" alert when price is reached', () => {
    const { triggered, updatedAlerts } = processAlerts(mockAlerts, 51000, 'BTC', 'USD');
    expect(triggered).toBe(true);
    expect(updatedAlerts.find(a => a.id === '1')?.active).toBe(false);
    expect(updatedAlerts.find(a => a.id === '2')?.active).toBe(true);
  });

  it('should trigger "below" alert when price is reached', () => {
    const { triggered, updatedAlerts } = processAlerts(mockAlerts, 39000, 'BTC', 'USD');
    expect(triggered).toBe(true);
    expect(updatedAlerts.find(a => a.id === '2')?.active).toBe(false);
  });

  it('should not trigger if symbol does not match', () => {
    const { triggered } = processAlerts(mockAlerts, 60000, 'SOL', 'USD');
    expect(triggered).toBe(false);
  });

  it('should not trigger if alert is inactive', () => {
    const inactiveAlerts: PriceAlert[] = [
      { id: '1', symbol: 'BTC', currency: 'USD', targetPrice: 50000, direction: 'above', active: false }
    ];
    const { triggered } = processAlerts(inactiveAlerts, 55000, 'BTC', 'USD');
    expect(triggered).toBe(false);
  });
});

describe('formatPrice', () => {
  const symbols = { USD: '$', EUR: '€' };

  it('should format large prices correctly', () => {
    expect(formatPrice(55432.12, 'USD', symbols)).toBe('$55,432');
  });

  it('should format medium prices with 2 decimals', () => {
    expect(formatPrice(123.456, 'USD', symbols)).toBe('$123.46');
  });

  it('should format small prices with 4 decimals', () => {
    expect(formatPrice(0.123456, 'USD', symbols)).toBe('$0.1235');
  });

  it('should format very small prices with 8 decimals', () => {
    expect(formatPrice(0.0000123456, 'USD', symbols)).toBe('$0.00001235');
  });

  it('should return "---" for null price', () => {
    expect(formatPrice(null, 'USD', symbols)).toBe('---');
  });
});

describe('calculateSvgPaths', () => {
  it('should return empty paths for invalid data', () => {
    expect(calculateSvgPaths([])).toEqual({ pathD: "", areaD: "" });
    expect(calculateSvgPaths([100])).toEqual({ pathD: "", areaD: "" });
  });

  it('should calculate paths correctly for basic data', () => {
    const data = [100, 200];
    const { pathD, areaD } = calculateSvgPaths(data);
    
    // x: 0 and 100
    // min: 100, max: 200, range: 100
    // y for 100: 90 - (0 * 80) = 90
    // y for 200: 90 - (1 * 80) = 10
    expect(pathD).toBe('M 0.00,90.00 L 100.00,10.00');
    expect(areaD).toBe('M 0.00,90.00 L 100.00,10.00 L 100,100 L 0,100 Z');
  });

  it('should handle constant prices (range 0)', () => {
    const data = [100, 100, 100];
    const { pathD } = calculateSvgPaths(data);
    // y should be 50.00
    expect(pathD).toContain('50.00');
  });
});
