import { useState, useRef, useCallback } from 'react';
import { EditParams } from '../../types/editor';
import { PanelSection } from '../UI/PanelSection';

interface Props {
  params: EditParams;
  onChange: (params: EditParams) => void;
}

type Channel = 'rgb' | 'red' | 'green' | 'blue';

const CHANNEL_COLORS: Record<Channel, string> = {
  rgb: '#ffffff',
  red: '#ff6666',
  green: '#66ff66',
  blue: '#6688ff',
};

const CHANNEL_LABELS: Record<Channel, string> = {
  rgb: 'RGB',
  red: 'R',
  green: 'G',
  blue: 'B',
};

const SVG_SIZE = 200;
const PADDING = 8;
const POINT_RADIUS = 5;

export function ToneCurvePanel({ params, onChange }: Props) {
  const [channel, setChannel] = useState<Channel>('rgb');
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = params.toneCurve[channel];

  const toSvg = (p: { x: number; y: number }) => ({
    sx: PADDING + (p.x / 255) * (SVG_SIZE - 2 * PADDING),
    sy: PADDING + ((255 - p.y) / 255) * (SVG_SIZE - 2 * PADDING),
  });

  const fromSvg = (sx: number, sy: number) => ({
    x: Math.round(Math.max(0, Math.min(255, ((sx - PADDING) / (SVG_SIZE - 2 * PADDING)) * 255))),
    y: Math.round(Math.max(0, Math.min(255, (1 - (sy - PADDING) / (SVG_SIZE - 2 * PADDING)) * 255))),
  });

  const updatePoints = useCallback((newPoints: Array<{ x: number; y: number }>) => {
    onChange({
      ...params,
      toneCurve: { ...params.toneCurve, [channel]: newPoints },
    });
  }, [params, onChange, channel]);

  const getSvgCoords = (e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    // Don't allow dragging the first and last points' x position (they are anchored)
    setDragging(index);

    const handleMove = (me: MouseEvent) => {
      const { x, y } = getSvgCoords(me);
      const newPt = fromSvg(x, y);
      const newPoints = [...points];

      if (index === 0) {
        newPoints[index] = { x: 0, y: newPt.y };
      } else if (index === points.length - 1) {
        newPoints[index] = { x: 255, y: newPt.y };
      } else {
        // Constrain x between neighbors
        const minX = newPoints[index - 1].x + 1;
        const maxX = newPoints[index + 1].x - 1;
        newPoints[index] = {
          x: Math.max(minX, Math.min(maxX, newPt.x)),
          y: newPt.y,
        };
      }
      updatePoints(newPoints);
    };

    const handleUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getSvgCoords(e);
    const newPt = fromSvg(x, y);

    // Check if clicking near an existing point (to remove it)
    for (let i = 1; i < points.length - 1; i++) {
      const { sx, sy } = toSvg(points[i]);
      if (Math.hypot(x - sx, y - sy) < POINT_RADIUS * 2) {
        const newPoints = points.filter((_, idx) => idx !== i);
        updatePoints(newPoints);
        return;
      }
    }

    // Add new point
    const newPoints = [...points, newPt].sort((a, b) => a.x - b.x);
    if (newPoints.length <= 10) {
      updatePoints(newPoints);
    }
  };

  const handleReset = () => {
    updatePoints([{ x: 0, y: 0 }, { x: 255, y: 255 }]);
  };

  // Generate smooth path
  const pathD = points.length >= 2
    ? points.map((p, i) => {
        const { sx, sy } = toSvg(p);
        return i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
      }).join(' ')
    : '';

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map(f => PADDING + f * (SVG_SIZE - 2 * PADDING));

  return (
    <PanelSection title="톤커브" defaultOpen={false}>
      {/* Channel selector */}
      <div className="flex gap-1 mb-2">
        {(Object.keys(CHANNEL_LABELS) as Channel[]).map(ch => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`flex-1 text-[10px] py-0.5 rounded transition-colors ${
              channel === ch
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>

      {/* Curve SVG */}
      <div className="bg-black rounded overflow-hidden">
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          className="w-full h-auto cursor-crosshair"
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          onDoubleClick={handleDoubleClick}
        >
          {/* Grid */}
          {gridLines.map((pos, i) => (
            <g key={i}>
              <line x1={pos} y1={PADDING} x2={pos} y2={SVG_SIZE - PADDING} stroke="#333" strokeWidth="0.5" />
              <line x1={PADDING} y1={pos} x2={SVG_SIZE - PADDING} y2={pos} stroke="#333" strokeWidth="0.5" />
            </g>
          ))}
          {/* Diagonal (identity) */}
          <line
            x1={PADDING} y1={SVG_SIZE - PADDING}
            x2={SVG_SIZE - PADDING} y2={PADDING}
            stroke="#444" strokeWidth="1" strokeDasharray="3,3"
          />
          {/* Curve */}
          <path d={pathD} fill="none" stroke={CHANNEL_COLORS[channel]} strokeWidth="2" />
          {/* Control points */}
          {points.map((p, i) => {
            const { sx, sy } = toSvg(p);
            return (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={POINT_RADIUS}
                fill={dragging === i ? CHANNEL_COLORS[channel] : '#000'}
                stroke={CHANNEL_COLORS[channel]}
                strokeWidth="1.5"
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={e => handleMouseDown(e, i)}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-text-secondary">더블클릭: 포인트 추가/삭제</span>
        <button
          onClick={handleReset}
          className="text-[9px] text-text-secondary hover:text-accent transition-colors"
        >
          초기화
        </button>
      </div>
    </PanelSection>
  );
}
