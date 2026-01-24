import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import "./App.css";
import PriceChart from "./PriceChart";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import AdBanner from "./components/AdBanner";
import { calculatePercentageChange, processAlerts, formatPrice, PriceAlert, isTauri } from "./utils";
import { useLocalStorage, useTauriEvent, useTauriEmit } from "./hooks";

type Timeframe = "24h" | "1w" | "1m" | "1y";
type Theme = "light" | "dark" | "anime" | "billionaire" | "dragon" | "bender" | "casino" | "lord";
type Currency = "USD" | "EUR" | "BRL" | "TRY" | "PLN"; // | "FANTIK";

const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  BRL: "R$",
  TRY: "₺",
  PLN: "zł",
  // FANTIK: "🍬",
};

const playAlertSound = async () => {
  console.log("Attempting to play alert sound...");
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Приятный "Chibi" звук - два коротких бипа
    oscillator.type = 'sine';
    const now = audioCtx.currentTime;
    
    // Первый бип
    oscillator.frequency.setValueAtTime(880, now); // A5
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    
    // Второй бип чуть выше
    oscillator.frequency.setValueAtTime(1320, now + 0.25); // E6
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.5);

    oscillator.start(now);
    oscillator.stop(now + 0.5);
    console.log("Alert sound played successfully");
  } catch (e) {
    console.error("Failed to play sound:", e);
  }
};

