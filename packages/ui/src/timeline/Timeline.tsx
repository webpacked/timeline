import { useTimeline, useEngine } from '@timeline/react';
import { TimeRuler } from './TimeRuler';
import { Track } from './Track';
import { frame, type Frame } from '@timeline/core';
import { useState, useEffect, useRef } from 'react';

interface TimelineProps {
  className?: string;
  onClipMove?: (clipId: string, newStart: Frame) => void;
  onClipResize?: (clipId: string, newStart: Frame, newEnd: Frame) => void;
}

export function Timeline({ className = '', onClipMove, onClipResize }: TimelineProps) {
  const { state } = useTimeline();
  const engine = useEngine();
  const [pixelsPerFrame, setPixelsPerFrame] = useState(1);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [editingMode, setEditingMode] = useState<'normal' | 'ripple' | 'insert'>('normal');
  const [snapIndicator, setSnapIndicator] = useState<Frame | null>(null);
  const [playhead, setPlayhead] = useState<Frame>(frame(0));
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [copiedClips, setCopiedClips] = useState<Array<{clipId: string, trackId: string}>>([]);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { timeline } = state;

  // Keyboard handler for playhead movement, clip selection, deletion, copy/paste, and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo work globally
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          engine.redo();
        } else {
          engine.undo();
        }
        return;
      }

      // Only handle other keys when timeline is focused
      if (!timelineRef.current?.contains(document.activeElement)) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          // Jump by 10 frames with Shift, 1 frame otherwise
          const leftAmount = e.shiftKey ? 10 : 1;
          setPlayhead(prev => frame(Math.max(0, prev - leftAmount)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Jump by 10 frames with Shift, 1 frame otherwise
          const rightAmount = e.shiftKey ? 10 : 1;
          setPlayhead(prev => frame(Math.min(timeline.duration, prev + rightAmount)));
          break;
        case 'Home':
          e.preventDefault();
          setPlayhead(frame(0));
          break;
        case 'End':
          e.preventDefault();
          setPlayhead(frame(timeline.duration));
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Delete selected clips (ripple mode if enabled)
          selectedClipIds.forEach(clipId => {
            try {
              if (editingMode === 'ripple') {
                engine.rippleDelete(clipId);
              } else {
                engine.removeClip(clipId);
              }
            } catch (error) {
              console.warn('Failed to delete clip:', error);
            }
          });
          setSelectedClipIds(new Set());
          break;
        case 'c':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Copy selected clips
            const clipsToCopy: Array<{clipId: string, trackId: string}> = [];
            selectedClipIds.forEach(clipId => {
              const clip = engine.findClipById(clipId);
              if (clip) {
                clipsToCopy.push({ clipId, trackId: clip.trackId });
              }
            });
            setCopiedClips(clipsToCopy);
          }
          break;
        case 'v':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Paste clips at playhead
            copiedClips.forEach(({ clipId, trackId }) => {
              try {
                const originalClip = engine.findClipById(clipId);
                if (originalClip) {
                  const duration = originalClip.timelineEnd - originalClip.timelineStart;
                  const newClip = {
                    ...originalClip,
                    id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timelineStart: playhead,
                    timelineEnd: frame(playhead + duration),
                  };
                  if (editingMode === 'insert') {
                    engine.insertEdit(trackId, newClip, playhead);
                  } else {
                    engine.addClip(trackId, newClip);
                  }
                }
              } catch (error) {
                console.warn('Failed to paste clip:', error);
              }
            });
          }
          break;
        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Select all clips
            const allClipIds = new Set<string>();
            state.timeline.tracks.forEach(track => {
              track.clips.forEach(clip => {
                allClipIds.add(clip.id);
              });
            });
            setSelectedClipIds(allClipIds);
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Deselect all
          setSelectedClipIds(new Set());
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          // Add marker at playhead
          {
            const marker = {
              id: `marker-${Date.now()}`,
              type: 'timeline' as const,
              frame: playhead,
              label: `Mark ${playhead}`,
              color: '#10b981',
            };
            engine.addTimelineMarker(marker);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [timeline.duration, selectedClipIds, copiedClips, playhead, engine, state.timeline.tracks]);

  // Handle TimeRuler click to move playhead
  const handleRulerClick = (clickedFrame: Frame) => {
    setPlayhead(clickedFrame);
  };

  // Handle playhead drag start
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
  };

  // Handle playhead drag
  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 128; // Offset by track label width
      const newFrame = Math.round(x / pixelsPerFrame);
      const clampedFrame = Math.max(0, Math.min(timeline.duration, newFrame));
      setPlayhead(frame(clampedFrame));
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, pixelsPerFrame, timeline.duration]);

  // Handle clip selection
  const handleClipClick = (clipId: string, multiSelect: boolean) => {
    if (multiSelect) {
      // Toggle selection
      setSelectedClipIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clipId)) {
          newSet.delete(clipId);
        } else {
          newSet.add(clipId);
        }
        return newSet;
      });
    } else {
      // Single selection
      setSelectedClipIds(new Set([clipId]));
    }
  };

  // Handle track lookup at Y position with validation
  const handleRequestTrackAtY = (clientY: number, clipId: string): { trackId: string; valid: boolean } | null => {
    if (!timelineRef.current) return null;

    // Find the clip to check its asset type
    const clip = engine.findClipById(clipId);
    if (!clip) return null;
    
    const asset = engine.getAsset(clip.assetId);
    if (!asset) return null;

    // Find all track elements
    const trackElements = timelineRef.current.querySelectorAll('[data-track-id]');
    
    for (const element of Array.from(trackElements)) {
      const rect = element.getBoundingClientRect();
      
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const targetTrackId = element.getAttribute('data-track-id');
        
        if (!targetTrackId) continue;
        
        const targetTrack = state.timeline.tracks.find(t => t.id === targetTrackId);
        
        if (!targetTrack) continue;
        
        // Validate track type match
        let valid = !targetTrack.locked;
        
        if (valid) {
          // Check type compatibility
          if (asset.type === 'video' && targetTrack.type !== 'video') {
            valid = false;
          } else if (asset.type === 'audio' && targetTrack.type !== 'audio') {
            valid = false;
          } else if (asset.type === 'image' && targetTrack.type !== 'video') {
            valid = false;
          }
        }
        
        return {
          trackId: targetTrackId,
          valid,
        };
      }
    }
    
    return null;
  };

  return (
    <div 
      ref={timelineRef}
      className={`flex flex-col h-full bg-zinc-950 ${className}`}
      tabIndex={0} // Make focusable for keyboard events
    >
      {/* Controls */}
      <div className="flex items-center gap-4 p-2 bg-zinc-900 border-b border-zinc-700">
        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => engine.undo()}
            disabled={!engine.canUndo()}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
          >
            ↶
          </button>
          <button
            onClick={() => engine.redo()}
            disabled={!engine.canRedo()}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
          >
            ↷
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Zoom:</span>
          <button
            onClick={() => setPixelsPerFrame((prev) => Math.max(0.1, prev - 0.5))}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
          >
            -
          </button>
          <span className="text-xs text-zinc-300 w-12 text-center">
            {pixelsPerFrame.toFixed(1)}x
          </span>
          <button
            onClick={() => setPixelsPerFrame((prev) => Math.min(10, prev + 0.5))}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
          >
            +
          </button>
        </div>

        {/* Snapping toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Snap:</span>
          <button
            onClick={() => setSnappingEnabled(!snappingEnabled)}
            className={`px-2 py-1 text-xs rounded ${
              snappingEnabled
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            {snappingEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Editing mode selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Mode:</span>
          <select
            value={editingMode}
            onChange={(e) => setEditingMode(e.target.value as 'normal' | 'ripple' | 'insert')}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700"
          >
            <option value="normal">Normal</option>
            <option value="ripple">Ripple</option>
            <option value="insert">Insert</option>
          </select>
          {editingMode === 'ripple' && (
            <span className="text-xs text-yellow-400" title="Ripple mode: Delete shifts subsequent clips">
              ⚡ Ripple
            </span>
          )}
          {editingMode === 'insert' && (
            <span className="text-xs text-blue-400" title="Insert mode: Paste shifts subsequent clips">
              ➕ Insert
            </span>
          )}
        </div>

        {/* Marker controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const marker = {
                id: `marker-${Date.now()}`,
                type: 'timeline' as const,
                frame: playhead,
                label: `Mark ${playhead}`,
                color: '#10b981',
              };
              engine.addTimelineMarker(marker);
            }}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
            title="Add marker at playhead (M)"
          >
            🚩 Marker
          </button>
          {state.workArea ? (
            <button
              onClick={() => engine.clearWorkArea()}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              title="Clear work area"
            >
              ✕ Work Area
            </button>
          ) : (
            <button
              onClick={() => {
                // Set work area around selected clips or use default range
                if (selectedClipIds.size > 0) {
                  let minStart = Infinity;
                  let maxEnd = -Infinity;
                  selectedClipIds.forEach(clipId => {
                    const clip = engine.findClipById(clipId);
                    if (clip) {
                      minStart = Math.min(minStart, clip.timelineStart);
                      maxEnd = Math.max(maxEnd, clip.timelineEnd);
                    }
                  });
                  if (minStart !== Infinity && maxEnd !== -Infinity) {
                    engine.setWorkArea(frame(minStart), frame(maxEnd));
                  }
                } else {
                  // Default: set work area around playhead
                  const start = Math.max(0, playhead - 50);
                  const end = Math.min(timeline.duration, playhead + 50);
                  engine.setWorkArea(frame(start), frame(end));
                }
              }}
              className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
              title="Set work area from selection or playhead"
            >
              ⬚ Work Area
            </button>
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-auto relative">
        {/* Time ruler */}
        <div className="sticky top-0 z-10">
          <TimeRuler
            duration={timeline.duration}
            fps={timeline.fps}
            pixelsPerFrame={pixelsPerFrame}
            onRulerClick={handleRulerClick}
          />
        </div>

        {/* Tracks */}
        <div className="relative">
          {timeline.tracks.map((track) => (
            <Track
              key={track.id}
              trackId={track.id}
              pixelsPerFrame={pixelsPerFrame}
              snappingEnabled={snappingEnabled}
              editingMode={editingMode}
              onSnapIndicator={setSnapIndicator}
              playhead={playhead}
              selectedClipIds={selectedClipIds}
              onClipClick={handleClipClick}
              onRequestTrackAtY={handleRequestTrackAtY}
            />
          ))}

          {/* Work Area */}
          {state.workArea && (
            <div
              className="absolute top-0 bottom-0 bg-blue-500 bg-opacity-10 border-l-2 border-r-2 border-blue-400 pointer-events-none z-20"
              style={{
                left: state.workArea.startFrame * pixelsPerFrame + 128,
                width: (state.workArea.endFrame - state.workArea.startFrame) * pixelsPerFrame,
              }}
            >
              <div className="absolute top-0 left-0 px-1 text-[10px] text-blue-300 bg-blue-900 bg-opacity-80">
                Work Area
              </div>
            </div>
          )}

          {/* Timeline Markers */}
          {state.markers.timeline.map((marker) => (
            <div
              key={marker.id}
              className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{ left: marker.frame * pixelsPerFrame + 128 }}
            >
              <div 
                className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent"
                style={{ borderTopColor: marker.color || '#10b981' }}
              />
              <div 
                className="w-px bg-opacity-50"
                style={{ backgroundColor: marker.color || '#10b981', height: '100%' }}
              />
              <div 
                className="absolute top-2 left-1 text-[10px] text-white bg-black bg-opacity-70 px-1 rounded pointer-events-auto"
                title={marker.label}
              >
                {marker.label}
              </div>
            </div>
          ))}

          {/* Region Markers */}
          {state.markers.regions.map((marker) => (
            <div
              key={marker.id}
              className="absolute top-0 h-6 border-l border-r pointer-events-none z-25"
              style={{
                left: marker.startFrame * pixelsPerFrame + 128,
                width: (marker.endFrame - marker.startFrame) * pixelsPerFrame,
                borderColor: marker.color || '#8b5cf6',
                backgroundColor: `${marker.color || '#8b5cf6'}20`,
              }}
            >
              <div 
                className="absolute top-0 left-0 text-[10px] text-white px-1 pointer-events-auto"
                style={{ backgroundColor: marker.color || '#8b5cf6' }}
                title={marker.label}
              >
                {marker.label}
              </div>
            </div>
          ))}

          {/* Snap indicator */}
          {snapIndicator !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-yellow-400 pointer-events-none z-50"
              style={{ left: snapIndicator * pixelsPerFrame + 128 }} // Offset by track label width
            />
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 cursor-ew-resize"
            style={{ left: playhead * pixelsPerFrame + 128 }} // Offset by track label width
            onMouseDown={handlePlayheadMouseDown}
          >
            {/* Playhead handle for easier grabbing */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm cursor-grab active:cursor-grabbing" />
          </div>
        </div>

        {/* Empty state */}
        {timeline.tracks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            No tracks yet
          </div>
        )}
      </div>
    </div>
  );
}
