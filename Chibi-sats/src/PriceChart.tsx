import { useMemo } from "react";
import { calculateSvgPaths } from "./utils";

interface PriceChartProps {
  data: number[];
  color?: string;
}

export default function PriceChart({ data, color = "#f7931a" }: PriceChartProps) {
  const { pathD, areaD } = useMemo(() => calculateSvgPaths(data), [data]);

  if (!data || data.length < 2) return null;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none" 
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#chartGradient)" stroke="none" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