function SettingsWindow() {
  const { t, i18n } = useTranslation();
  const tauriEmit = useTauriEmit();
  
  // Safe state initialization using hooks
  const [theme, setTheme] = useLocalStorage<Theme>("theme", "dark");
  const [currency, setCurrency] = useLocalStorage<Currency>("currency", "USD");
  const [autostart, setAutostart] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useLocalStorage("alwaysOnTop", false);
  const [opacity, setOpacity] = useLocalStorage("windowOpacity", 1.0);
  const [refreshInterval, setRefreshInterval] = useLocalStorage("refreshInterval", 5000);
  const [currentSymbol, setCurrentSymbol] = useLocalStorage("currentSymbol", "BTC");
  const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>("priceAlerts", []);

  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Subscribe to Tauri events
  useTauriEvent<string>("language-changed", (payload) => {
    i18n.changeLanguage(payload === "lang_en" ? "en" : "ru");
  }, [i18n]);

  useTauriEvent<string>("theme-changed", (payload) => {
    const themeMap: Record<string, Theme> = {
      theme_light: "light",
      theme_anime: "anime",
      theme_billionaire: "billionaire",
      theme_dragon: "dragon",
      theme_bender: "bender",
      theme_casino: "casino",
      theme_lord: "lord"
    };
    const newTheme = themeMap[payload] || "dark";
    setTheme(newTheme);
  });

  useTauriEvent<PriceAlert[]>("alerts-changed", (payload) => {
    if (JSON.stringify(payload) !== JSON.stringify(alerts)) {
      setAlerts(payload);
    }
  }, [alerts]);

  // Initial setup for autostart and window visibility
  useEffect(() => {
    if (isTauri()) {
      invoke<boolean>("get_autostart_status").then(setAutostart).catch(console.error);
      
      // CRITICAL: Show window only after React has finished first render and state init
      setTimeout(() => {
        invoke("show_window").catch(console.error);
      }, 150);
    }
    
    // Initial language setup from localStorage
    const savedLang = localStorage.getItem("language");
    if (savedLang) {
      i18n.changeLanguage(savedLang === "lang_en" ? "en" : "ru");
    }
  }, []);

  // Fetch current price for alert direction
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      try {
        const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
        const category = currency === "USD" ? "inverse" : "spot";
        const url = `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.retCode === 0 && data.result?.list?.[0]) {
          setPriceUsd(parseFloat(data.result.list[0].lastPrice));
        }
      } catch (e) {
        console.error("Failed to fetch price in settings:", e);
      }
    };
    fetchCurrentPrice();
  }, [currentSymbol, currency]);

  // Alert processing
  useEffect(() => {
    if (priceUsd !== null) {
      const { triggered, updatedAlerts } = processAlerts(alerts, priceUsd, currentSymbol, currency);
      if (triggered) {
        playAlertSound();
        setAlerts(updatedAlerts);
      }
    }
  }, [priceUsd, currentSymbol, currency, alerts]);

  const handleCurrencyChange = async (newCurrency: Currency) => {
    setCurrency(newCurrency);
    await tauriEmit("currency-changed", newCurrency);
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    await tauriEmit("theme-changed", "theme_" + newTheme);
  };

  const handleLanguageChange = async (lang: string) => {
    i18n.changeLanguage(lang);
    await tauriEmit("language-changed", lang === "en" ? "lang_en" : "lang_ru");
  };

  const handleAutostartToggle = async (enable: boolean) => {
    try {
      if (isTauri()) {
        await invoke("set_autostart", { enable });
      }
      setAutostart(enable);
    } catch (error) {
      console.error("Failed to set autostart:", error);
    }
  };

  const handleAlwaysOnTopChange = async (checked: boolean) => {
    setAlwaysOnTop(checked);
    if (isTauri()) {
      await invoke("set_always_on_top", { alwaysOnTop: checked });
    }
  };

  const handleOpacityChange = async (val: number) => {
    setOpacity(val);
    if (isTauri()) {
      await tauriEmit("opacity-changed", val);
    }
  };

  const handleRefreshIntervalChange = async (val: number) => {
    setRefreshInterval(val);
    if (isTauri()) {
      await tauriEmit("refresh-interval-changed", val);
    }
  };

  const confirmDelete = async () => {
    try {
      if (isTauri()) {
        await invoke("uninstall_app");
      } else {
        alert("Delete app simulated");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      alert(err);
      setShowDeleteConfirm(false);
    }
  };

  const handleSymbolChange = async (val: string) => {
    setCurrentSymbol(val);
    if (val === "SOL" && (currency === "TRY" || currency === "PLN")) {
      setCurrency("USD");
      if (isTauri()) await tauriEmit("currency-changed", "USD");
    } 
    if (isTauri()) await tauriEmit("symbol-changed", val);
  };

  /*
  const handleManualPriceChange = (symbol: string, val: string) => {
    const price = parseFloat(val);
    const newPrice = isNaN(price) ? 0 : price;
    const newPrices = { ...manualPrices, [symbol]: newPrice };
    setManualPrices(newPrices);
    localStorage.setItem("manualPrices", JSON.stringify(newPrices));
    if (isTauri()) {
      emit("manual-prices-changed", newPrices);
    }
  };

  const handleUseManualPriceToggle = (symbol: string, checked: boolean) => {
    const newUseManual = { ...useManualPrice, [symbol]: checked };
    setUseManualPrice(newUseManual);
    localStorage.setItem("useManualPrice", JSON.stringify(newUseManual));
    if (isTauri()) {
      emit("use-manual-price-changed", newUseManual);
    }
  };
  */

  const handleAddAlert = () => {
    const price = parseFloat(newAlertPrice);
    if (isNaN(price) || price <= 0) return;
    
    let currentPrice = priceUsd;
    /*
    if (!currentPrice && useManualPrice[currentSymbol]) {
      currentPrice = manualPrices[currentSymbol];
    }
    */

    if (!currentPrice) {
      console.warn("Cannot add alert: current price is not available yet");
      return;
    }

    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      symbol: currentSymbol,
      currency: currency,
      targetPrice: price,
      direction: price > currentPrice ? "above" : "below",
      active: true
    };

    if (isTauri()) {
      tauriEmit("add-alert", newAlert);
    } else {
      setAlerts([...alerts, newAlert]);
    }
    setNewAlertPrice("");
  };

  return (
    <div className={`app ${theme} settings-window`} style={{ opacity: 1, height: '100vh', overflow: 'hidden' }}>
      <div className="settings-header" data-tauri-drag-region>
        <span data-tauri-drag-region>{t("Settings")}</span>
        <button className="close-button" onClick={() => { if (isTauri()) invoke("close_window"); }}>×</button>
      </div>
      <div className="settings-content">
        <div className="settings-scroll-area">
          <div className="settings-grid">
            <div className="settings-group">
              <label className="settings-label">{t("Cryptocurrency")}</label>
              <select value={currentSymbol} onChange={(e) => handleSymbolChange(e.target.value)} className="currency-select">
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="SOL">Solana (SOL)</option>
                {/* <option value="FUNTIK">Funtik (TEST)</option> */}
              </select>
            </div>
            <div className="settings-group">
              <label className="settings-label">{t("Currency")}</label>
              <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value as Currency)} className="currency-select">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="BRL">BRL (R$)</option>
                {/* 
                {currentSymbol === "FUNTIK" ? (
                  <option value="FANTIK">Fantik (🍬)</option>
                ) : (
                */}
                  <>
                    <option value="TRY">TRY (₺)</option>
                    <option value="PLN">PLN (zł)</option>
                  </>
                {/* 
                )}
                */}
              </select>
            </div>
            <div className="settings-group">
              <label className="settings-label">{t("Theme")}</label>
              <select value={theme} onChange={(e) => handleThemeChange(e.target.value as Theme)} className="theme-select" data-testid="theme-select">
                <option value="light">{t("Light")}</option>
                <option value="dark">{t("Dark")}</option>
                <option value="anime">{t("Anime")}</option>
                <option value="billionaire">{t("Billionaire")}</option>
                <option value="dragon">{t("Dragon")}</option>
                <option value="bender">{t("Bender")}</option>
                <option value="casino">{t("Casino")}</option>
                <option value="lord">{t("Lord")}</option>
              </select>
            </div>
            <div className="settings-group">
              <label className="settings-label">{t("Language")}</label>
              <select className="currency-select" value={i18n.language.startsWith('ru') ? 'ru' : 'en'} onChange={(e) => handleLanguageChange(e.target.value)}>
                <option value="en">{t("English")}</option>
                <option value="ru">{t("Russian")}</option>
              </select>
            </div>
          </div>
          <div className="settings-separator"></div>
          {/* 
          <div className="settings-group">
            <div className="checkbox-group">
              <label className="settings-label">
                <input type="checkbox" checked={useManualPrice[currentSymbol] || false} onChange={(e) => handleUseManualPriceToggle(currentSymbol, e.target.checked)} />
                {t("Use Manual Price")}
              </label>
            </div>
            {useManualPrice[currentSymbol] && (
              <div style={{ marginTop: '8px' }}>
                <input type="number" value={manualPrices[currentSymbol] || 0} onChange={(e) => handleManualPriceChange(currentSymbol, e.target.value)} className="alert-input" style={{ width: '100%' }} />
              </div>
            )}
          </div>
          <div className="settings-separator"></div>
          */}
          <div className="settings-group">
            <label className="settings-label">{t("Chart Update Interval")}</label>
            <select value={refreshInterval} onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))} className="theme-select">
              <option value="5000">5 {t("sec")}</option>
              <option value="10000">10 {t("sec")}</option>
              <option value="30000">30 {t("sec")}</option>
              <option value="60000">1 {t("min")}</option>
              <option value="300000">5 {t("min")}</option>
            </select>
          </div>
          <div className="settings-separator"></div>
          <div className="settings-group">
            <label className="settings-label">{t("Price Alerts")}</label>
            <div className="alert-input-group">
              <input type="number" value={newAlertPrice} onChange={(e) => setNewAlertPrice(e.target.value)} placeholder={t("Target Price")} className="alert-input" />
              <button onClick={handleAddAlert} className="alert-add-button">+</button>
            </div>
            <div className="alerts-list">
              {alerts.filter(a => a.symbol === currentSymbol && a.currency === currency).map(alert => (
                <div key={alert.id} className={`alert-item ${!alert.active ? 'inactive' : ''}`}>
                  <span>{alert.direction === "above" ? "↑" : "↓"} {formatPrice(alert.targetPrice, alert.currency, currencySymbols)}</span>
                  <button onClick={() => {
                    if (isTauri()) {
                      tauriEmit("delete-alert", alert.id);
                    } else {
                      setAlerts(alerts.filter(a => a.id !== alert.id));
                    }
                  }} className="alert-remove-button">×</button>
                </div>
              ))}
            </div>
          </div>
          <div className="settings-separator"></div>
          <div className="settings-row">
            <div className="checkbox-group">
              <label className="settings-label">
                <input type="checkbox" checked={alwaysOnTop} onChange={(e) => handleAlwaysOnTopChange(e.target.checked)} />
                {t("Always on Top")}
              </label>
            </div>
            <div className="checkbox-group">
              <label className="settings-label">
                <input type="checkbox" checked={autostart} onChange={(e) => handleAutostartToggle(e.target.checked)} />
                {t("Launch at startup")}
              </label>
            </div>
          </div>
          <div className="settings-group">
            <label className="settings-label">{t("Opacity")}: {Math.round(opacity * 100)}%</label>
            <input type="range" min="0.2" max="1.0" step="0.05" value={opacity} onChange={(e) => handleOpacityChange(parseFloat(e.target.value))} className="opacity-slider" />
          </div>
        </div>
        <div className="settings-footer">
          <button className="about-button" onClick={() => { if (isTauri()) emit("request-open-about"); }}>{t("About Developer")}</button>
          <button className="delete-widget-stub" onClick={() => setShowDeleteConfirm(true)}>{t("Delete Widget")}</button>
        </div>

        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>{t("Delete Widget")}</h3>
              <p>{t("Are you sure you want to delete the widget?")}</p>
              <div className="modal-buttons">
                <button className="modal-button cancel" onClick={() => setShowDeleteConfirm(false)}>{t("Cancel")}</button>
                <button className="modal-button confirm" onClick={confirmDelete}>{t("Delete")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MainWindow() {
  const { t, i18n } = useTranslation();
  const tauriEmit = useTauriEmit();
  
  // Use hooks for state management
  const [theme, setTheme] = useLocalStorage<Theme>("theme", "light");
  const [currency, setCurrency] = useLocalStorage<Currency>("currency", "USD");
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>("timeframe", "24h");
  const [alwaysOnTop] = useLocalStorage("alwaysOnTop", false);
  const [opacity, setOpacity] = useLocalStorage("windowOpacity", 1.0);
  const [refreshInterval, setRefreshInterval] = useLocalStorage("refreshInterval", 5000);
  const [currentSymbol, setCurrentSymbol] = useLocalStorage("currentSymbol", "BTC");
  const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>("priceAlerts", []);

  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [change1w, setChange1w] = useState<number | null>(null);
  const [change1m, setChange1m] = useState<number | null>(null);
  const [change1y, setChange1y] = useState<number | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataUpdatedCounter, setDataUpdatedCounter] = useState(0);

  const timeframes: Timeframe[] = ["24h", "1w", "1m", "1y"];

  const openSettings = useCallback(() => {
    tauriEmit("request-open-settings");
  }, [tauriEmit]);

  const handleTimeframeClick = () => {
    const currentIndex = timeframes.indexOf(timeframe);
    const nextTimeframe = timeframes[(currentIndex + 1) % timeframes.length];
    setTimeframe(nextTimeframe);
  };

  const getTimeframeWheel = () => {
    const currentIndex = timeframes.indexOf(timeframe);
    const prevIndex = (currentIndex - 1 + timeframes.length) % timeframes.length;
    const nextIndex = (currentIndex + 1) % timeframes.length;
    return [timeframes[prevIndex], timeframes[currentIndex], timeframes[nextIndex]];
  };

  // Subscribe to Tauri events
  useTauriEvent<string>("theme-changed", (payload) => {
    const themeMap: Record<string, Theme> = {
      theme_light: "light",
      theme_anime: "anime",
      theme_billionaire: "billionaire",
      theme_dragon: "dragon",
      theme_bender: "bender",
      theme_casino: "casino",
      theme_lord: "lord"
    };
    setTheme(themeMap[payload] || "dark");
  });

  useTauriEvent<Currency>("currency-changed", (payload) => {
    setCurrency(payload);
  });

  useTauriEvent<string>("language-changed", (payload) => {
    i18n.changeLanguage(payload === "lang_en" ? "en" : "ru");
  }, [i18n]);

  useTauriEvent<number>("opacity-changed", (payload) => {
    setOpacity(payload);
  });

  useTauriEvent<number>("refresh-interval-changed", (payload) => {
    setRefreshInterval(payload);
  });

  useTauriEvent<string>("symbol-changed", (payload) => {
    setCurrentSymbol(payload);
  });

  useTauriEvent<PriceAlert>("add-alert", (newAlert) => {
    setAlerts(prev => [...prev, newAlert]);
  }, [setAlerts]);

  useTauriEvent<string>("delete-alert", (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, [setAlerts]);

  useTauriEvent<PriceAlert[]>("alerts-changed", (payload) => {
    if (JSON.stringify(payload) !== JSON.stringify(alerts)) {
      setAlerts(payload);
    }
  }, [alerts]);

  // Sync alerts with other windows
  useEffect(() => {
    tauriEmit("alerts-changed", alerts);
  }, [alerts, tauriEmit]);

  // Initial setup
  useEffect(() => {
    if (isTauri()) {
      setTimeout(() => {
        invoke("show_window").catch(console.error);
      }, 150);
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    
    // Initial language setup from localStorage
    const savedLang = localStorage.getItem("language");
    if (savedLang) {
      i18n.changeLanguage(savedLang === "lang_en" ? "en" : "ru");
    }

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const allChartData = useRef<Record<Timeframe, number[]>>({ "24h": [], "1w": [], "1m": [], "1y": [] });
  const wsRef = useRef<WebSocket | null>(null);

  // 1. WebSocket for real-time price updates
  useEffect(() => {
    const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
    const category = currency === "USD" ? "inverse" : "spot";
    const wsUrl = `wss://stream.bybit.com/v5/public/${category}`;

    const connectWs = () => {
      if (wsRef.current) wsRef.current.close();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WS Connected to ${category} for ${symbol}`);
        ws.send(JSON.stringify({
          op: "subscribe",
          args: [`tickers.${symbol}`]
        }));
      };

      ws.onmessage = (event) => {
        const response = JSON.parse(event.data);
        if (response.topic === `tickers.${symbol}` && response.data) {
          const data = response.data;
          
          // In Bybit V5 WS tickers, lastPrice is only present if it changed
          // or in the initial snapshot.
          if (data.lastPrice) {
            const newPrice = parseFloat(data.lastPrice);
            if (!isNaN(newPrice)) {
              setPriceUsd(newPrice);
              setError(null);
            }
          }

          // Update 24h change if available
          if (data.price24hPcnt) {
            setChange24h(parseFloat(data.price24hPcnt) * 100);
          }
        }
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
        // Don't set error state here as we still have polling as fallback for history
      };

      ws.onclose = () => {
        console.log("WS Closed");
      };
    };

    connectWs();

    // Heartbeat for Bybit WS
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ op: "ping" }));
      }
    }, 20000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentSymbol, currency /*, useManualPrice*/, t]);

  useEffect(() => {
    if (priceUsd !== null) {
      const { triggered, updatedAlerts } = processAlerts(alerts, priceUsd, currentSymbol, currency);
      if (triggered) {
        playAlertSound();
        setAlerts(updatedAlerts);
      }
    }
  }, [priceUsd, currentSymbol, currency, alerts]);

  useEffect(() => {
    const getKlineParams = (tf: Timeframe) => {
      switch (tf) {
        case "24h": return { interval: "15", limit: 96 };
        case "1w": return { interval: "60", limit: 168 };
        case "1m": return { interval: "240", limit: 180 };
        case "1y": return { interval: "D", limit: 365 };
        default: return { interval: "15", limit: 96 };
      }
    };

    const fetchHistory = async (tf: Timeframe): Promise<number[]> => {
      /*
      if (useManualPrice[currentSymbol]) {
        const { limit } = getKlineParams(tf);
        return new Array(limit).fill(manualPrices[currentSymbol] || 0);
      }
      */
      try {
        const { interval, limit } = getKlineParams(tf);
        const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
        const category = currency === "USD" ? "inverse" : "spot";
        const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${interval}&limit=${limit}&t=${Date.now()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.retCode === 0 && data.result?.list) {
          return data.result.list.map((item: string[]) => parseFloat(item[4])).reverse();
        }
      } catch (err) {
        console.error(`Error fetching history for ${tf}:`, err);
      }
      return [];
    };

    const fetchData = async () => {
      /*
      // 1. If current symbol is manual, just update UI and fetch history (flat line)
      if (useManualPrice[currentSymbol]) {
        const newPrice = manualPrices[currentSymbol];
        setPriceUsd(newPrice);
        setError(null);
        const tfs: Timeframe[] = ["24h", "1w", "1m", "1y"];
        for (const tf of tfs) allChartData.current[tf] = await fetchHistory(tf);
        setChange24h(0); setChange1w(0); setChange1m(0); setChange1y(0);
        setDataUpdatedCounter(prev => prev + 1);
        return;
      }
      */

      try {
        const symbol = currency === "USD" ? `${currentSymbol}USD` : `${currentSymbol}${currency}`;
        const category = currency === "USD" ? "inverse" : "spot";
        
        if ((!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
          const url = `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}&t=${Date.now()}`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.retCode === 0 && data.result?.list?.[0]) {
            const newPrice = parseFloat(data.result.list[0].lastPrice);
            setPriceUsd(newPrice);
            if (data.result.list[0].price24hPcnt) {
              setChange24h(parseFloat(data.result.list[0].price24hPcnt) * 100);
            }
            setError(null);
          } else {
            throw new Error("Error loading price");
          }
        }
      } catch (err) {
        if (!priceUsd) setError("No connection to Bybit API, trying again");
      }

      const tfs: Timeframe[] = ["24h", "1w", "1m", "1y"];
      
      // Fetch all history in parallel for better performance
      const historyResults = await Promise.all(
        tfs.map(async (tf) => {
          const prices = await fetchHistory(tf);
          return { tf, prices };
        })
      );

      // Update state and refs
      historyResults.forEach(({ tf, prices }) => {
        allChartData.current[tf] = prices;
        const change = calculatePercentageChange(prices);
        switch (tf) {
          case "24h": setChange24h(change); break;
          case "1w": setChange1w(change); break;
          case "1m": setChange1m(change); break;
          case "1y": setChange1y(change); break;
        }
      });
      
      setDataUpdatedCounter(prev => prev + 1);
    };

    fetchData();
    // Reduce history polling interval since price is now real-time via WS
    const interval = setInterval(fetchData, Math.max(refreshInterval, 30000));
    return () => clearInterval(interval);
  }, [currency, currentSymbol, refreshInterval]);

  useEffect(() => {
    setChartData(allChartData.current[timeframe]);
  }, [timeframe, dataUpdatedCounter]);



  const currentChange = useMemo(() => {
    switch (timeframe) {
      case "24h": return change24h;
      case "1w": return change1w;
      case "1m": return change1m;
      case "1y": return change1y;
      default: return change24h;
    }
  }, [timeframe, change24h, change1w, change1m, change1y]);

  const chartColor = useMemo(() => {
    if (theme === 'anime') return currentChange && currentChange >= 0 ? "#ff85b3" : "#a18cd1";
    if (theme === 'billionaire') return currentChange && currentChange >= 0 ? "#ffd700" : "#b8860b";
    if (theme === 'dragon') return currentChange && currentChange >= 0 ? "#ffd700" : "#ff8f00";
    return currentChange && currentChange >= 0 ? "#22c55e" : "#ef4444";
  }, [theme, currentChange]);

  return (
    <div className={`app ${theme}`} style={{ position: 'relative', opacity }} onContextMenu={(e) => { e.preventDefault(); if (isTauri()) invoke("show_context_menu"); }} data-tauri-drag-region>
      <AdBanner theme={theme} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.6 }} data-tauri-drag-region>
        <PriceChart data={chartData} color={chartColor} />
      </div>
      <div className="titlebar" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        <div style={{ pointerEvents: 'auto' }}>
          <button className="settings-button" onClick={(e) => { e.stopPropagation(); openSettings(); }} title={t("Settings")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
        <span className="title" data-tauri-drag-region>{t("Chibi Sats")}</span>
        <div style={{ pointerEvents: 'auto' }}>
          <button className="minimize-button" onClick={(e) => { e.stopPropagation(); if (isTauri()) invoke("hide_window"); }} title={t("Minimize")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
      <div className="content" style={{ position: 'relative', zIndex: 1 }} data-tauri-drag-region>
        {priceUsd === null && !error && <div>{t("Loading...")}</div>}
        {priceUsd === null && error && <div className="error">{t(error)}</div>}
        {priceUsd !== null && (
          <div className="price" data-tauri-drag-region>
            <div data-tauri-drag-region>
              {currentSymbol}: <span className="price-value" data-tauri-drag-region>{formatPrice(priceUsd, currency, currencySymbols)}</span>
            </div>
            {currentChange !== null && (
              <div className={`change ${currentChange >= 0 ? "up" : "down"}`} data-tauri-drag-region>
                <div data-tauri-drag-region>
                  {currentChange >= 0 ? "▲" : "▼"} {currentChange >= 0 ? "+" : ""}{currentChange.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`timeframe-wheel-container ${currentChange && currentChange >= 0 ? 'up' : 'down'}`} onClick={handleTimeframeClick} style={{ position: 'relative', zIndex: 1 }}>
        <div className="timeframe-wheel">
          {getTimeframeWheel().map((tf, index) => (
            <div key={tf} className={`timeframe-item ${index === 1 ? 'active' : ''}`}>{t(tf)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  // Synchronous check for window type
  const isSettings = useMemo(() => {
    // 1. Check URL parameters (most reliable for direct opening)
    if (window.location.search.includes("window=settings")) return true;
    if (window.location.search.includes("window=settings_alt")) return true;
    
    // 2. Check window name (Tauri often sets this to the label)
    if (window.name === "settings") return true;
    if (window.name === "settings_alt") return true;

    // 3. Check Tauri metadata if available
    const tauriMetadata = (window as any).__TAURI_METADATA__;
    if (tauriMetadata?.windowLabel === "settings") return true;
    if (tauriMetadata?.windowLabel === "settings_alt") return true;

    return false;
  }, []);

  return isSettings ? <SettingsWindow /> : (window.location.search.includes("window=about") ? <AboutWindow /> : <MainWindow />);
}

function AboutWindow() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // CRITICAL: Show window only after React has finished first render
    if (isTauri()) {
      setTimeout(() => {
        invoke("show_window").catch(console.error);
      }, 150);
    }
  }, []);

  const openExternal = (url: string) => {
    if (isTauri()) {
      invoke('open_external_url', { url });
    } else {
      window.open(url, '_blank');
    }
  };

  const isRu = i18n.language.startsWith('ru');

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#f0f2f5',
      color: '#1c1e21',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      margin: 0,
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '340px',
        width: '100%'
      }}>
        <h1 style={{ fontSize: '22px', marginBottom: '20px', color: '#000' }}>
          {isRu ? 'Об авторе' : 'About Developer'}
        </h1>
        <p style={{ fontSize: '15px', lineHeight: '1.6', margin: '10px 0' }}>
          {isRu ? 'Автор' : 'Author'}: <strong>{isRu ? 'Василий Непытаев' : 'Vasily Nepytaev'}</strong>
        </p>
        <p style={{ fontSize: '15px', lineHeight: '1.6', margin: '10px 0' }}>
          {isRu ? 'Год создания' : 'Year of creation'}: <strong>2026</strong>
        </p>
        <div style={{ marginTop: '15px' }}>
          <p style={{ margin: '10px 0' }}>{isRu ? 'Контакты' : 'Contacts'}:</p>
          <div style={{ display: 'block', margin: '5px 0', color: '#1c1e21' }}>
            <span>Telegram: </span>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); openExternal('https://t.me/Newpepol'); }}
              style={{ color: '#0066cc', fontWeight: 'bold', textDecoration: 'none' }}
            >
              @Newpepol
            </a>
          </div>
          <div style={{ display: 'block', margin: '5px 0', color: '#1c1e21' }}>
            <span>Email: </span>
            <span style={{ fontWeight: 'bold', userSelect: 'all' }}>karta.hai@yandex.ru</span>
          </div>
        </div>
        <button 
          onClick={() => { if (isTauri()) invoke('close_window'); }}
          style={{
            marginTop: '25px',
            padding: '8px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {isRu ? 'Закрыть' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export default App;
