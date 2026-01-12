import { useState, useEffect, useRef, useMemo } from "react";
import "./App.css";
import PriceChart from "./PriceChart";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import AdBanner from "./components/AdBanner";

type Timeframe = "24h" | "1w" | "1m" | "1y";
type Theme = "light" | "dark" | "anime" | "billionaire" | "dragon" | "bender" | "casino" | "lord";
type Currency = "USD" | "EUR" | "BRL" | "TRY" | "PLN";

const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  BRL: "R$",
  TRY: "₺",
  PLN: "zł",
};

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
  const [timeframe, setTimeframe] = useState<Timeframe>(() => (localStorage.getItem("timeframe") as Timeframe) || "24h");
  const timeframes: Timeframe[] = ["24h", "1w", "1m", "1y"];

  const handleTimeframeClick = () => {
    const currentIndex = timeframes.indexOf(timeframe);
    const nextIndex = (currentIndex + 1) % timeframes.length;
    const nextTimeframe = timeframes[nextIndex];
    setTimeframe(nextTimeframe);
    localStorage.setItem("timeframe", nextTimeframe);
  };

  const getTimeframeWheel = () => {
    const currentIndex = timeframes.indexOf(timeframe);
    const prevIndex = (currentIndex - 1 + timeframes.length) % timeframes.length;
    const nextIndex = (currentIndex + 1) % timeframes.length;

    return [timeframes[prevIndex], timeframes[currentIndex], timeframes[nextIndex]];
  };

  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem("currency") as Currency) || "USD");
  const [dataUpdatedCounter, setDataUpdatedCounter] = useState(0);
  const [autostart, setAutostart] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => localStorage.getItem("alwaysOnTop") === "true");
  const [opacity, setOpacity] = useState(() => parseFloat(localStorage.getItem("windowOpacity") || "1.0"));
  const [refreshInterval, setRefreshInterval] = useState(() => parseInt(localStorage.getItem("refreshInterval") || "5000"));
  const [currentSymbol, setCurrentSymbol] = useState(() => localStorage.getItem("currentSymbol") || "BTC");

  useEffect(() => {
    // Получаем статус автозагрузки при запуске
    invoke<boolean>("get_autostart_status")
      .then(setAutostart)
      .catch(console.error);

    // Применяем начальные настройки окна
    invoke("set_always_on_top", { alwaysOnTop });
  }, []);

  // Use useRef to store chart data for different timeframes
  const allChartData = useRef<Record<Timeframe, number[]>>({
    "24h": [],
    "1w": [],
    "1m": [],
    "1y": [],
  });

  useEffect(() => {
    const getKlineParams = (tf: Timeframe) => {
      switch (tf) {
        case "24h": return { interval: "15", limit: 96 }; // 15m * 96 = 24h
        case "1w": return { interval: "60", limit: 168 }; // 1h * 168 = 7d
        case "1m": return { interval: "240", limit: 180 }; // 4h * 180 = 30d
        case "1y": return { interval: "D", limit: 365 }; // 1d * 365 = 1y
        default: return { interval: "15", limit: 96 };
      }
    };

    const fetchHistory = async (tf: Timeframe): Promise<number[]> => {
      try {
        const { interval, limit } = getKlineParams(tf);
        const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
        const category = currency === "USD" ? "inverse" : "spot";
        const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}&t=${Date.now()}`;
        const response = await fetch(url);
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

    const fetchData = async () => {
      console.log(`Fetching data for ${currentSymbol}/${currency}...`);
      // Fetch current price and 24h change
      try {
        const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
        const category = currency === "USD" ? "inverse" : "spot";
        const url = `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}&t=${Date.now()}`;
        console.log(`Fetching ticker: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Error loading price");
        }

        const data = await response.json();
        console.log("Ticker data received:", data);
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const item = data.result.list[0];
          const newPrice = parseFloat(item.lastPrice);
          console.log(`Setting new price: ${newPrice} ${currency}`);
          setPriceUsd(newPrice);
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
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [currency, currentSymbol, t, refreshInterval]); // Add currency, currentSymbol and refreshInterval to dependencies

  // Update chartData when timeframe changes or data is updated
  useEffect(() => {
    setChartData(allChartData.current[timeframe]);
  }, [timeframe, dataUpdatedCounter]);

  useEffect(() => {
    // Слушаем изменение таймфрейма из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("timeframe-changed", (event) => {
      const newTf = event.payload as Timeframe;
      if (timeframes.includes(newTf)) {
        setTimeframe(newTf);
        localStorage.setItem("timeframe", newTf);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => {
        if (unlisten) {
          unlisten();
        }
      });
    };
  }, [timeframes]);

  useEffect(() => {
    // Слушаем изменение темы из нативного меню
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("theme-changed", (event) => {
      let newTheme: Theme;
      if (event.payload === "theme_light") newTheme = "light";
      else if (event.payload === "theme_anime") newTheme = "anime";
      else if (event.payload === "theme_billionaire") newTheme = "billionaire";
      else if (event.payload === "theme_dragon") newTheme = "dragon";
      else if (event.payload === "theme_bender") newTheme = "bender";
      else if (event.payload === "theme_casino") newTheme = "casino";
      else if (event.payload === "theme_lord") newTheme = "lord";
      else newTheme = "dark";
      
      setTheme(newTheme);
      localStorage.setItem("theme", newTheme);
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

  useEffect(() => {
    // Listen for currency change
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("currency-changed", (event) => {
      setCurrency(event.payload as Currency);
    });
    return () => { unlistenPromise.then(u => u()); };
  }, []);

  useEffect(() => {
    // Listen for symbol change
    let unlistenPromise: Promise<() => void>;
    unlistenPromise = listen<string>("symbol-changed", (event) => {
      setCurrentSymbol(event.payload);
    });
    return () => { unlistenPromise.then(u => u()); };
  }, []);

  useEffect(() => {
     // Listen for opacity change
     let unlistenPromise: Promise<() => void>;
     unlistenPromise = listen<number>("opacity-changed", (event) => {
       setOpacity(event.payload);
     });
     return () => { unlistenPromise.then(u => u()); };
   }, []);

   useEffect(() => {
     // Listen for refresh interval change
     let unlistenPromise: Promise<() => void>;
     unlistenPromise = listen<number>("refresh-interval-changed", (event) => {
       setRefreshInterval(event.payload);
     });
     return () => { unlistenPromise.then(u => u()); };
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
    const handleCurrencyChange = async (newCurrency: Currency) => {
      setCurrency(newCurrency);
      localStorage.setItem("currency", newCurrency);
      await emit("currency-changed", newCurrency);
    };

    const handleThemeChange = (newTheme: Theme) => {
      setTheme(newTheme);
      localStorage.setItem("theme", newTheme);
      
      let payload = "theme_dark";
      if (newTheme === "light") payload = "theme_light";
      else if (newTheme === "anime") payload = "theme_anime";
      else if (newTheme === "billionaire") payload = "theme_billionaire";
      else if (newTheme === "dragon") payload = "theme_dragon";
      else if (newTheme === "bender") payload = "theme_bender";
      else if (newTheme === "casino") payload = "theme_casino";
      else if (newTheme === "lord") payload = "theme_lord";
      
      emit("theme-changed", payload);
    };

    const handleLanguageChange = (lang: string) => {
      i18n.changeLanguage(lang);
      emit("language-changed", lang === "en" ? "lang_en" : "lang_ru");
    };

    const handleAutostartToggle = async (enable: boolean) => {
      try {
        await invoke("set_autostart", { enable });
        setAutostart(enable);
      } catch (error) {
        console.error("Failed to set autostart:", error);
      }
    };

    const handleAlwaysOnTopChange = async (checked: boolean) => {
      setAlwaysOnTop(checked);
      localStorage.setItem("alwaysOnTop", String(checked));
      await invoke("set_always_on_top", { alwaysOnTop: checked });
    };

    const handleOpacityChange = async (val: number) => {
      setOpacity(val);
      localStorage.setItem("windowOpacity", String(val));
      await emit("opacity-changed", val);
    };

    const handleRefreshIntervalChange = async (val: number) => {
      setRefreshInterval(val);
      localStorage.setItem("refreshInterval", String(val));
      await emit("refresh-interval-changed", val);
    };

    const handleSymbolChange = async (val: string) => {
      setCurrentSymbol(val);
      localStorage.setItem("currentSymbol", val);
      
      // If the current currency is not supported by the new symbol, switch to USD
      if (val === "SOL" && (currency === "TRY" || currency === "PLN")) {
        setCurrency("USD");
        localStorage.setItem("currency", "USD");
        await emit("currency-changed", "USD");
      }
      
      await emit("symbol-changed", val);
    };

    const openAbout = async () => {
      await invoke("open_about");
    };

    return (
      <div className={`app ${theme} settings-window`}>
        <div className="titlebar">
          <div className="title">{t("Settings")}</div>
        </div>
        <div className="content">
          <div className="settings-grid">
            <div className="settings-group">
              <label className="settings-label">{t("Cryptocurrency")}</label>
              <select 
                value={currentSymbol} 
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="theme-select"
              >
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="SOL">Solana (SOL)</option>
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t("Currency")}</label>
              <select 
                className="currency-select"
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
              >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="BRL">BRL (R$)</option>
                  {currentSymbol !== "SOL" && <option value="TRY">TRY (₺)</option>}
                  {currentSymbol !== "SOL" && <option value="PLN">PLN (zł)</option>}
                </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t("Themes")}</label>
              <select 
                  className="currency-select" 
                  value={theme} 
                  onChange={(e) => handleThemeChange(e.target.value as Theme)}
                >
                  <option value="light">{t("Light")}</option>
                  <option value="dark">{t("Dark")}</option>
                  <option value="anime">{t("Anime")}</option>
                   <option value="billionaire">{t("Billionaire")}</option>
                   <option value="dragon">{t("Golden Dragon")}</option>
                   <option value="bender">{t("Bender")}</option>
                   <option value="casino">{t("Casino")}</option>
                   <option value="lord">{t("Lord")}</option>
                 </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t("Language")}</label>
              <select 
                className="currency-select"
                value={i18n.language.startsWith('ru') ? 'ru' : 'en'}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                <option value="en">{t("English")}</option>
                <option value="ru">{t("Russian")}</option>
              </select>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t("Refresh Interval")}</label>
              <select 
                value={refreshInterval} 
                onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                className="theme-select"
              >
                <option value="5000">5 {t("sec")}</option>
                <option value="10000">10 {t("sec")}</option>
                <option value="30000">30 {t("sec")}</option>
                <option value="60000">1 {t("min")}</option>
                <option value="300000">5 {t("min")}</option>
              </select>
            </div>

            <div className="checkbox-group">
              <label className="settings-label">
                <input 
                  type="checkbox" 
                  checked={alwaysOnTop} 
                  onChange={(e) => handleAlwaysOnTopChange(e.target.checked)}
                />
                {t("Always on Top")}
              </label>
            </div>

            <div className="settings-group">
              <label className="settings-label">{t("Opacity")}: {Math.round(opacity * 100)}%</label>
              <input 
                type="range" 
                min="0.2" 
                max="1.0" 
                step="0.05" 
                value={opacity} 
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                className="opacity-slider"
              />
            </div>

            <div className="checkbox-group">
              <label className="settings-label">
                <input 
                  type="checkbox" 
                  checked={autostart} 
                  onChange={(e) => handleAutostartChange(e.target.checked)}
                />
                {t("Launch at startup")}
              </label>
            </div>
          </div>

          <div className="settings-footer">
            <button className="about-button" onClick={openAbout}>
              {t("About Developer")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const chartColor = useMemo(() => {
    if (theme === 'anime') {
      return currentChange && currentChange >= 0 ? "#ff85b3" : "#a18cd1";
    }
    if (theme === 'billionaire') {
      return currentChange && currentChange >= 0 ? "#ffd700" : "#b8860b";
    }
    if (theme === 'dragon') {
      return currentChange && currentChange >= 0 ? "#ffd700" : "#ff8f00";
    }
    return currentChange && currentChange >= 0 ? "#22c55e" : "#ef4444";
  }, [theme, currentChange]);

  return (
    <div 
      className={`app ${theme}`} 
      style={{ position: 'relative', opacity: isSettings ? 1 : opacity }} 
      onContextMenu={handleContextMenu}
      data-tauri-drag-region
    >
      <AdBanner theme={theme} />
      <div 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.6 }}
        data-tauri-drag-region
      >
        <PriceChart data={chartData} color={chartColor} />
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
              {currentSymbol}: <span className="price-value" data-tauri-drag-region>{currencySymbols[currency]}{priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
            {currentChange !== null && (
              <div className={`change ${currentChange >= 0 ? "up" : "down"}`} data-tauri-drag-region>
                <div data-tauri-drag-region>
                  {currentChange >= 0 ? "▲" : "▼"} {currentChange >= 0 ? "+" : ""}{currentChange.toFixed(2)}%
                </div>
              </div>
            )}
            {error && <div className="error-message" data-tauri-drag-region>{error}</div>}
          </div>
        )}
      </div>
      <div className={`timeframe-wheel-container ${currentChange && currentChange >= 0 ? 'up' : 'down'}`} onClick={handleTimeframeClick} style={{ position: 'relative', zIndex: 1 }}>
        <div className="timeframe-wheel">
          {getTimeframeWheel().map((tf, index) => (
            <div 
              key={tf} 
              className={`timeframe-item ${index === 1 ? 'active' : ''}`}
            >
              {t(tf)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
