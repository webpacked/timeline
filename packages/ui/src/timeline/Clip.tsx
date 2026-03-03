import { useClip, useEngine } from '@timeline/react';
import { frame, type Frame } from '@timeline/core';
import { 
  findSnapTargets, 
  calculateSnapExcluding,
  type SnapResult 
} from '@timeline/core/internal';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

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

  // Get asset information for display - memoized to avoid recalculation on every render
  const asset = useMemo(() => engine.getAsset(clip.assetId), [engine, clip.assetId]);
  
  /**
   * Extract display name from asset source URL
   * 
   * Handles:
   * - URLs with query strings: https://cdn.com/video.mp4?token=abc
   * - URLs with fragments: file:///path/video.mp4#t=10
   * - File paths (Unix): /path/to/video.mp4
   * - File paths (Windows): C:\Users\Videos\video.mp4
   * - URLs without filenames: https://api.example.com/stream/123
   * - Dotfiles: .gitignore
   * 
   * @returns Display name for the asset
   */
  const getAssetDisplayName = useCallback((): string => {
    if (!asset) {
      console.warn(`Asset not found for clip ${clipId}`);
      return `Clip ${clipId.slice(0, 8)}`;
    }
    
    try {
      // Try to parse as URL first
      const url = new URL(asset.sourceUrl);
      const pathname = url.pathname;
      
      // Extract filename from pathname
      const segments = pathname.split('/').filter(Boolean);
      const filename = segments[segments.length - 1] || '';
      
      if (filename) {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        return nameWithoutExt || filename;
      }
      
      // No filename in URL, use asset type as fallback
      return asset.type.toUpperCase();
      
    } catch {
      // Not a valid URL, treat as file path
      // Handle both Unix (/) and Windows (\) path separators
      const parts = asset.sourceUrl.split(/[/\\]/).filter(Boolean);
      const filename = parts[parts.length - 1] || '';
      
      if (filename) {
        // Remove file extension
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        // Handle dotfiles (e.g., .gitignore -> show full name)
        return nameWithoutExt || filename;
      }
      
      // Fallback to asset type if no recognizable filename
      return asset.type.toUpperCase();
    }
  }, [asset, clipId]);
  
  /**
   * Get icon emoji based on asset type
   * 
   * @returns Emoji representing the asset type
   */
  const getAssetTypeIcon = useCallback((): string => {
    if (!asset) return '📄';
    
    switch (asset.type) {
      case 'video':
        return '🎬';
      case 'audio':
        return '🎵';
      case 'image':
        return '🖼️';
      default:
        return '📄';
    }
  }, [asset]);

  // Memoize visual calculations to avoid recalculation on every render
  const width = useMemo(
    () => (clip.timelineEnd - clip.timelineStart) * pixelsPerFrame,
    [clip.timelineStart, clip.timelineEnd, pixelsPerFrame]
  );
  
  const left = useMemo(
    () => clip.timelineStart * pixelsPerFrame,
    [clip.timelineStart, pixelsPerFrame]
  );

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
    let rafId: number | null = null;

    const performDragOperation = (e: MouseEvent) => {
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
              } else if (editingMode === 'ripple') {
                // Use core rippleMove operation for atomic transaction
                engine.rippleMove(clipId, snappedStart);
              } else if (editingMode === 'insert') {
                // Use core insertMove operation for atomic transaction
                engine.insertMove(clipId, snappedStart);
              }
              
              lastValidStart = snappedStart;
            }
          }
        }
      } catch (error) {
        // Validation error - clip can't be moved/resized there
        console.warn('Cannot perform operation:', error);
      }
      
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle with requestAnimationFrame to prevent excessive updates
      if (rafId === null) {
        rafId = requestAnimationFrame(() => performDragOperation(e));
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
      
      // Cancel any pending RAF to prevent memory leaks
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
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
        className={`absolute inset-0 px-2 py-1 overflow-hidden ${
          isLocked ? 'cursor-not-allowed' : isDragging && dragMode === 'move' ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        <div className="flex items-center gap-1 h-full">
          <span className="text-sm" title={asset?.type || 'Unknown type'}>
            {getAssetTypeIcon()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white truncate font-medium" title={getAssetDisplayName()}>
              {getAssetDisplayName()}
            </div>
            {asset && width > 80 && (
              <div className="text-[10px] text-blue-200 truncate">
                {asset.type} • {clip.timelineEnd - clip.timelineStart}f
              </div>
            )}
          </div>
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
