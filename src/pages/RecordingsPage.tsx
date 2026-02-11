import { useState, useEffect, useCallback } from 'react';

interface RecordingMeta {
  relativePath: string;
  date: string;
  time: string;
  player1: string;
  player2: string;
  frameNumber: number;
  sizeBytes: number;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4010';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecordingMeta | null>(null);
  const [videoError, setVideoError] = useState(false);

  const closeModal = useCallback(() => {
    setSelected(null);
    setVideoError(false);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected, closeModal]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API}/api/recordings`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRecordings(data.recordings);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-chalk-dim text-xl xl:text-3xl">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400 text-2xl xl:text-4xl font-semibold">Error</p>
        <p className="text-chalk-dim text-lg xl:text-2xl">{error}</p>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-chalk-dim text-2xl xl:text-4xl font-semibold">No recordings yet</p>
        <p className="text-chalk-dim text-lg xl:text-2xl">
          Recorded frames will appear here after your first session.
        </p>
      </div>
    );
  }

  function formatSize(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="flex flex-col gap-3 xl:gap-5">
      <h1 className="font-display text-2xl xl:text-5xl 2xl:text-6xl text-chalk chalk-text mb-2 xl:mb-4">
        Recordings
      </h1>

      {/* Video modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="relative w-[90vw] max-w-5xl">
            <div className="flex justify-between items-center mb-3">
              <p className="text-chalk text-lg xl:text-2xl font-semibold">
                {selected.player1} vs {selected.player2} — Frame {selected.frameNumber}
              </p>
              <button
                onClick={closeModal}
                className="text-chalk-dim hover:text-chalk text-2xl xl:text-3xl leading-none px-2"
              >
                ✕
              </button>
            </div>
            {videoError ? (
              <div className="bg-board-dark rounded p-6 text-center">
                <p className="text-chalk-dim text-lg xl:text-xl">
                  Unable to play this video. Your browser may not support the MKV/Matroska codec.
                </p>
                <p className="text-chalk-dim text-sm xl:text-base mt-2">
                  Try opening the file directly in VLC or another media player.
                </p>
              </div>
            ) : (
              <video
                key={selected.relativePath}
                controls
                autoPlay
                className="w-full rounded bg-black"
                src={`${API}/api/recordings/stream?path=${encodeURIComponent(selected.relativePath)}`}
                onError={() => setVideoError(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Recording list */}
      {recordings.map((rec) => (
        <button
          key={rec.relativePath}
          onClick={() => { setSelected(rec); setVideoError(false); }}
          className="btn-press block w-full text-left panel p-5 xl:p-8"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-chalk text-lg xl:text-2xl 2xl:text-3xl font-semibold">
                {rec.player1} vs {rec.player2}
              </p>
              <p className="text-chalk-dim text-sm xl:text-lg mt-1">
                {rec.date} at {rec.time}
              </p>
            </div>
            <div className="text-right">
              <p className="text-chalk-dim text-sm xl:text-lg">
                Frame {rec.frameNumber}
              </p>
              <p className="text-chalk-dim text-sm xl:text-lg">
                {formatSize(rec.sizeBytes)}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
