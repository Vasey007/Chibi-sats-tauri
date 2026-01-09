import { useState, useEffect, useRef } from "react";
import "./App.css";
import PriceChart from "./PriceChart";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const REFRESH_INTERVAL_MS = 5000;

type Timeframe = "24h" | "1w" | "1m" | "1y";

// Helper function to calculate percentage change
const calculatePercentageChange = (prices: number[]): number | null => {
  if (prices.length < 2) return null;
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  if (firstPrice === 0) return null; // Avoid division by zero
  return ((lastPrice - firstPrice) / firstPrice) * 100;
};

function App() {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [change1w, setChange1w] = useState<number | null>(null);
  const [change1m, setChange1m] = useState<number | null>(null);
  const [change1y, setChange1y] = useState<number | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");

  // Use useRef to store chart data for different timeframes
  const allChartData = useRef<Record<Timeframe, number[]>>({
    "24h": [],
    "1w": [],
    "1m": [],
    "1y": [],
  });

  const getKlineParams = (tf: Timeframe) => {
    switch (tf) {
      case "24h": return { interval: "15", limit: 96 }; // 15m * 96 = 24h
      case "1w": return { interval: "60", limit: 168 }; // 1h * 168 = 7d
      case "1m": return { interval: "240", limit: 180 }; // 4h * 180 = 30d
      case "1y": return { interval: "D", limit: 365 }; // 1d * 365 = 1y
      default: return { interval: "15", limit: 96 };
    }
  };

  // Function to fetch historical data for a given timeframe
  const fetchHistory = async (tf: Timeframe): Promise<number[]> => {
    try {
      const { interval, limit } = getKlineParams(tf);
      const response = await fetch(
        `https://api.bybit.com/v5/market/kline?category=inverse&symbol=BTCUSD&interval=${interval}&limit=${limit}`
      );
      if (!response.ok) {
        console.error(`Error fetching history for ${tf}:`, response.statusText);
        return [];
      }
      const data = await response.json();
      if (data.retCode === 0 && data.result && data.result.list) {
        return data.result.list
          .map((item: string[]) => parseFloat(item[4]))
          .reverse();
      }
    } catch (err) {
      console.error(`Error fetching history for ${tf}:`, err);
    }
    return [];
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch current price and 24h change
      try {
        const response = await fetch(
          "https://api.bybit.com/v5/market/tickers?category=inverse&symbol=BTCUSD"
        );
        
        if (!response.ok) {
          throw new Error("Error loading price");
        }

        const data = await response.json();
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const item = data.result.list[0];
          setPriceUsd(parseFloat(item.lastPrice));
          setChange24h(parseFloat(item.price24hPcnt) * 100);
          setError(null);
        } else {
          throw new Error("Error loading price");
        }
      } catch (err) {
        const errorMessage = "No connection to Bybit API, trying again";
        setError(errorMessage);
        console.error("Error fetching price from Bybit:", err);
      }

      // Fetch historical data for all timeframes and calculate changes
      const timeframes: Timeframe[] = ["24h", "1w", "1m", "1y"];
      for (const tf of timeframes) {
        const prices = await fetchHistory(tf);
        allChartData.current[tf] = prices; // Store all prices
        const change = calculatePercentageChange(prices);
        switch (tf) {
          case "24h": setChange24h(change); break; // This will be overwritten by ticker data if available
          case "1w": setChange1w(change); break;
          case "1m": setChange1m(change); break;
          case "1y": setChange1y(change); break;
        }
      }
      // Set initial chart data after all historical data is fetched
      setChartData(allChartData.current[timeframe]);
    };

    fetchData(); // Initial fetch

    const interval = setInterval(() => {
        fetchData(); // Fetch data periodically
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []); // Empty dependency array to run once on mount

  // Update chartData when timeframe changes
  useEffect(() => {
    setChartData(allChartData.current[timeframe]);
  }, [timeframe]);

  useEffect(() => {
    // Слушаем изменение таймфрейма из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("timeframe-changed", (event) => {
      setTimeframe(event.payload as Timeframe);
    });

    return async () => {
      const unlisten = await unlistenPromise;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    invoke("show_context_menu");
  };

  const displayChange = () => {
    switch (timeframe) {
      case "24h": return change24h;
      case "1w": return change1w;
      case "1m": return change1m;
      case "1y": return change1y;
      default: return change24h;
    }
  };

  const currentChange = displayChange();

  return (
    <div 
      className="app" 
      style={{ position: 'relative' }} 
      onContextMenu={handleContextMenu}
      data-tauri-drag-region
    >
      <div 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.6 }}
        data-tauri-drag-region
      >
        <PriceChart data={chartData} color={currentChange && currentChange >= 0 ? "#22c55e" : "#ef4444"} />
      </div>
      <div className="titlebar" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>Chibi Sats</span>
      </div>
      <div className="content" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        {priceUsd === null && !error && <div>Loading...</div>}
        {priceUsd === null && error && <div className="error">{error}</div>}
        {priceUsd !== null && (
          <div className="price" data-tauri-drag-region>
            <div data-tauri-drag-region>
              BTC: <span className="price-value" data-tauri-drag-region>${priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
            {currentChange !== null && (
              <div className={`change ${currentChange >= 0 ? "up" : "down"}`} data-tauri-drag-region>
                {currentChange >= 0 ? "▲" : "▼"} {currentChange >= 0 ? "+" : ""}{currentChange.toFixed(2)}% {timeframe}
              </div>
            )}
            {error && <div className="error-message" data-tauri-drag-region>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
