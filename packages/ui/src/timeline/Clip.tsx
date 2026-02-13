import { useClip, useEngine } from '@timeline/react';
import { frame, type Frame } from '@timeline/core';
import { 
  findSnapTargets, 
  calculateSnapExcluding,
  type SnapResult 
} from '@timeline/core/internal';
import { useState, useRef, useEffect } from 'react';

type DragMode = 'move' | 'resize-left' | 'resize-right';

interface ClipProps {
  clipId: string;
  trackId: string;
  pixelsPerFrame: number;
  snappingEnabled?: boolean;
  editingMode?: 'normal' | 'ripple' | 'insert';
  onSnapIndicator?: (frame: Frame | null) => void;
  playhead?: Frame;
  className?: string;
  onDragStart?: (clipId: string) => void;
  onDrag?: (clipId: string, deltaFrames: number) => void;
  onDragEnd?: (clipId: string) => void;
  isSelected?: boolean;
  onClipClick?: (clipId: string, multiSelect: boolean) => void;
  isLocked?: boolean;
  onRequestTrackAtY?: (clientY: number, clipId: string) => { trackId: string; valid: boolean } | null;
}

export function Clip({
  clipId,
  trackId,
  pixelsPerFrame,
  snappingEnabled = false,
  editingMode = 'normal',
  onSnapIndicator,
  playhead,
  className = '',
  onDragStart,
  onDrag,
  onDragEnd,
  isSelected = false,
  onClipClick,
  isLocked = false,
  onRequestTrackAtY,
}: ClipProps) {
  const clip = useClip(clipId);
  const engine = useEngine();
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>('move');
  const [targetTrackInfo, setTargetTrackInfo] = useState<{ trackId: string; valid: boolean } | null>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartFrame = useRef<Frame>(frame(0));
  const dragStartEnd = useRef<Frame>(frame(0));
  const dragStartTrackId = useRef<string>('');

  if (!clip) {
    return null;
  }

  const width = (clip.timelineEnd - clip.timelineStart) * pixelsPerFrame;
  const left = clip.timelineStart * pixelsPerFrame;

  const applySnapping = (proposedFrame: Frame): Frame => {
    if (!snappingEnabled) {
      onSnapIndicator?.(null);
      return proposedFrame;
    }

    const state = engine.getState();
    const targets = findSnapTargets(state, playhead);
    const snapResult = calculateSnapExcluding(
      proposedFrame,
      targets,
      frame(5), // 5 frame snap threshold
      [clipId]
    );

    if (snapResult.snapped) {
      onSnapIndicator?.(snapResult.snappedFrame);
      return snapResult.snappedFrame;
    } else {
      onSnapIndicator?.(null);
      return proposedFrame;
    }
  };

  const handleMouseDown = (e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent dragging/resizing if track is locked
    if (isLocked) {
      return;
    }
    
    // Handle selection on click
    if (mode === 'move') {
      onClipClick?.(clipId, e.shiftKey || e.metaKey || e.ctrlKey);
    }
    
    setIsDragging(true);
    setDragMode(mode);
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragStartFrame.current = clip.timelineStart;
    dragStartEnd.current = clip.timelineEnd;
    dragStartTrackId.current = trackId;
    onDragStart?.(clipId);
  };

  useEffect(() => {
    if (!isDragging) return;

    let lastValidStart = dragStartFrame.current;
    let lastValidEnd = dragStartEnd.current;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      const deltaY = e.clientY - dragStartY.current;
      const deltaFrames = Math.round(deltaX / pixelsPerFrame);
      
      try {
        if (dragMode === 'resize-left') {
          // Resize from left: adjust timelineStart
          const proposedStart = frame(dragStartFrame.current + deltaFrames);
          const snappedStart = applySnapping(proposedStart);
          
          // Only update if different from last valid state
          if (snappedStart !== lastValidStart) {
            engine.resizeClip(clipId, snappedStart, clip.timelineEnd);
            lastValidStart = snappedStart;
          }
        } else if (dragMode === 'resize-right') {
          // Resize from right: adjust timelineEnd
          const proposedEnd = frame(dragStartEnd.current + deltaFrames);
          const snappedEnd = applySnapping(proposedEnd);
          
          // Only update if different from last valid state
          if (snappedEnd !== lastValidEnd) {
            engine.resizeClip(clipId, clip.timelineStart, snappedEnd);
            lastValidEnd = snappedEnd;
          }
        } else {
          // Move clip - check for vertical movement
          const isVerticalDrag = Math.abs(deltaY) > 10; // Threshold for vertical drag
          
          if (isVerticalDrag && onRequestTrackAtY) {
            // Vertical drag - check target track
            const trackInfo = onRequestTrackAtY(e.clientY, clipId);
            setTargetTrackInfo(trackInfo);
            
            // Don't perform horizontal movement during vertical drag
            return;
          } else {
            // Horizontal drag only
            setTargetTrackInfo(null);
            
            const proposedStart = frame(dragStartFrame.current + deltaFrames);
            const snappedStart = applySnapping(proposedStart);
            
            // Only update if different from last valid state
            if (snappedStart !== lastValidStart) {
              onDrag?.(clipId, snappedStart - dragStartFrame.current);
              
              // Use appropriate move method based on editing mode
              if (editingMode === 'normal') {
                engine.moveClip(clipId, snappedStart);
              }
              // TODO: Implement ripple and insert modes when engine methods are available
              
              lastValidStart = snappedStart;
            }
          }
        }
      } catch (error) {
        // Validation error - clip can't be moved/resized there
        console.warn('Cannot perform operation:', error);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Check if we were doing a vertical drag
      const deltaY = e.clientY - dragStartY.current;
      const isVerticalDrag = Math.abs(deltaY) > 10;
      
      if (isVerticalDrag && dragMode === 'move' && onRequestTrackAtY) {
        const trackInfo = onRequestTrackAtY(e.clientY, clipId);
        
        if (trackInfo && trackInfo.valid && trackInfo.trackId !== dragStartTrackId.current) {
          // Attempt to move clip to new track
          const result = engine.moveClipToTrack(clipId, trackInfo.trackId);
          
          if (!result.success) {
            console.warn('Failed to move clip to track:', result.errors);
          }
        }
      }
      
      setIsDragging(false);
      setTargetTrackInfo(null);
      onSnapIndicator?.(null);
      onDragEnd?.(clipId);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, clipId, pixelsPerFrame, clip, engine, snappingEnabled, editingMode, playhead, onDrag, onDragEnd, onSnapIndicator, isLocked, onRequestTrackAtY]);

  return (
    <div
      className={`absolute top-1 h-12 border rounded select-none transition-opacity ${
        isDragging ? 'opacity-50' : ''
      } ${
        targetTrackInfo && !targetTrackInfo.valid
          ? 'bg-red-600 border-red-500 ring-2 ring-red-400'
          : isSelected 
            ? 'bg-blue-500 border-blue-400 ring-2 ring-blue-300' 
            : 'bg-blue-600 border-blue-500'
      } ${
        isLocked ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        isDragging && dragMode === 'move' ? 'cursor-grabbing' : ''
      } ${className}`}
      style={{ left, width: Math.max(width, 8) }} // Minimum 8px width for visibility
    >
      {/* Left resize handle */}
      {!isLocked && (
        <div
          className="absolute left-0 top-0 w-2 h-full bg-blue-300 hover:bg-blue-200 cursor-ew-resize z-10"
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
          title="Resize left"
        >
          {/* Larger hit area */}
          <div className="absolute -left-1 top-0 w-4 h-full" />
        </div>
      )}

      {/* Clip content */}
      <div
        className={`absolute inset-0 px-2 py-1 ${
          isLocked ? 'cursor-not-allowed' : isDragging && dragMode === 'move' ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <div className="text-xs text-white truncate">
          Clip {clipId.slice(0, 8)}
        </div>
      </div>

      {/* Right resize handle */}
      {!isLocked && (
        <div
          className="absolute right-0 top-0 w-2 h-full bg-blue-300 hover:bg-blue-200 cursor-ew-resize z-10"
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
          title="Resize right"
        >
          {/* Larger hit area */}
          <div className="absolute -right-1 top-0 w-4 h-full" />
        </div>
      )}
    </div>
  );
}
