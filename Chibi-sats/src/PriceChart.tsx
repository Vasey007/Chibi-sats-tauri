import { useMemo } from "react";

interface PriceChartProps {
  data: number[];
  color?: string;
}

export default function PriceChart({ data, color = "#f7931a" }: PriceChartProps) {
  const { pathD, areaD } = useMemo(() => {
    if (!data || data.length < 2) return { pathD: "", areaD: "" };
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    
    // SVG coordinate space: 0,0 is top-left.
    // We map index to x (0..100) and value to y (100..0).
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      let y;
      
      if (range === 0) {
        // If all values are the same, center the line vertically
        y = 50;
      } else {
        // Normalize value: (value - min) / range -> 0..1
        const normalizedY = (value - min) / range;
        // Use 10% padding top and bottom for better visibility
        y = 90 - (normalizedY * 80); 
      }
      
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    let d = `M ${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i]}`;
    }
    
    const area = `${d} L 100,100 L 0,100 Z`;
    
    return { pathD: d, areaD: area };
  }, [data]);

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
