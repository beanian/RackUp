import { useState, useEffect } from 'react';

interface ObsStatus {
  connected: boolean;
  recording: boolean;
  duration: number;
}

export function useObsStatus(enabled = true): ObsStatus {
  const [status, setStatus] = useState<ObsStatus>({
    connected: false,
    recording: false,
    duration: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/obs/status');
        if (res.ok && active) {
          const data = await res.json();
          setStatus({
            connected: data.connected ?? false,
            recording: data.recording ?? false,
            duration: data.recordingDuration ?? 0,
          });
        }
      } catch {
        if (active) {
          setStatus({ connected: false, recording: false, duration: 0 });
        }
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return status;
}
