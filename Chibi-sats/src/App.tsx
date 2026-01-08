import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
        );
        
        if (!response.ok) {
          throw new Error("Ошибка загрузки цены");
        }

        const data = await response.json();
        
        if (data.bitcoin) {
          setPriceUsd(data.bitcoin.usd);
          setChange24h(data.bitcoin.usd_24h_change);
          setError(null);
        } else {
          throw new Error("Ошибка загрузки цены");
        }
      } catch (err) {
        // При ошибке не сбрасываем priceUsd и change24h, оставляем последнюю успешную цену
        setError("Нет связи с API, попробую ещё раз");
      }
    };

    // Первый запрос сразу
    fetchPrice();

    // Повторяем каждые 15 секунд
    const interval = setInterval(fetchPrice, 15000);

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
