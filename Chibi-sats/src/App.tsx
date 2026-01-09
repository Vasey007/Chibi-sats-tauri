import { useState, useEffect } from "react";
import "./App.css";
import PriceChart from "./PriceChart";

const REFRESH_INTERVAL_MS = 5000;

function App() {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
        );
        
        if (!response.ok) {
          throw new Error("Ошибка загрузки цены");
        }

        const data = await response.json();
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const item = data.result.list[0];
          setPriceUsd(parseFloat(item.lastPrice));
          setChange24h(parseFloat(item.price24hPcnt) * 100);
          setError(null);
        } else {
          throw new Error("Ошибка загрузки цены");
        }
      } catch (err) {
        // При ошибке не сбрасываем priceUsd и change24h, оставляем последнюю успешную цену
        const errorMessage = "Нет связи с API Bybit, попробую ещё раз";
        setError(errorMessage);
        console.error("Error fetching price from Bybit:", err);
      }
    };

    const fetchHistory = async () => {
      try {
        // Fetch last 24h data (interval 15min = 96 points)
        const response = await fetch(
          "https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=96"
        );
        if (!response.ok) return;
        const data = await response.json();
        if (data.retCode === 0 && data.result && data.result.list) {
          // List is [timestamp, open, high, low, close, volume, turnover]
          // We need close price (index 4)
          // Data comes newest first, so we reverse it
          const prices = data.result.list
            .map((item: string[]) => parseFloat(item[4]))
            .reverse();
          setChartData(prices);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };

    // Первый запрос сразу
    fetchPrice();
    fetchHistory();

    // Повторяем каждые 5 секунд
    const interval = setInterval(() => {
        fetchPrice();
        // Fetch history less frequently, e.g. every minute? 
        // Or just every 5s is fine for simplicity given the small data size
        fetchHistory();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.6 }}>
        <PriceChart data={chartData} color={change24h && change24h >= 0 ? "#22c55e" : "#ef4444"} />
      </div>
      <div className="titlebar" style={{ position: 'relative', zIndex: 1 }}>
        <span className="title">Chibi Sats</span>
      </div>
      <div className="content" style={{ position: 'relative', zIndex: 1 }}>
        {priceUsd === null && !error && <div>Загрузка...</div>}
        {priceUsd === null && error && <div className="error">{error}</div>}
        {priceUsd !== null && (
          <div className="price">
            <div>
              BTC: <span className="price-value">${priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
            {change24h !== null && (
              <div className={`change ${change24h >= 0 ? "up" : "down"}`}>
                {change24h >= 0 ? "▲" : "▼"} {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}% 24h
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
