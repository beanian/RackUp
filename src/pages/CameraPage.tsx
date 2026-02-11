import { useState, useEffect, useRef, useCallback } from 'react';
import { useObsStatus } from '../hooks/useObsStatus';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type FeedMode = 'virtualcam' | 'screenshot';

export default function CameraPage() {
  const obs = useObsStatus();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>('virtualcam');
  const [vcError, setVcError] = useState<string | null>(null);

  // Screenshot fallback state
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Try to connect to OBS Virtual Camera
  const connectVirtualCam = useCallback(async () => {
    try {
      // Enumerate devices to find OBS Virtual Camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const obsDevice = devices.find(d =>
        d.kind === 'videoinput' && d.label.toLowerCase().includes('obs virtual camera')
      );

      const constraints: MediaStreamConstraints = {
        video: obsDevice
          ? { deviceId: { exact: obsDevice.deviceId }, width: 1920, height: 1080 }
          : { width: 1920, height: 1080 },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Verify we actually got the OBS virtual camera (not just any webcam)
      const track = stream.getVideoTracks()[0];
      const label = track.label.toLowerCase();
      if (!label.includes('obs') && obsDevice) {
        // We asked for OBS but got something else — stop and fall back
        stream.getTracks().forEach(t => t.stop());
        throw new Error('OBS Virtual Camera not found');
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setVcError(null);
      setFeedMode('virtualcam');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Virtual Camera unavailable:', msg);
      setVcError(msg);
      setFeedMode('screenshot');
    }
  }, []);

  // Clean up virtual camera stream
  const disconnectVirtualCam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Virtual camera lifecycle
  useEffect(() => {
    if (feedMode === 'virtualcam') {
      connectVirtualCam();
    }
    return () => disconnectVirtualCam();
  }, [feedMode, connectVirtualCam, disconnectVirtualCam]);

  // Screenshot fallback polling (only when in screenshot mode and OBS connected)
  useEffect(() => {
    if (feedMode !== 'screenshot' || !obs.connected) {
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
  }, [feedMode, obs.connected]);

  const handleStart = async () => {
    try {
      await fetch('/api/obs/start-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      localStorage.setItem('rackup-recording-enabled', 'true');
      window.dispatchEvent(new CustomEvent('rackup-recording-changed', { detail: true }));
    } catch {
      // polling will update status
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/obs/stop-recording', { method: 'POST' });
      localStorage.setItem('rackup-recording-enabled', 'false');
      window.dispatchEvent(new CustomEvent('rackup-recording-changed', { detail: false }));
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
          {/* Virtual Camera — smooth real-time feed */}
          {feedMode === 'virtualcam' && !vcError && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}

          {/* Screenshot fallback */}
          {feedMode === 'screenshot' && previewSrc && (
            <img
              src={previewSrc}
              alt="OBS Preview"
              className="w-full h-full object-contain"
            />
          )}

          {/* Error / loading states */}
          {feedMode === 'virtualcam' && vcError && !obs.connected && (
            <div className="text-center px-4">
              <p className="text-chalk-dim text-xl xl:text-3xl mb-2">No Preview</p>
              <p className="text-chalk-dim/60 text-sm xl:text-lg">Start OBS Studio with Virtual Camera and WebSocket server enabled</p>
            </div>
          )}
          {feedMode === 'virtualcam' && vcError && obs.connected && (
            <div className="text-center px-4">
              <p className="text-chalk-dim text-lg xl:text-2xl mb-2">Virtual Camera not available</p>
              <p className="text-chalk-dim/60 text-sm xl:text-base">Using screenshot fallback. Enable OBS Virtual Camera for smooth live feed.</p>
            </div>
          )}
          {feedMode === 'screenshot' && !previewSrc && obs.connected && !previewError && (
            <p className="text-chalk-dim text-lg xl:text-2xl">Loading preview...</p>
          )}
          {feedMode === 'screenshot' && previewError && (
            <div className="text-center px-4">
              <p className="text-chalk-dim text-lg xl:text-2xl">Preview unavailable</p>
              <p className="text-chalk-dim/60 text-sm xl:text-base mt-2">OBS is connected but screenshot capture failed.</p>
            </div>
          )}

          {/* Recording overlay */}
          {obs.recording && (feedMode === 'virtualcam' ? !vcError : previewSrc) && (
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

      {/* Feed mode toggle */}
      <div className="flex items-center gap-3 xl:gap-4">
        <button
          onClick={() => setFeedMode('virtualcam')}
          className={`btn-press py-2 xl:py-3 px-4 xl:px-6 panel text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px] ${
            feedMode === 'virtualcam' ? '!border-gold text-gold' : 'text-chalk-dim'
          }`}
        >
          Virtual Camera
        </button>
        <button
          onClick={() => { disconnectVirtualCam(); setFeedMode('screenshot'); }}
          className={`btn-press py-2 xl:py-3 px-4 xl:px-6 panel text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px] ${
            feedMode === 'screenshot' ? '!border-gold text-gold' : 'text-chalk-dim'
          }`}
        >
          Screenshot
        </button>
        {feedMode === 'virtualcam' && vcError && (
          <span className="text-chalk-dim/60 text-sm xl:text-base">Enable Virtual Camera in OBS: Tools &gt; Start Virtual Camera</span>
        )}
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
