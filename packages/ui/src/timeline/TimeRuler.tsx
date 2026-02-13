import { frame, type Frame, type FrameRate } from '@timeline/core';

interface TimeRulerProps {
  duration: Frame;
  fps: FrameRate;
  pixelsPerFrame: number;
  className?: string;
  onRulerClick?: (frame: Frame) => void;
}

export function TimeRuler({ duration, fps, pixelsPerFrame, className = '', onRulerClick }: TimeRulerProps) {
  const totalWidth = duration * pixelsPerFrame;
  
  // Calculate tick interval based on zoom level
  const getTickInterval = (): number => {
    if (pixelsPerFrame >= 2) return fps; // Every second when zoomed in
    if (pixelsPerFrame >= 0.5) return fps * 5; // Every 5 seconds
    return fps * 10; // Every 10 seconds when zoomed out
  };

  const tickInterval = getTickInterval();
  const ticks: number[] = [];
  
  for (let f = 0; f <= duration; f += tickInterval) {
    ticks.push(f);
  }

  const formatTime = (f: number): string => {
    const totalSeconds = Math.floor(f / fps);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle click to move playhead
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onRulerClick) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedFrame = frame(Math.round(clickX / pixelsPerFrame));
    
    // Clamp to valid range
    const clampedFrame = frame(Math.max(0, Math.min(duration, clickedFrame)));
    onRulerClick(clampedFrame);
  };

  return (
    <div className={`flex bg-zinc-900 border-b border-zinc-700 ${className}`}>
      {/* Left spacer to align with track labels */}
      <div className="w-32 h-8 bg-zinc-800 border-r border-zinc-700 flex-shrink-0" />
      
      {/* Time ruler content */}
      <div 
        className="relative h-8 bg-zinc-900 overflow-hidden flex-1"
        style={{ width: totalWidth, minWidth: totalWidth }}
        onClick={handleClick}
      >
        {ticks.map((f) => (
          <div
            key={f}
            className="absolute top-0 h-full border-l border-zinc-600 pointer-events-none"
            style={{ left: f * pixelsPerFrame }}
          >
            <span className="absolute top-1 left-1 text-xs text-zinc-400 whitespace-nowrap">
              {formatTime(f)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
