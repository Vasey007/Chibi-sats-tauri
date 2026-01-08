import { useState, useEffect } from "react";
import "./App.css";

const REFRESH_INTERVAL_MS = 5000;

function App() {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
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

    // Первый запрос сразу
    fetchPrice();

    // Повторяем каждые 5 секунд
    const interval = setInterval(fetchPrice, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <div className="titlebar">
        <span className="title">Chibi Sats</span>
      </div>
      <div className="content">
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
