export interface PriceAlert {
  id: string;
  symbol: string;
  currency: string;
  targetPrice: number;
  direction: "above" | "below";
  active: boolean;
}

/**
 * Helper function to calculate percentage change
 * @param prices Array of prices
 * @returns Percentage change or null if not enough data
 */
export const calculatePercentageChange = (prices: number[]): number | null => {
  if (prices.length < 2) return null;
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  if (firstPrice === 0) return null; // Avoid division by zero
  return ((lastPrice - firstPrice) / firstPrice) * 100;
};

/**
 * Checks if any alerts should be triggered based on current price
 * @param alerts List of all alerts
 * @param currentPrice Current price
 * @param currentSymbol Current symbol (e.g., BTC)
 * @param currentCurrency Current currency (e.g., USD)
 * @returns Object with triggered flag and updated alerts list
 */
export const processAlerts = (
  alerts: PriceAlert[],
  currentPrice: number,
  currentSymbol: string,
  currentCurrency: string
): { triggered: boolean; updatedAlerts: PriceAlert[] } => {
  let triggered = false;
  const updatedAlerts = alerts.map((alert) => {
    if (
      alert.active &&
      alert.symbol === currentSymbol &&
      alert.currency === currentCurrency
    ) {
      const isTriggered =
        alert.direction === "above"
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;

      if (isTriggered) {
        triggered = true;
        return { ...alert, active: false };
      }
    }
    return alert;
  });

  return { triggered, updatedAlerts };
};

/**
 * Formats price with currency symbol
 * @param price Price to format
 * @param currency Currency code
 * @param symbols Map of currency codes to symbols
 * @returns Formatted price string
 */
export const formatPrice = (
  price: number | null,
  currency: string,
  symbols: Record<string, string>
): string => {
  if (price === null) return "---";
  const symbol = symbols[currency] || "";
  
  if (price >= 10000) {
    return `${symbol}${Math.round(price).toLocaleString('en-US')}`;
  } else if (price >= 1) {
    return `${symbol}${price.toFixed(2)}`;
  } else if (price >= 0.0001) {
    return `${symbol}${price.toFixed(4)}`;
  } else {
    return `${symbol}${price.toFixed(8)}`;
  }
};

/**
 * Calculates SVG paths for price chart
 * @param data Array of prices
 * @returns Object with pathD and areaD strings
 */
export const calculateSvgPaths = (data: number[]): { pathD: string; areaD: string } => {
  if (!data || data.length < 2) return { pathD: "", areaD: "" };
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    let y;
    
    if (range === 0) {
      y = 50;
    } else {
      const normalizedY = (value - min) / range;
      y = 90 - (normalizedY * 80); 
    }
    
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  let d = `M ${points[0]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i]}`;
  }
  
  const area = `${d} L 100,100 L 0,100 Z`;
  
  return { pathD: d, areaD: area };
};
