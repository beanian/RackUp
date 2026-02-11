import { useState, useEffect, useRef } from 'react';
import { useObsStatus } from '../hooks/useObsStatus';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function CameraPage() {
  const obs = useObsStatus();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll OBS for screenshot frames when connected
  useEffect(() => {
    if (!obs.connected) {
      setPreviewSrc(null);
      setPreviewError(false);
      return;
    }

    const fetchFrame = async () => {
      try {
        const res = await fetch('/api/obs/screenshot');
        if (res.ok) {
          const data = await res.json();
          setPreviewSrc(data.imageData);
          setPreviewError(false);
        } else {
          setPreviewError(true);
        }
      } catch {
        setPreviewError(true);
      }
    };

    fetchFrame();
    intervalRef.current = setInterval(fetchFrame, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [obs.connected]);

  const handleStart = async () => {
    try {
      await fetch('/api/obs/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // polling will update status
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/obs/stop-recording', { method: 'POST' });
    } catch {
      // polling will update status
    }
  };

  return (
    <div className="flex flex-col gap-4 xl:gap-6">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] xl:text-[48px] 2xl:text-[60px] text-gold glow-gold">
          Camera
        </h1>
        <div className="flex items-center gap-3 xl:gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 xl:w-4 xl:h-4 rounded-full ${
                obs.connected ? 'bg-win shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-loss shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              }`}
            />
            <span className={`text-base xl:text-xl font-bold ${obs.connected ? 'text-win' : 'text-loss'}`}>
              {obs.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {/* Recording badge */}
          {obs.recording && (
            <div className="flex items-center gap-1.5 xl:gap-2 bg-loss/20 px-3 py-1 xl:px-4 xl:py-2 rounded-lg">
              <span
                className="w-3 h-3 xl:w-4 xl:h-4 rounded-full bg-loss"
                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
              />
              <span className="text-loss font-bold text-sm xl:text-lg">REC</span>
              <span className="text-chalk font-mono text-sm xl:text-lg">{formatDuration(obs.duration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* OBS Preview */}
      <div className="panel p-2 xl:p-3">
        <div className="relative w-full aspect-video bg-board-dark rounded-lg overflow-hidden flex items-center justify-center">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="OBS Preview"
              className="w-full h-full object-contain"
            />
          ) : obs.connected && previewError ? (
            <div className="text-center px-4">
              <p className="text-chalk-dim text-lg xl:text-2xl">Preview unavailable</p>
              <p className="text-chalk-dim/60 text-sm xl:text-base mt-2">OBS is connected but screenshot capture failed. Check your OBS scene setup.</p>
            </div>
          ) : obs.connected ? (
            <p className="text-chalk-dim text-lg xl:text-2xl">Loading preview...</p>
          ) : (
            <div className="text-center px-4">
              <p className="text-chalk-dim text-xl xl:text-3xl mb-2">No Preview</p>
              <p className="text-chalk-dim/60 text-sm xl:text-lg">Start OBS Studio with WebSocket server enabled on port 4455</p>
            </div>
          )}
          {/* Recording overlay */}
          {obs.recording && previewSrc && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded">
              <span
                className="w-2.5 h-2.5 rounded-full bg-loss"
                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
              />
              <span className="text-loss font-bold text-xs">REC {formatDuration(obs.duration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 xl:gap-4">
        <button
          onClick={handleStart}
          disabled={!obs.connected || obs.recording}
          className="btn-press flex-1 py-4 xl:py-6 panel text-chalk text-lg xl:text-2xl font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Start Recording
        </button>
        <button
          onClick={handleStop}
          disabled={!obs.connected || !obs.recording}
          className="btn-press flex-1 py-4 xl:py-6 panel text-loss text-lg xl:text-2xl font-bold disabled:opacity-30 disabled:cursor-not-allowed !border-loss/40"
        >
          Stop Recording
        </button>
      </div>

      {/* Setup info (only when disconnected) */}
      {!obs.connected && (
        <div className="panel p-4 xl:p-6">
          <h2 className="font-display text-gold text-lg xl:text-2xl mb-3 xl:mb-4">Setup</h2>
          <ol className="list-decimal list-inside space-y-1 xl:space-y-2 text-chalk-dim text-sm xl:text-lg">
            <li>Open OBS Studio</li>
            <li>Go to Tools &gt; WebSocket Server Settings</li>
            <li>Enable the WebSocket server on port 4455</li>
            <li>The RackUp server will auto-connect</li>
          </ol>
        </div>
      )}
    </div>
  );
}
