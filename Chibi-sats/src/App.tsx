import { useState, useEffect } from "react";
import "./App.css";
import PriceChart from "./PriceChart";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const REFRESH_INTERVAL_MS = 5000;

type Timeframe = "24h" | "1w" | "1m" | "1y";

const appWindow = getCurrentWindow();

function App() {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");

  const getKlineParams = (tf: Timeframe) => {
    switch (tf) {
      case "24h": return { interval: "15", limit: 96 }; // 15m * 96 = 24h
      case "1w": return { interval: "60", limit: 168 }; // 1h * 168 = 7d
      case "1m": return { interval: "240", limit: 180 }; // 4h * 180 = 30d
      case "1y": return { interval: "D", limit: 365 }; // 1d * 365 = 1y
      default: return { interval: "15", limit: 96 };
    }
  };

  useEffect(() => {
    const fetchPrice = async () => {
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
    };

    const fetchHistory = async () => {
      try {
        const { interval, limit } = getKlineParams(timeframe);
        const response = await fetch(
          `https://api.bybit.com/v5/market/kline?category=inverse&symbol=BTCUSD&interval=${interval}&limit=${limit}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (data.retCode === 0 && data.result && data.result.list) {
          const prices = data.result.list
            .map((item: string[]) => parseFloat(item[4]))
            .reverse();
          setChartData(prices);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    fetchPrice();
    fetchHistory();

    const interval = setInterval(() => {
        fetchPrice();
        fetchHistory();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [timeframe]);

  useEffect(() => {
    // Слушаем изменение таймфрейма из нативного меню
    const unlisten = listen<string>("timeframe-changed", (event) => {
      setTimeframe(event.payload as Timeframe);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    invoke("show_context_menu");
  };

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
        <PriceChart data={chartData} color={change24h && change24h >= 0 ? "#22c55e" : "#ef4444"} />
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
            {change24h !== null && (
              <div className={`change ${change24h >= 0 ? "up" : "down"}`} data-tauri-drag-region>
                {change24h >= 0 ? "▲" : "▼"} {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}% {timeframe === "24h" ? "24h" : timeframe}
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
