import { useState, useEffect, useRef } from "react";
import "./App.css";
import PriceChart from "./PriceChart";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import AdBanner from "./components/AdBanner";

const REFRESH_INTERVAL_MS = 5000;

type Timeframe = "24h" | "1w" | "1m" | "1y";
type Theme = "light" | "dark";

// Helper function to calculate percentage change
const calculatePercentageChange = (prices: number[]): number | null => {
  if (prices.length < 2) return null;
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  if (firstPrice === 0) return null; // Avoid division by zero
  return ((lastPrice - firstPrice) / firstPrice) * 100;
};

function App() {
  const { t, i18n } = useTranslation();
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const isSettings = window.location.search.includes("window=settings");

  const openSettings = async () => {
    console.log("Opening settings...");
    try {
      await invoke("open_settings");
      console.log("Settings command invoked successfully");
    } catch (error) {
      console.error("Failed to open settings:", error);
    }
  };

  const [change24h, setChange24h] = useState<number | null>(null);
  const [change1w, setChange1w] = useState<number | null>(null);
  const [change1m, setChange1m] = useState<number | null>(null);
  const [change1y, setChange1y] = useState<number | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const [theme, setTheme] = useState<Theme>("light"); // Default theme
  const [dataUpdatedCounter, setDataUpdatedCounter] = useState(0);

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
          // Мы больше не берем процент из тикера, чтобы он не расходился с графиком
          setError(null);
        } else {
          throw new Error(t("Error loading price"));
        }
      } catch (err) {
        const errorMessage = t("No connection to Bybit API, trying again");
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
          case "24h": setChange24h(change); break;
          case "1w": setChange1w(change); break;
          case "1m": setChange1m(change); break;
          case "1y": setChange1y(change); break;
        }
      }
      // Increment counter to trigger chart data update
      setDataUpdatedCounter(prev => prev + 1);
    };

    fetchData(); // Initial fetch

    const interval = setInterval(() => {
        fetchData(); // Fetch data periodically
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []); // Empty dependency array to run once on mount

  // Update chartData when timeframe changes or data is updated
  useEffect(() => {
    setChartData(allChartData.current[timeframe]);
  }, [timeframe, dataUpdatedCounter]);

  useEffect(() => {
    // Слушаем изменение таймфрейма из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("timeframe-changed", (event) => {
      setTimeframe(event.payload as Timeframe);
    });

    return () => {
      unlistenPromise.then(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
    };
  }, []);

  useEffect(() => {
    // Слушаем изменение темы из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("theme-changed", (event) => {
      setTheme(event.payload === "theme_light" ? "light" : "dark");
    });

    return () => {
      unlistenPromise.then(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
    };
  }, []);

  useEffect(() => {
    // Слушаем изменение языка из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("language-changed", (event) => {
      console.log("Language changed event received:", event.payload);
      const lang = event.payload === "lang_en" ? "en" : "ru";
      console.log("Changing language to:", lang);
      i18n.changeLanguage(lang);
      console.log("Current i18n language after change:", i18n.language);
    });

    return () => {
      unlistenPromise.then(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
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

  if (isSettings) {
    return (
      <div className={`app ${theme} settings-window`}>
        <div className="titlebar">
          <div className="title">{t("Settings")}</div>
        </div>
        <div className="content">
          <h2>{t("Settings")}</h2>
          <p>{t("Coming soon...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`app ${theme}`} 
      style={{ position: 'relative' }} 
      onContextMenu={handleContextMenu}
      data-tauri-drag-region
    >
      <AdBanner theme={theme} />
      <div 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.6 }}
        data-tauri-drag-region
      >
        <PriceChart data={chartData} color={currentChange && currentChange >= 0 ? "#22c55e" : "#ef4444"} />
      </div>
      <div className="titlebar" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        <button className="settings-button" onClick={openSettings} title={t("Settings")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <span className="title" data-tauri-drag-region>{t("Chibi Sats")}</span>
      </div>
      <div className="content" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        {priceUsd === null && !error && <div>{t("Loading...")}</div>}
        {priceUsd === null && error && <div className="error">{error}</div>}
        {priceUsd !== null && (
          <div className="price" data-tauri-drag-region>
            <div data-tauri-drag-region>
              {t("BTC")}: <span className="price-value" data-tauri-drag-region>${priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
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
