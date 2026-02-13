import { useTrack, useEngine } from '@timeline/react';
import { Clip } from './Clip';
import type { Frame } from '@timeline/core';
import { useState, useEffect } from 'react';

interface TrackProps {
  trackId: string;
  pixelsPerFrame: number;
  snappingEnabled?: boolean;
  editingMode?: 'normal' | 'ripple' | 'insert';
  onSnapIndicator?: (frame: Frame | null) => void;
  playhead?: Frame;
  className?: string;
  selectedClipIds?: Set<string>;
  onClipClick?: (clipId: string, multiSelect: boolean) => void;
  onRequestTrackAtY?: (clientY: number, clipId: string) => { trackId: string; valid: boolean } | null;
}

export function Track({ 
  trackId, 
  pixelsPerFrame, 
  snappingEnabled,
  editingMode,
  onSnapIndicator,
  playhead,
  className = '',
  selectedClipIds = new Set(),
  onClipClick,
  onRequestTrackAtY,
}: TrackProps) {
  const track = useTrack(trackId);
  const engine = useEngine();
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);

  if (!track) {
    return null;
  }

  const handleToggleMute = () => {
    engine.toggleTrackMute(trackId);
  };

  const handleToggleLock = () => {
    engine.toggleTrackLock(trackId);
  };

  const handleToggleSolo = () => {
    engine.toggleTrackSolo(trackId);
  };

  const handleDeleteTrack = () => {
    if (window.confirm(`Delete track "${track.name}"?`)) {
      engine.removeTrack(trackId);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setStartY(e.clientY);
    setStartHeight(track.height);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(40, Math.min(200, startHeight + deltaY));
      engine.setTrackHeight(trackId, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startY, startHeight, trackId, engine]);

  return (
    <div className={`relative ${className}`} data-track-id={trackId} style={{ height: track.height }}>
      {/* Track label */}
      <div className="absolute left-0 top-0 w-32 bg-zinc-800 border-r border-zinc-700 flex flex-col px-2 py-1" style={{ height: track.height }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-base" title={track.type === 'video' ? 'Video Track' : 'Audio Track'}>
              {track.type === 'video' ? '📹' : '🎵'}
            </span>
            <span className="text-sm text-zinc-300 truncate">{track.name}</span>
          </div>
          <button
            onClick={handleDeleteTrack}
            className="text-xs text-zinc-500 hover:text-red-400 ml-1"
            title="Delete track"
          >
            ×
          </button>
        </div>
        <div className="flex gap-1 mb-1">
          <button
            onClick={handleToggleMute}
            className={`text-xs px-2 py-0.5 rounded ${
              track.muted 
                ? 'bg-red-600 text-white' 
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            M
          </button>
          <button
            onClick={handleToggleSolo}
            className={`text-xs px-2 py-0.5 rounded ${
              track.solo 
                ? 'bg-green-600 text-white' 
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            title={track.solo ? 'Unsolo' : 'Solo'}
          >
            S
          </button>
          <button
            onClick={handleToggleLock}
            className={`text-xs px-2 py-0.5 rounded ${
              track.locked 
                ? 'bg-yellow-600 text-white' 
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            title={track.locked ? 'Unlock' : 'Lock'}
          >
            L
          </button>
        </div>
      </div>

      {/* Track content area */}
      <div className="ml-32 relative bg-zinc-900" style={{ height: track.height }}>
        {/* Background grid */}
        <div className="absolute inset-0 opacity-20">
          {/* Grid lines could go here if needed */}
        </div>

        {/* Clips */}
        {track.clips.map((clip) => (
          <Clip
            key={clip.id}
            clipId={clip.id}
            trackId={trackId}
            pixelsPerFrame={pixelsPerFrame}
            snappingEnabled={snappingEnabled}
            editingMode={editingMode}
            onSnapIndicator={onSnapIndicator}
            playhead={playhead}
            isSelected={selectedClipIds.has(clip.id)}
            onClipClick={onClipClick}
            isLocked={track.locked}
            onRequestTrackAtY={onRequestTrackAtY}
          />
        ))}
      </div>

      {/* Draggable resize handle at bottom */}
      <div 
        className={`absolute left-0 right-0 bottom-0 h-1 bg-zinc-600 cursor-ns-resize hover:bg-zinc-500 ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleResizeStart}
        style={{ height: '2px' }}
        title="Drag to resize track height"
      />
    </div>
  );
}
