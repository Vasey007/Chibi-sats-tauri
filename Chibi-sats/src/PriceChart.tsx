import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, AreaData } from "lightweight-charts";

interface PriceChartProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function PriceChart({ containerRef }: PriceChartProps) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Генерируем мок-данные: 30 точек
    const mockData: AreaData[] = [];
    const basePrice = 95000;
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 0; i < 30; i++) {
      const time = (now - (29 - i) * 3600) as any; // последние 30 часов
      const variation = (Math.random() - 0.5) * 2000; // случайное отклонение ±1000
      const value = basePrice + variation;
      mockData.push({ time, value });
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: {
          type: "solid",
          color: "transparent",
        },
        textColor: "#ffffff",
      },
      grid: {
        vertLines: {
          visible: false,
        },
        horzLines: {
          visible: false,
        },
      },
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: "#f7931a",
      topColor: "rgba(247, 147, 26, 0.3)",
      bottomColor: "rgba(247, 147, 26, 0.0)",
      lineWidth: 2,
    });

    areaSeries.setData(mockData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [containerRef]);

  return null;
}
