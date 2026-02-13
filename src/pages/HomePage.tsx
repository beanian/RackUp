import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Player, Session, Frame } from '../db/supabase';
import {
  startSession,
  endSession,
  recordFrame,
  deleteLastFrame,
  addPlayerToSession,
} from '../db/services';
import { useHomeData } from '../hooks/useHomeData';
import { useObsStatus } from '../hooks/useObsStatus';
import { playWinSound, playStreakSound, playSessionEndFanfare, playVsSplashSound, isSoundEnabled, setSoundEnabled } from '../utils/sounds';
import VsSplash from '../components/VsSplash';
import { getWinStreak, getStreakMessage } from '../utils/streaks';
import { checkAndUnlock, type Achievement } from '../utils/achievements';
import AnimatedNumber from '../components/AnimatedNumber';
import PlayerName from '../components/PlayerName';

type View = 'idle' | 'picking' | 'session' | 'summary';
type MatchStep = 'pickPlayer1' | 'pickPlayer2' | 'gameOn';

const FLAG_CONFIG = {
  brush:     { label: 'Brush',     bg: 'bg-blue-600',   text: 'text-white' },
  clearance: { label: 'Clearance', bg: 'bg-green-600',  text: 'text-white' },
  foul:      { label: 'Foul',      bg: 'bg-red-600',    text: 'text-white' },
  special:   { label: 'Special',   bg: 'bg-yellow-500', text: 'text-black' },
} as const;

type FlagKey = keyof typeof FLAG_CONFIG;
const ALL_FLAGS: FlagKey[] = ['brush', 'clearance', 'foul', 'special'];

const MATCH_STATE_KEY = 'rackup-match-state';

interface PersistedMatchState {
  matchStep: MatchStep;
  player1Id: number | null;
  player2Id: number | null;
  challengerQueue: number[];
}

function loadMatchState(): PersistedMatchState | null {
  try {
    const raw = localStorage.getItem(MATCH_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedMatchState;
  } catch {
    return null;
  }
}

function saveMatchState(state: PersistedMatchState) {
  localStorage.setItem(MATCH_STATE_KEY, JSON.stringify(state));
}

function clearMatchState() {
  localStorage.removeItem(MATCH_STATE_KEY);
}

export default function HomePage() {
  const saved = loadMatchState();

  const [view, setView] = useState<View>('idle');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);

  // Match state — winner stays on with challenger queue (restored from localStorage)
  const [matchStep, setMatchStep] = useState<MatchStep>(saved?.matchStep ?? 'pickPlayer1');
  const [player1Id, setPlayer1Id] = useState<number | null>(saved?.player1Id ?? null);
  const [player2Id, setPlayer2Id] = useState<number | null>(saved?.player2Id ?? null);
  const [challengerQueue, setChallengerQueue] = useState<number[]>(saved?.challengerQueue ?? []);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmChangePlayers, setConfirmChangePlayers] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'win' | 'streak' | 'info' } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showSplash, setShowSplash] = useState(false);
  const pendingFeedback = useRef<{ msg: string; type: 'win' | 'streak' | 'info'; streak?: number } | null>(null);
  const pendingAchievement = useRef<{ achievement: Achievement; playerName: string } | null>(null);
  const [newAchievement, setNewAchievement] = useState<{ achievement: Achievement; playerName: string } | null>(null);
  const achievementTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [varReviewing, setVarReviewing] = useState(false);
  const [varVideoPath, setVarVideoPath] = useState<string | null>(null);
  const [currentFrameFlags, setCurrentFrameFlags] = useState<FlagKey[]>([]);
  const [winnerFlash, setWinnerFlash] = useState<number | null>(null);
  const [flagPopKey, setFlagPopKey] = useState(0);
  const frameStartedAt = useRef<Date | null>(null);

  // ── Self-update state ──
  const [updatesAvailable, setUpdatesAvailable] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ step: string; status?: string; output?: string; error?: string; newVersion?: string; success?: boolean }[]>([]);
  const [liveVersion, setLiveVersion] = useState(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');

  // ── Data ──

  const {
    activeSession,
    players,
    allPlayers,
    sessionFrames,
    allFrames,
    monthlyLeaderboard,
    refresh,
  } = useHomeData();

  // Persist match state to localStorage whenever it changes
  useEffect(() => {
    if (activeSession) {
      saveMatchState({ matchStep, player1Id, player2Id, challengerQueue });
    }
  }, [activeSession, matchStep, player1Id, player2Id, challengerQueue]);

  // OBS recording state
  const [recordingEnabled, setRecordingEnabled] = useState<boolean>(() => {
    return localStorage.getItem('rackup-recording-enabled') === 'true';
  });
  const obsStatus = useObsStatus(recordingEnabled);

  // Sync recording state when changed from Camera page
  useEffect(() => {
    const handler = (e: Event) => {
      const enabled = (e as CustomEvent).detail as boolean;
      setRecordingEnabled(enabled);
    };
    window.addEventListener('rackup-recording-changed', handler);
    return () => window.removeEventListener('rackup-recording-changed', handler);
  }, []);

  // ── Self-update: check on mount (delayed) ──
  const checkForUpdates = useCallback(async () => {
    setUpdateChecking(true);
    try {
      const res = await fetch('/api/version');
      if (res.ok) {
        const data = await res.json();
        setLiveVersion(data.current);
        setUpdatesAvailable(data.updatesAvailable);
      }
    } catch { /* offline */ }
    finally { setUpdateChecking(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(t);
  }, [checkForUpdates]);

  const doUpdate = useCallback(async () => {
    setUpdateRunning(true);
    setUpdateProgress([]);
    try {
      const res = await fetch('/api/update', { method: 'POST' });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            setUpdateProgress(prev => [...prev, msg]);
            if (msg.success) {
              setLiveVersion(msg.newVersion ?? liveVersion);
              setUpdatesAvailable(0);
              setTimeout(() => window.location.reload(), 3000);
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setUpdateProgress(prev => [...prev, { step: 'Error', status: 'error', error: 'Network error during update' }]);
    } finally { setUpdateRunning(false); }
  }, [liveVersion]);

  // Persist recording toggle + start/stop OBS if mid-session
  const toggleRecording = useCallback(async () => {
    const next = !recordingEnabled;
    setRecordingEnabled(next);
    localStorage.setItem('rackup-recording-enabled', String(next));
    updateOverlay({ isRecording: next });

    if (activeSession && next && player1Id !== null && player2Id !== null) {
      // Toggled ON mid-session → start recording with proper naming
      const p1Wins = sessionFrames.filter(f => f.winnerId === player1Id).length;
      const p2Wins = sessionFrames.filter(f => f.winnerId === player2Id).length;
      fetch('/api/obs/frame-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1: playerName(player1Id),
          player2: playerName(player2Id),
          player1Nickname: playerNickname(player1Id) ?? null,
          player2Nickname: playerNickname(player2Id) ?? null,
          score: `${p1Wins}-${p2Wins}`,
          sessionDate: activeSession.date,
          frameNumber: sessionFrames.length + 1,
        }),
      }).catch(e => console.warn('OBS: Failed to start recording', e));
    } else if (activeSession && !next && obsStatus.recording) {
      // Toggled OFF mid-session → stop recording
      try {
        await fetch('/api/obs/stop-recording', { method: 'POST' });
      } catch (e) {
        console.warn('OBS: Failed to stop recording', e);
      }
    }
  }, [recordingEnabled, activeSession, obsStatus.recording]);

  const navigate = useNavigate();

  // PiP preview via OBS Virtual Camera
  const pipStreamRef = useRef<MediaStream | null>(null);
  const [pipReady, setPipReady] = useState(false);
  const pipVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el && pipStreamRef.current) {
      el.srcObject = pipStreamRef.current;
    }
  }, [pipReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recordingEnabled || !obsStatus.connected) {
      if (pipStreamRef.current) {
        pipStreamRef.current.getTracks().forEach(t => t.stop());
        pipStreamRef.current = null;
      }
      setPipReady(false);
      return;
    }

    let cancelled = false;

    const connectPip = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const obsDevice = devices.find(d =>
          d.kind === 'videoinput' && d.label.toLowerCase().includes('obs virtual camera')
        );
        if (!obsDevice) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: obsDevice.deviceId }, width: 640, height: 360 },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        pipStreamRef.current = stream;
        setPipReady(true);
      } catch {
        // Virtual camera not available — PiP just won't show
      }
    };

    connectPip();

    return () => {
      cancelled = true;
      if (pipStreamRef.current) {
        pipStreamRef.current.getTracks().forEach(t => t.stop());
        pipStreamRef.current = null;
      }
      setPipReady(false);
    };
  }, [recordingEnabled, obsStatus.connected]);

  // Summary data
  const [summaryData, setSummaryData] = useState<{
    frames: Frame[];
    session: Session;
    players: Player[];
  } | null>(null);

  // ── Determine effective view ──
  const effectiveView = useMemo(() => {
    if (view === 'summary') return 'summary';
    if (view === 'picking') return 'picking';
    if (activeSession) return 'session';
    return 'idle';
  }, [view, activeSession]);

  // ── Player name/emoji lookup ──
  const playerName = useCallback(
    (id: number) => allPlayers.find(p => p.id === id)?.name ?? '?',
    [allPlayers],
  );

  const playerNickname = useCallback(
    (id: number) => allPlayers.find(p => p.id === id)?.nickname,
    [allPlayers],
  );

  const playerEmoji = useCallback(
    (id: number) => allPlayers.find(p => p.id === id)?.emoji,
    [allPlayers],
  );

  // ── Overlay sync ──
  const updateOverlay = useCallback(async (state: Record<string, unknown>) => {
    try {
      await fetch('/api/overlay/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch (e) {
      console.warn('Overlay: Failed to update', e);
    }
  }, []);

  // ── Running totals ──
  const runningTotals = useMemo(() => {
    if (!activeSession) return [];

    const counts = new Map<number, number>();
    for (const pid of activeSession.playerIds) {
      counts.set(pid, 0);
    }
    for (const f of sessionFrames) {
      counts.set(f.winnerId, (counts.get(f.winnerId) ?? 0) + 1);
    }

    return activeSession.playerIds
      .map(pid => ({
        id: pid,
        name: playerName(pid),
        frames: counts.get(pid) ?? 0,
      }))
      .sort((a, b) => b.frames - a.frames);
  }, [activeSession, sessionFrames, playerName]);

  // ── Monthly top player (for giant killer achievement) ──
  const monthlyTopId = useMemo(() => {
    if (monthlyLeaderboard.length === 0) return undefined;
    const topName = monthlyLeaderboard[0].name;
    const topPlayer = allPlayers.find(p => p.name === topName);
    return topPlayer?.id;
  }, [monthlyLeaderboard, allPlayers]);

  // ── All-time H2H for predictions ──
  const allTimeH2H = useMemo(() => {
    if (player1Id === null || player2Id === null) return null;
    let p1Wins = 0;
    let p2Wins = 0;
    for (const f of allFrames) {
      if (f.winnerId === player1Id && f.loserId === player2Id) p1Wins++;
      else if (f.winnerId === player2Id && f.loserId === player1Id) p2Wins++;
    }
    return { p1Wins, p2Wins, total: p1Wins + p2Wins };
  }, [allFrames, player1Id, player2Id]);

  // ── Player sort: most sessions played first ──
  const sortedPlayers = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of allFrames) {
      if (!counts.has(f.winnerId)) counts.set(f.winnerId, 0);
      if (!counts.has(f.loserId)) counts.set(f.loserId, 0);
    }
    // Count unique sessions per player
    const sessionSets = new Map<number, Set<number>>();
    for (const f of allFrames) {
      if (!sessionSets.has(f.winnerId)) sessionSets.set(f.winnerId, new Set());
      if (!sessionSets.has(f.loserId)) sessionSets.set(f.loserId, new Set());
      sessionSets.get(f.winnerId)!.add(f.sessionId);
      sessionSets.get(f.loserId)!.add(f.sessionId);
    }
    for (const [id, sessions] of sessionSets) {
      counts.set(id, sessions.size);
    }
    return [...players].sort((a, b) => (counts.get(b.id!) ?? 0) - (counts.get(a.id!) ?? 0));
  }, [players, allFrames]);

  // ── Achievement toast helper ──
  const showAchievementToast = useCallback((ach: Achievement, name: string) => {
    clearTimeout(achievementTimer.current);
    setNewAchievement({ achievement: ach, playerName: name });
    achievementTimer.current = setTimeout(() => setNewAchievement(null), 9000);
  }, []);

  // ── Handlers ──

  const showFeedback = (msg: string, type: 'win' | 'streak' | 'info' = 'info') => {
    clearTimeout(feedbackTimer.current);
    setFeedback({ msg, type });
    feedbackTimer.current = setTimeout(() => setFeedback(null), type === 'streak' ? 2500 : 1500);
  };

  const handleStartSession = async () => {
    if (selectedPlayerIds.length < 2) return;
    await startSession(selectedPlayerIds);
    // Auto-set first matchup from selection order: 1st vs 2nd, rest form queue
    const [first, second, ...rest] = selectedPlayerIds;
    setPlayer1Id(first);
    setPlayer2Id(second);
    setChallengerQueue(rest);
    setMatchStep('gameOn');
    setShowSplash(true);
    playVsSplashSound();
    setSelectedPlayerIds([]);
    setView('session');
    updateOverlay({
      visible: true,
      playerA: { id: String(first), name: playerName(first), nickname: playerNickname(first), emoji: playerEmoji(first), score: 0 },
      playerB: { id: String(second), name: playerName(second), nickname: playerNickname(second), emoji: playerEmoji(second), score: 0 },
      sessionDate: new Date().toISOString().slice(0, 10),
      frameNumber: 1,
      lastWinnerId: null,
    });
    refresh();
    // Recording deferred to "Ready to Play" button after splash dismisses
  };

  const togglePlayer = (id: number) => {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSelectPlayer1 = (id: number) => {
    setPlayer1Id(id);
    setMatchStep('pickPlayer2');
  };

  const handleSelectPlayer2 = (id: number) => {
    if (!activeSession) return;
    // Stop any active recording — next recording starts from the Ready button
    if (recordingEnabled && obsStatus.recording) {
      fetch('/api/obs/stop-recording', { method: 'POST' })
        .catch(e => console.warn('OBS: Failed to stop recording', e));
    }
    setPlayer2Id(id);
    // Build the challenger queue: everyone except the two playing, in roster order
    const remaining = activeSession.playerIds.filter(pid => pid !== player1Id && pid !== id);
    setChallengerQueue(remaining);
    setMatchStep('gameOn');
    setShowSplash(true);
    playVsSplashSound();
    // Compute h2h between player1 and the selected player2
    const p1h2h = sessionFrames.filter(f => f.winnerId === player1Id && f.loserId === id).length;
    const p2h2h = sessionFrames.filter(f => f.winnerId === id && f.loserId === player1Id).length;
    updateOverlay({
      visible: true,
      playerA: { id: String(player1Id!), name: playerName(player1Id!), nickname: playerNickname(player1Id!), emoji: playerEmoji(player1Id!), score: p1h2h },
      playerB: { id: String(id), name: playerName(id), nickname: playerNickname(id), emoji: playerEmoji(id), score: p2h2h },
      frameNumber: sessionFrames.length + 1,
      lastWinnerId: null,
    });
  };

  const handleRecordWinner = async (winnerId: number) => {
    if (!activeSession?.id || player1Id === null || player2Id === null || varReviewing) return;
    setWinnerFlash(winnerId);
    setTimeout(() => setWinnerFlash(null), 400);
    const loserId = winnerId === player1Id ? player2Id : player1Id;

    // Compute head-to-head scores optimistically for the NEXT matchup
    // After recording, winner stays on, loser goes to queue
    // Figure out who the next opponent will be
    let nextP1Id = winnerId;
    let nextP2Id: number;
    let nextP1Score: number;
    let nextP2Score: number;

    if (challengerQueue.length > 0) {
      nextP2Id = challengerQueue[0];
      // H2H between winner and next challenger from sessionFrames
      // +1 for the frame we're about to record if it affects this h2h
      nextP1Score = sessionFrames.filter(f => f.winnerId === nextP1Id && f.loserId === nextP2Id).length;
      nextP2Score = sessionFrames.filter(f => f.winnerId === nextP2Id && f.loserId === nextP1Id).length;
    } else {
      nextP2Id = loserId;
      // Same two players continue — update the h2h with the new frame
      nextP1Score = sessionFrames.filter(f => f.winnerId === nextP1Id && f.loserId === nextP2Id).length + (winnerId === nextP1Id && loserId === nextP2Id ? 1 : 0);
      nextP2Score = sessionFrames.filter(f => f.winnerId === nextP2Id && f.loserId === nextP1Id).length + (winnerId === nextP2Id && loserId === nextP1Id ? 1 : 0);
    }

    // Capture brush flag before clearing (used for DB write + achievements)
    const isBrush = currentFrameFlags.includes('brush');

    // Stop current OBS recording — next recording starts when user taps "Ready"
    if (recordingEnabled && obsStatus.connected) {
      fetch('/api/obs/stop-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: currentFrameFlags }),
      }).catch(e => console.warn('OBS: Failed to stop recording', e));
    }
    setCurrentFrameFlags([]);

    updateOverlay({
      visible: true,
      playerA: { id: String(nextP1Id), name: playerName(nextP1Id), nickname: playerNickname(nextP1Id), emoji: playerEmoji(nextP1Id), score: nextP1Score },
      playerB: { id: String(nextP2Id), name: playerName(nextP2Id), nickname: playerNickname(nextP2Id), emoji: playerEmoji(nextP2Id), score: nextP2Score },
      frameNumber: sessionFrames.length + 2, // +1 for current frame, +1 for next
      lastWinnerId: String(winnerId),
    });

    // Optimistic UI update — move players immediately, write to DB in background
    // Compute streak on optimistic frames
    const optimisticFrames: Frame[] = [...sessionFrames, { winnerId, loserId, sessionId: activeSession.id, recordedAt: new Date(), brush: isBrush } as Frame];
    const streak = getWinStreak(optimisticFrames, winnerId);
    const streakMsg = getStreakMessage(streak);

    // Queue feedback to show after splash dismisses
    if (streakMsg) {
      pendingFeedback.current = { msg: `${playerName(winnerId)} wins! ${streakMsg}`, type: 'streak', streak };
    } else {
      pendingFeedback.current = { msg: `${playerName(winnerId)} wins!`, type: 'win' };
    }

    // Check session-scoped achievements for winner (and loser for brush achievements)
    const optimisticAllFrames = [...allFrames, { winnerId, loserId, sessionId: activeSession.id, recordedAt: new Date(), brush: isBrush } as Frame];
    const newAchs = checkAndUnlock(winnerId, optimisticAllFrames, [], optimisticFrames, monthlyTopId);
    if (newAchs.length > 0) {
      pendingAchievement.current = { achievement: newAchs[0], playerName: playerName(winnerId) };
    }
    // Also check loser so brush-related achievements trigger in real-time
    const loserAchs = checkAndUnlock(loserId, optimisticAllFrames, [], optimisticFrames, monthlyTopId);
    if (loserAchs.length > 0 && !pendingAchievement.current) {
      pendingAchievement.current = { achievement: loserAchs[0], playerName: playerName(loserId) };
    }

    if (challengerQueue.length > 0) {
      const [nextChallenger, ...restOfQueue] = challengerQueue;
      setPlayer1Id(winnerId);
      setPlayer2Id(nextChallenger);
      setChallengerQueue([...restOfQueue, loserId]);
    } else {
      setPlayer1Id(winnerId);
      setPlayer2Id(loserId);
    }
    setShowSplash(true);
    playVsSplashSound();

    // Flush feedback/achievements over the splash screen after VS animations settle
    setTimeout(() => {
      const fb = pendingFeedback.current;
      if (fb) {
        pendingFeedback.current = null;
        if (fb.type === 'streak' && fb.streak) {
          playStreakSound(fb.streak);
        } else {
          playWinSound();
        }
        showFeedback(fb.msg, fb.type);
      }
      const ach = pendingAchievement.current;
      if (ach) {
        pendingAchievement.current = null;
        const winToastDuration = fb?.type === 'streak' ? 2500 : 1500;
        setTimeout(() => showAchievementToast(ach.achievement, ach.playerName), winToastDuration + 200);
      }
    }, 1000);

    // Fire DB write + refresh in background (don't block the UI)
    const startTime = frameStartedAt.current ?? undefined;
    frameStartedAt.current = null;
    recordFrame(activeSession.id, winnerId, loserId, startTime, undefined, isBrush)
      .then(() => refresh())
      .catch(e => console.warn('Failed to record frame:', e));
  };

  const handleNewMatchup = (discard?: boolean) => {
    // Stop or discard in-progress recording if active
    if (recordingEnabled && obsStatus.recording) {
      const endpoint = discard ? '/api/obs/discard-recording' : '/api/obs/stop-recording';
      fetch(endpoint, { method: 'POST' })
        .catch(e => console.warn('OBS: Failed to stop/discard recording', e));
    }
    setCurrentFrameFlags([]);
    setPlayer1Id(null);
    setPlayer2Id(null);
    setChallengerQueue([]);
    setMatchStep('pickPlayer1');
    updateOverlay({ visible: false });
  };

  // Players not in the current session (available to add)
  const availableToAdd = players.filter(
    p => p.id !== undefined && !activeSession?.playerIds.includes(p.id),
  );

  const handleAddPlayerToSession = async (playerId: number) => {
    if (!activeSession?.id) return;
    await addPlayerToSession(activeSession.id, playerId);
    // Add them to the back of the challenger queue
    setChallengerQueue(prev => [...prev, playerId]);
    setShowAddPlayer(false);
    showFeedback(`${playerName(playerId)} joined!`, 'info');
    refresh();
  };

  const handleUndo = async () => {
    if (!activeSession?.id) return;
    await deleteLastFrame(activeSession.id);
    // Stop current recording segment (orphan file)
    if (recordingEnabled && obsStatus.recording) {
      try {
        await fetch('/api/obs/stop-recording', { method: 'POST' });
      } catch (e) {
        console.warn('OBS: Failed to stop recording on undo', e);
      }
    }
    setConfirmUndo(false);
    showFeedback('Last frame removed', 'info');
    refresh();
  };

  const handleEndSession = async () => {
    if (!activeSession?.id) return;
    // Stop OBS recording if active
    if (recordingEnabled && obsStatus.recording) {
      try {
        await fetch('/api/obs/stop-recording', { method: 'POST' });
      } catch (e) {
        console.warn('OBS: Failed to stop recording', e);
      }
    }
    updateOverlay({ visible: false, isRecording: false });
    const frames = [...sessionFrames];
    const session = { ...activeSession };
    const pIds = activeSession.playerIds;
    const sessionPlayers = allPlayers.filter(p => p.id !== undefined && pIds.includes(p.id));
    await endSession(activeSession.id);
    playSessionEndFanfare();

    // Check global achievements for all session players
    for (const pid of pIds) {
      checkAndUnlock(pid, allFrames, [], frames, monthlyTopId);
    }

    clearMatchState();
    setSummaryData({ frames, session: session as Session, players: sessionPlayers });
    setConfirmEnd(false);
    setView('summary');
    refresh();
  };

  const handleDismissSummary = () => {
    setSummaryData(null);
    setPlayer1Id(null);
    setPlayer2Id(null);
    setChallengerQueue([]);
    setMatchStep('pickPlayer1');
    setView('idle');
  };

  // ── Render: Idle (no active session) ──

  if (effectiveView === 'idle') {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return (
      <div className="flex flex-col gap-6 xl:gap-10">
        <div className="text-center">
          <p className="text-chalk-dim text-lg xl:text-2xl 2xl:text-3xl">{dateStr}</p>
          <h1 className="font-display text-[36px] xl:text-[72px] 2xl:text-[96px] text-gold glow-gold mt-1">RackUp</h1>
        </div>

        <button
          onClick={() => setView('picking')}
          className="btn-press w-full py-5 xl:py-8 2xl:py-10 panel text-chalk text-[28px] xl:text-[44px] 2xl:text-[56px] font-bold !border-2 !border-gold shadow-lg min-h-[72px] xl:min-h-[120px]"
        >
          New Session
        </button>

        {monthlyLeaderboard && monthlyLeaderboard.length > 0 && (
          <div className="panel p-4 xl:p-8 2xl:p-10">
            <h2 className="font-display text-gold text-xl xl:text-3xl 2xl:text-4xl mb-3 xl:mb-6">
              {new Date().toLocaleDateString(undefined, { month: 'long' })}
            </h2>
            <div className="flex flex-col gap-2 xl:gap-4">
              {monthlyLeaderboard.map((entry, i) => {
                const medal = i === 0 ? 'text-gold glow-gold' : i === 1 ? 'text-silver' : i === 2 ? 'text-bronze' : 'text-chalk-dim';
                return (
                  <div key={entry.name} className="flex items-center justify-between px-2 py-1 xl:px-4 xl:py-3">
                    <div className="flex items-center gap-3 xl:gap-5">
                      <span className={`text-lg xl:text-3xl 2xl:text-4xl font-bold w-6 xl:w-12 text-center score-num ${medal}`}>{i + 1}</span>
                      <span className="text-chalk text-lg xl:text-2xl 2xl:text-3xl chalk-text">{entry.emoji ? `${entry.emoji} ` : ''}<PlayerName name={entry.name} nickname={entry.nickname} /></span>
                    </div>
                    <div className="flex items-center gap-2 xl:gap-4 text-lg xl:text-2xl 2xl:text-3xl">
                      <span className="text-win font-semibold score-num">{entry.won}W</span>
                      <span className="text-chalk-dim">-</span>
                      <span className="text-loss font-semibold score-num">{entry.lost}L</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Player Picker ──

  if (effectiveView === 'picking') {
    return (
      <div className="flex flex-col gap-4 xl:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[28px] xl:text-[48px] 2xl:text-[60px] text-chalk chalk-text">Select Players</h1>
          <button
            onClick={() => { setView('idle'); setSelectedPlayerIds([]); }}
            className="btn-press text-chalk-dim text-lg xl:text-2xl px-4 py-2 min-h-[48px] xl:min-h-[72px]"
          >
            Cancel
          </button>
        </div>

        {/* Start Session + Record — sticky bar */}
        <div className="sticky top-0 z-10 -mx-4 xl:-mx-8 2xl:-mx-10 -mt-4 xl:-mt-6 px-4 xl:px-8 2xl:px-10 py-3 xl:py-4 bg-board-dark border-b-2 border-board-light/30 shadow-lg flex items-center gap-3 xl:gap-4">
          <button
            onClick={toggleRecording}
            className={`btn-press flex items-center gap-2 xl:gap-3 px-4 xl:px-6 py-3 xl:py-4 rounded-lg text-base xl:text-xl font-semibold min-h-[48px] xl:min-h-[64px] flex-shrink-0 ${
              recordingEnabled
                ? 'bg-loss/15 border border-loss/50 text-loss'
                : 'border border-board-light/30 text-chalk-dim'
            }`}
          >
            <span className={`inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded border-2 flex-shrink-0 ${
              recordingEnabled ? 'border-loss bg-loss/20' : 'border-chalk-dim/50'
            }`}>
              {recordingEnabled && <span className="text-loss text-xs xl:text-sm font-black">&#10003;</span>}
            </span>
            Record
          </button>
          {selectedPlayerIds.length >= 2 ? (
            <button
              onClick={handleStartSession}
              className="btn-press flex-1 py-3 xl:py-4 bg-win text-board-dark text-[22px] xl:text-[36px] 2xl:text-[44px] font-bold rounded-xl min-h-[48px] xl:min-h-[64px] shadow-lg"
            >
              Start Session ({selectedPlayerIds.length} players)
            </button>
          ) : (
            <p className="flex-1 text-chalk-dim text-base xl:text-xl text-center italic">
              Select at least 2 players
            </p>
          )}
        </div>

        {players.length === 0 ? (
          <p className="text-chalk-dim text-lg xl:text-2xl text-center py-8">
            No players yet. Add some on the Players tab.
          </p>
        ) : (
          <>
            <p className="text-chalk-dim text-base xl:text-xl text-center">
              Tap in playing order. #1 and #2 play first.
            </p>
            <div className="flex flex-col gap-3 xl:gap-4">
              {sortedPlayers.map(p => {
                const selected = selectedPlayerIds.includes(p.id!);
                const order = selected ? selectedPlayerIds.indexOf(p.id!) + 1 : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id!)}
                    className={`btn-press w-full min-h-[64px] xl:min-h-[96px] py-4 xl:py-6 px-6 xl:px-8 rounded-xl text-[24px] xl:text-[40px] 2xl:text-[48px] font-semibold text-left transition-colors border-2 flex items-center gap-4 xl:gap-6 ${
                      selected
                        ? 'panel !border-gold text-gold'
                        : 'bg-board-dark border-board-light/30 text-chalk'
                    }`}
                  >
                    {selected && (
                      <span className="bg-gold text-board-dark font-black text-base xl:text-xl w-8 h-8 xl:w-12 xl:h-12 rounded-full flex items-center justify-center flex-shrink-0">
                        {order}
                      </span>
                    )}
                    {p.emoji && <span className="text-2xl xl:text-4xl">{p.emoji}</span>}
                    <PlayerName name={p.name} nickname={p.nickname} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Render: Session Summary ──

  if (effectiveView === 'summary' && summaryData) {
    const { frames, players: sPlayers } = summaryData;
    const stats = sPlayers.map(p => {
      const won = frames.filter(f => f.winnerId === p.id).length;
      const lost = frames.filter(f => f.loserId === p.id).length;
      return { name: p.name, won, lost };
    }).sort((a, b) => b.won - a.won || a.lost - b.lost);

    return (
      <div className="flex flex-col gap-5 xl:gap-8">
        <h1 className="font-display text-[32px] xl:text-[64px] 2xl:text-[80px] text-gold glow-gold text-center">Session Complete</h1>
        <p className="text-chalk-dim text-lg xl:text-2xl 2xl:text-3xl text-center">{frames.length} frames played</p>

        <div className="panel p-4 xl:p-8 2xl:p-10">
          <h2 className="font-display text-gold text-xl xl:text-3xl 2xl:text-4xl mb-3 xl:mb-6">Final Standings</h2>
          <div className="flex flex-col gap-3 xl:gap-5">
            {stats.map((s, i) => {
              const medal = i === 0 ? 'text-gold glow-gold' : i === 1 ? 'text-silver' : i === 2 ? 'text-bronze' : 'text-chalk-dim';
              return (
                <div key={s.name} className="flex items-center justify-between px-2 xl:px-4">
                  <div className="flex items-center gap-3 xl:gap-5">
                    <span className={`text-[28px] xl:text-[48px] 2xl:text-[60px] font-bold w-8 xl:w-16 text-center score-num ${medal}`}>{i + 1}</span>
                    <span className={`text-[28px] xl:text-[48px] 2xl:text-[60px] text-chalk font-semibold chalk-text ${i === 0 ? 'glow-gold' : ''}`}>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 xl:gap-4">
                    <span className="text-[36px] xl:text-[64px] 2xl:text-[80px] font-bold text-win score-num">{s.won}</span>
                    <span className="text-chalk-dim text-[28px] xl:text-[48px]">-</span>
                    <span className="text-[36px] xl:text-[64px] 2xl:text-[80px] font-bold text-loss score-num">{s.lost}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleDismissSummary}
          className="btn-press w-full py-5 xl:py-8 panel text-chalk text-[24px] xl:text-[40px] 2xl:text-[48px] font-bold !border-2 !border-gold min-h-[64px] xl:min-h-[96px] shadow-lg"
        >
          Done
        </button>
      </div>
    );
  }

  // ── Render: Active Session ──

  const totalFrames = sessionFrames.length;

  return (
    <div className="flex flex-col h-full gap-0 -mx-4 -mt-4 xl:-mx-8 xl:-mt-8 2xl:-mx-10 2xl:-mt-10">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-4 xl:top-8 left-1/2 -translate-x-1/2 font-bold text-xl xl:text-3xl 2xl:text-4xl px-8 xl:px-14 py-4 xl:py-6 rounded-xl shadow-lg z-[60] ${
          feedback.type === 'streak'
            ? 'bg-gold text-board-dark streak-toast'
            : feedback.type === 'win'
              ? 'bg-win text-board-dark toast-enter'
              : 'bg-win text-board-dark toast-enter'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Achievement toast */}
      {newAchievement && (
        <div className="fixed top-4 xl:top-8 left-1/2 -translate-x-1/2 bg-gold text-board-dark font-bold text-lg xl:text-2xl px-6 xl:px-10 py-3 xl:py-5 rounded-xl shadow-lg z-[60] badge-enter flex items-center gap-3">
          <span className="text-2xl xl:text-4xl">{newAchievement.achievement.icon}</span>
          <div className="flex flex-col leading-tight">
            <span>{newAchievement.playerName}: {newAchievement.achievement.name}</span>
            <span className="text-sm xl:text-base font-semibold opacity-80">Achievement unlocked!</span>
          </div>
        </div>
      )}

      {/* ── Header Bar ── */}
      <div className="panel-wood !rounded-none !border-x-0 !border-t-0 border-b-2 border-trim-light px-4 py-3 xl:px-8 xl:py-5 2xl:px-10 2xl:py-6 flex items-center flex-shrink-0 relative">
        <div className="flex items-center gap-3 xl:gap-5">
          <button
            onClick={() => setShowUpdateModal(true)}
            className={`btn-press font-black text-sm xl:text-xl 2xl:text-2xl px-2 py-1 xl:px-4 xl:py-2 rounded transition-colors ${
              updatesAvailable > 0
                ? 'bg-gold text-board-dark update-glow'
                : 'bg-gold text-board-dark'
            }`}
          >
            {updatesAvailable > 0 ? 'UPDATE' : '8 BALL'}
          </button>
        </div>
        <h1 className="font-display text-chalk text-xl xl:text-3xl 2xl:text-4xl tracking-wide chalk-text absolute left-1/2 -translate-x-1/2">THE CUEMANS ARCH</h1>

        {/* REC Indicator */}
        {recordingEnabled && obsStatus.recording && (
          <div className="flex items-center gap-1.5 xl:gap-2 ml-4">
            <span
              className="w-3 h-3 xl:w-4 xl:h-4 rounded-full bg-loss"
              style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
            />
            <span className="text-loss font-bold text-sm xl:text-lg">REC</span>
          </div>
        )}

        <div className="text-chalk-dim text-sm xl:text-xl 2xl:text-2xl text-right ml-auto">
          <span>Players: <span className="text-chalk font-bold score-num">{activeSession?.playerIds.length ?? 0}</span></span>
          <span className="ml-3 xl:ml-6">Frames: <AnimatedNumber value={totalFrames} className="text-chalk font-bold score-num" /></span>
        </div>
      </div>

      {/* ── Main Area: Current Match ── */}
      <div className="flex-1 flex flex-col items-center px-4 xl:px-10 py-4 min-h-0 overflow-y-auto relative">

        {/* Selecting Player 1 */}
        {matchStep === 'pickPlayer1' && (
          <div className="w-full max-w-lg xl:max-w-3xl 2xl:max-w-5xl flex flex-col items-center gap-4 xl:gap-6">
            <p className="text-chalk-dim text-xl xl:text-3xl 2xl:text-4xl uppercase tracking-widest font-display">Select Player 1</p>
            <div className="w-full flex flex-col gap-3 xl:gap-5">
              {activeSession?.playerIds.map(pid => (
                <button
                  key={pid}
                  onClick={() => handleSelectPlayer1(pid)}
                  className="btn-press w-full min-h-[72px] xl:min-h-[120px] py-4 xl:py-8 px-6 xl:px-10 panel text-[28px] xl:text-[48px] 2xl:text-[60px] font-bold text-chalk flex items-center justify-center gap-3 xl:gap-5"
                >
                  {playerEmoji(pid) && <span>{playerEmoji(pid)}</span>}
                  <PlayerName name={playerName(pid)} nickname={playerNickname(pid)} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selecting Player 2 */}
        {matchStep === 'pickPlayer2' && player1Id !== null && (
          <div className="w-full max-w-lg xl:max-w-3xl 2xl:max-w-5xl flex flex-col items-center gap-4 xl:gap-6">
            <p className="text-gold text-2xl xl:text-5xl 2xl:text-6xl font-bold glow-gold">{playerEmoji(player1Id) ? `${playerEmoji(player1Id)} ` : ''}<PlayerName name={playerName(player1Id)} nickname={playerNickname(player1Id)} /></p>
            <p className="text-chalk-dim text-xl xl:text-3xl uppercase tracking-widest font-display">v</p>
            <p className="text-chalk-dim text-xl xl:text-3xl 2xl:text-4xl uppercase tracking-widest font-display">Select Player 2</p>
            <div className="w-full flex flex-col gap-3 xl:gap-5">
              {activeSession?.playerIds
                .filter(pid => pid !== player1Id)
                .map(pid => (
                  <button
                    key={pid}
                    onClick={() => handleSelectPlayer2(pid)}
                    className="btn-press w-full min-h-[72px] xl:min-h-[120px] py-4 xl:py-8 px-6 xl:px-10 panel text-[28px] xl:text-[48px] 2xl:text-[60px] font-bold text-chalk flex items-center justify-center gap-3 xl:gap-5"
                  >
                    {playerEmoji(pid) && <span>{playerEmoji(pid)}</span>}
                    <PlayerName name={playerName(pid)} nickname={playerNickname(pid)} />
                  </button>
                ))}
            </div>
            <button
              onClick={() => { setPlayer1Id(null); setMatchStep('pickPlayer1'); }}
              className="btn-press text-chalk-dim text-lg xl:text-2xl mt-2 min-h-[48px] xl:min-h-[72px]"
            >
              Back
            </button>
          </div>
        )}

        {/* GAME ON - current match display */}
        {matchStep === 'gameOn' && player1Id !== null && player2Id !== null && (
          <div className="w-full flex flex-col items-center gap-2 xl:gap-4">
            <p className="font-display text-gold text-lg xl:text-[48px] 2xl:text-[60px] font-bold uppercase tracking-[0.3em] glow-gold">Game On</p>

            {/* Prediction */}
            {allTimeH2H && (
              <p className="text-chalk-dim text-sm xl:text-lg 2xl:text-xl italic">
                {allTimeH2H.total === 0
                  ? 'First time matchup!'
                  : allTimeH2H.p1Wins === allTimeH2H.p2Wins
                    ? `Dead even! (${allTimeH2H.p1Wins}-${allTimeH2H.p2Wins} all time)`
                    : allTimeH2H.p1Wins > allTimeH2H.p2Wins
                      ? `${playerName(player1Id!)} wins ${Math.round((allTimeH2H.p1Wins / allTimeH2H.total) * 100)}% of the time (${allTimeH2H.p1Wins}-${allTimeH2H.p2Wins} all time)`
                      : `${playerName(player2Id!)} wins ${Math.round((allTimeH2H.p2Wins / allTimeH2H.total) * 100)}% of the time (${allTimeH2H.p2Wins}-${allTimeH2H.p1Wins} all time)`}
              </p>
            )}

            {/* Tap the winner */}
            <p className="text-chalk-dim text-sm xl:text-xl 2xl:text-2xl uppercase tracking-widest mb-1 xl:mb-2">Tap the winner</p>

            {(() => {
              const eitherHasEmoji = !!(playerEmoji(player1Id) || playerEmoji(player2Id));
              return (
                <div className="w-full flex items-stretch justify-center gap-4 xl:gap-8">
                  {/* Player 1 - tap to win */}
                  <button
                    onClick={() => handleRecordWinner(player1Id)}
                    className={`btn-press flex-1 max-w-[45%] py-5 xl:py-10 2xl:py-14 panel !border-2 active:!border-win flex flex-col items-center justify-center ${winnerFlash === player1Id ? 'winner-flash !border-win' : '!border-board-light'}`}
                  >
                    {eitherHasEmoji && (
                      <span className="text-[clamp(32px,6vw,80px)] block text-center mb-1 min-h-[1em]">{playerEmoji(player1Id) || '\u00A0'}</span>
                    )}
                    <PlayerName
                      name={playerName(player1Id)}
                      nickname={playerNickname(player1Id)}
                      className="text-[clamp(28px,5vw,100px)] font-black text-chalk chalk-text block text-center leading-tight"
                    />
                  </button>

                  <span className="text-chalk-dim text-[clamp(24px,3vw,72px)] font-bold font-display flex items-center">v</span>

                  {/* Player 2 - tap to win */}
                  <button
                    onClick={() => handleRecordWinner(player2Id)}
                    className={`btn-press flex-1 max-w-[45%] py-5 xl:py-10 2xl:py-14 panel !border-2 active:!border-win flex flex-col items-center justify-center ${winnerFlash === player2Id ? 'winner-flash !border-win' : '!border-board-light'}`}
                  >
                    {eitherHasEmoji && (
                      <span className="text-[clamp(32px,6vw,80px)] block text-center mb-1 min-h-[1em]">{playerEmoji(player2Id) || '\u00A0'}</span>
                    )}
                    <PlayerName
                      name={playerName(player2Id)}
                      nickname={playerNickname(player2Id)}
                      className="text-[clamp(28px,5vw,100px)] font-black text-chalk chalk-text block text-center leading-tight"
                    />
                  </button>
                </div>
              );
            })()}

            {/* Head-to-head for current matchup */}
            {(() => {
              const p1Wins = sessionFrames.filter(f => f.winnerId === player1Id && f.loserId === player2Id).length;
              const p2Wins = sessionFrames.filter(f => f.winnerId === player2Id && f.loserId === player1Id).length;
              if (p1Wins + p2Wins === 0) return null;
              return (
                <p className="text-chalk-dim text-lg xl:text-3xl 2xl:text-4xl mt-1 xl:mt-3">
                  <span className="text-chalk font-bold score-num">{p1Wins}</span>
                  <span className="mx-2 xl:mx-4">-</span>
                  <span className="text-chalk font-bold score-num">{p2Wins}</span>
                </p>
              );
            })()}

            {/* Frame flags */}
            {(() => {
              const visibleFlags = recordingEnabled && obsStatus.recording
                ? ALL_FLAGS
                : ['brush' as FlagKey];
              return (
                <div className="flex items-center gap-2 xl:gap-3 mt-2 xl:mt-3">
                  {visibleFlags.map((flag) => {
                    const cfg = FLAG_CONFIG[flag];
                    const active = currentFrameFlags.includes(flag);
                    return (
                      <button
                        key={`${flag}-${flagPopKey}`}
                        onClick={() => {
                          setCurrentFrameFlags(prev =>
                            prev.includes(flag)
                              ? prev.filter(f => f !== flag)
                              : [...prev, flag],
                          );
                          setFlagPopKey(k => k + 1);
                        }}
                        className={`btn-press text-sm xl:text-lg font-semibold px-3 xl:px-5 py-1.5 xl:py-2 rounded-full transition-all min-h-[36px] xl:min-h-[44px] flag-pop ${
                          active
                            ? `${cfg.bg} ${cfg.text}`
                            : 'bg-white/5 text-chalk-dim/40'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Next up queue */}
            {challengerQueue.length > 0 && (
              <div className="mt-2 xl:mt-3 flex items-center gap-2 xl:gap-4 flex-wrap justify-center">
                <span className="text-chalk-dim text-base xl:text-xl 2xl:text-2xl uppercase tracking-wider font-display">Next up:</span>
                {challengerQueue.map((pid, i) => (
                  <span key={pid} className={`text-base xl:text-xl 2xl:text-2xl font-semibold ${i === 0 ? 'text-gold glow-gold' : 'text-chalk-dim'}`}>
                    {playerEmoji(pid) ? `${playerEmoji(pid)} ` : ''}<PlayerName name={playerName(pid)} nickname={playerNickname(pid)} />{i < challengerQueue.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Action buttons row */}
            <div className="flex items-center gap-3 xl:gap-5 mt-2 xl:mt-3">
              {confirmChangePlayers ? (
                <>
                  <button
                    onClick={() => { setConfirmChangePlayers(false); handleNewMatchup(false); }}
                    className="btn-press px-6 xl:px-10 py-3 xl:py-5 panel text-win text-lg xl:text-2xl font-bold min-h-[56px] xl:min-h-[80px]"
                  >
                    Keep Recording
                  </button>
                  <button
                    onClick={() => { setConfirmChangePlayers(false); handleNewMatchup(true); }}
                    className="btn-press px-6 xl:px-10 py-3 xl:py-5 bg-loss text-board-dark text-lg xl:text-2xl font-bold rounded-lg min-h-[56px] xl:min-h-[80px]"
                  >
                    Discard Recording
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (recordingEnabled && obsStatus.recording) {
                      setConfirmChangePlayers(true);
                    } else {
                      handleNewMatchup();
                    }
                  }}
                  className="btn-press px-6 xl:px-10 py-3 xl:py-5 panel-wood text-chalk-dim text-lg xl:text-2xl font-semibold min-h-[56px] xl:min-h-[80px]"
                >
                  Change Players
                </button>
              )}

              {/* VAR Review button — only when actively recording */}
              {recordingEnabled && obsStatus.recording && !varReviewing && (
                <button
                  onClick={async () => {
                    setVarReviewing(true);
                    try {
                      const res = await fetch('/api/var/review', { method: 'POST' });
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        throw new Error(body.error || `HTTP ${res.status}`);
                      }
                      const data = await res.json();
                      setVarVideoPath(data.videoFilePath);
                    } catch (e) {
                      console.warn('VAR: Failed to stop recording for review', e);
                      setVarReviewing(false);
                    }
                  }}
                  className="btn-press px-6 xl:px-10 py-3 xl:py-5 min-h-[56px] xl:min-h-[80px] rounded-xl text-lg xl:text-2xl font-black uppercase tracking-wider border-2 border-amber-500 bg-amber-500/10 text-amber-400"
                >
                  VAR
                </button>
              )}
            </div>

          </div>
        )}

        {/* PiP Camera Preview */}
        {recordingEnabled && obsStatus.connected && (
          <button
            onClick={() => navigate('/camera')}
            className="btn-press absolute top-2 right-2 xl:top-4 xl:right-4 w-32 h-20 xl:w-44 xl:h-26 panel !border-2 overflow-hidden z-30 p-0 shadow-lg"
            style={{ borderColor: obsStatus.recording ? 'rgba(239,68,68,0.6)' : 'rgba(212,175,55,0.4)' }}
          >
            {pipReady ? (
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-chalk-dim text-xs">CAM</span>
              </div>
            )}
            {obsStatus.recording && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-loss"
                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
              />
            )}
          </button>
        )}

      </div>

      {/* ── Totals + Actions (pinned bottom) ── */}
      <div className="flex-shrink-0 border-t border-board-light/30">
        {/* Add Player overlay */}
        {showAddPlayer && (
          <div className="px-4 py-3 xl:px-8 xl:py-5 border-b border-board-light/30 bg-board-dark/50">
            <div className="flex items-center justify-between mb-2 xl:mb-4">
              <span className="font-display text-gold font-bold text-base xl:text-xl uppercase tracking-wider">Add Player</span>
              <button
                onClick={() => setShowAddPlayer(false)}
                className="btn-press text-chalk-dim text-base xl:text-xl px-3 py-1 min-h-[40px] xl:min-h-[56px]"
              >
                Cancel
              </button>
            </div>
            {availableToAdd.length === 0 ? (
              <p className="text-chalk-dim text-base xl:text-xl py-2">All players are already in this session.</p>
            ) : (
              <div className="flex flex-wrap gap-2 xl:gap-4">
                {availableToAdd.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPlayerToSession(p.id!)}
                    className="btn-press py-3 xl:py-5 px-5 xl:px-8 panel text-chalk text-lg xl:text-2xl font-semibold min-h-[48px] xl:min-h-[72px] flex items-center gap-2"
                  >
                    {p.emoji && <span>{p.emoji}</span>}
                    <PlayerName name={p.name} nickname={p.nickname} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Combined totals + actions row */}
        <div className="px-4 py-1.5 xl:px-8 xl:py-2 flex items-center gap-3 xl:gap-6">
          {/* Running totals - left side */}
          <div className="flex items-center gap-4 xl:gap-8 flex-wrap">
            {runningTotals.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 xl:gap-3">
                {playerEmoji(p.id) && <span className="text-base xl:text-xl">{playerEmoji(p.id)}</span>}
                <PlayerName name={p.name} nickname={playerNickname(p.id)} className="text-chalk font-semibold text-base xl:text-xl 2xl:text-2xl truncate chalk-text" />
                <AnimatedNumber value={p.frames} className="text-gold font-black text-xl xl:text-3xl 2xl:text-4xl score-num" />
              </div>
            ))}
          </div>

          <div className="flex-1" />

          {/* Action buttons - right side */}
          <div className="flex items-center gap-2 xl:gap-3 flex-shrink-0">
            {sessionFrames.length > 0 && (
              confirmUndo ? (
                <>
                  <button
                    onClick={handleUndo}
                    className="btn-press py-2 xl:py-3 px-3 xl:px-5 bg-loss text-board-dark text-sm xl:text-lg font-bold rounded-lg min-h-[40px] xl:min-h-[56px]"
                  >
                    Confirm Undo
                  </button>
                  <button
                    onClick={() => setConfirmUndo(false)}
                    className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-bold min-h-[40px] xl:min-h-[56px]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmUndo(true)}
                  className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px]"
                >
                  Undo
                </button>
              )
            )}

            {!showAddPlayer && (
              <button
                onClick={() => setShowAddPlayer(true)}
                className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-gold text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px]"
              >
                + Player
              </button>
            )}

            <button
              onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}
              className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px]"
              title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
            >
              {soundOn ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
            </button>

            {/* Auto-Record checkbox */}
            <button
              onClick={toggleRecording}
              className={`btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px] flex items-center gap-1.5 xl:gap-2 ${
                recordingEnabled ? '!border-loss/60 text-loss' : 'text-chalk-dim'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-4 h-4 xl:w-5 xl:h-5 rounded border-2 flex-shrink-0 ${
                recordingEnabled ? 'border-loss bg-loss/20' : 'border-chalk-dim/50'
              }`}>
                {recordingEnabled && <span className="text-loss text-[10px] xl:text-xs font-black">&#10003;</span>}
              </span>
              Record
            </button>

            <button
              onClick={() => setConfirmEnd(true)}
              className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px]"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* VAR Review modal */}
      {varReviewing && varVideoPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="relative w-[95vw] max-w-5xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-amber-500 text-board-dark font-black text-lg xl:text-2xl px-3 py-1 rounded">VAR REVIEW</span>
                <span className="text-chalk-dim text-base xl:text-xl">Scrub through to review the incident</span>
              </div>
            </div>

            <video
              controls
              autoPlay
              className="w-full rounded bg-black"
              src={`${import.meta.env.VITE_API_URL ?? 'http://localhost:4077'}/api/recordings/stream?path=${encodeURIComponent(varVideoPath)}`}
            />

            <button
              onClick={async () => {
                if (!activeSession || player1Id === null || player2Id === null) return;
                try {
                  const res = await fetch('/api/var/resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      player1: playerName(player1Id),
                      player2: playerName(player2Id),
                      sessionDate: activeSession.date,
                      frameNumber: sessionFrames.length + 1,
                    }),
                  });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                } catch (e) {
                  console.warn('VAR: Failed to resume recording', e);
                }
                setVarReviewing(false);
                setVarVideoPath(null);
              }}
              className="btn-press w-full py-4 xl:py-6 rounded-xl text-xl xl:text-3xl font-bold border-2 border-win bg-win/10 text-win min-h-[56px] xl:min-h-[80px]"
            >
              Resume Recording
            </button>
          </div>
        </div>
      )}

      {/* End Session confirmation modal */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="panel p-8 xl:p-12 max-w-md xl:max-w-lg w-[90vw] flex flex-col items-center gap-6 xl:gap-8 !border-loss/30">
            <h2 className="font-display text-2xl xl:text-4xl text-chalk chalk-text text-center">End Session?</h2>
            <p className="text-chalk-dim text-base xl:text-xl text-center">
              {sessionFrames.length} frame{sessionFrames.length !== 1 ? 's' : ''} played.
              {recordingEnabled && obsStatus.recording && ' Recording will be stopped.'}
            </p>
            <div className="flex gap-4 xl:gap-6 w-full">
              <button
                onClick={() => setConfirmEnd(false)}
                className="btn-press flex-1 py-4 xl:py-6 panel text-chalk text-lg xl:text-2xl font-bold min-h-[56px] xl:min-h-[80px]"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                className="btn-press flex-1 py-4 xl:py-6 bg-loss text-board-dark text-lg xl:text-2xl font-bold rounded-xl min-h-[56px] xl:min-h-[80px]"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VS Splash overlay */}
      {showSplash && player1Id !== null && player2Id !== null && (
        <VsSplash
          player1={{ name: playerName(player1Id), nickname: playerNickname(player1Id), emoji: playerEmoji(player1Id) }}
          player2={{ name: playerName(player2Id), nickname: playerNickname(player2Id), emoji: playerEmoji(player2Id) }}
          h2h={allTimeH2H}
          onDismiss={() => {
            setShowSplash(false);
            // Mark the frame as started now
            frameStartedAt.current = new Date();
            // Fallback: flush any notifications not yet shown (e.g. if Ready was tapped very fast)
            if (pendingFeedback.current) {
              const fb = pendingFeedback.current;
              pendingFeedback.current = null;
              if (fb.type === 'streak' && fb.streak) {
                playStreakSound(fb.streak);
              } else {
                playWinSound();
              }
              showFeedback(fb.msg, fb.type);
            }
            if (pendingAchievement.current) {
              const ach = pendingAchievement.current;
              pendingAchievement.current = null;
              showAchievementToast(ach.achievement, ach.playerName);
            }
            // Start OBS recording for this frame
            if (recordingEnabled && activeSession && player1Id !== null && player2Id !== null) {
              const p1Wins = sessionFrames.filter(f => f.winnerId === player1Id && f.loserId === player2Id).length;
              const p2Wins = sessionFrames.filter(f => f.winnerId === player2Id && f.loserId === player1Id).length;
              fetch('/api/obs/frame-transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  player1: playerName(player1Id),
                  player2: playerName(player2Id),
                  player1Nickname: playerNickname(player1Id) ?? null,
                  player2Nickname: playerNickname(player2Id) ?? null,
                  score: `${p1Wins}-${p2Wins}`,
                  sessionDate: activeSession.date,
                  frameNumber: sessionFrames.length + 1,
                }),
              }).catch(e => console.warn('OBS: Failed to start recording', e));
            }
          }}
          onEndSession={() => {
            setShowSplash(false);
            pendingFeedback.current = null;
            pendingAchievement.current = null;
            handleEndSession();
          }}
        />
      )}

      {/* ── Update Modal ── */}
      {showUpdateModal && (() => {
        const lastMsg = updateProgress[updateProgress.length - 1];
        const updateDone = lastMsg?.success === true;
        const updateError = lastMsg?.status === 'error';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => !updateRunning && setShowUpdateModal(false)}
          >
            <div
              className="panel mx-4 w-full max-w-md p-6 xl:p-8 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-chalk text-xl xl:text-2xl font-display font-bold">System Update</h2>

              <div className="space-y-1 text-sm xl:text-base">
                <p className="text-chalk-dim">
                  Version: <span className="text-chalk font-mono">{liveVersion}</span>
                </p>
                <p className="text-chalk-dim">
                  {updatesAvailable > 0
                    ? <span className="text-gold">{updatesAvailable} update{updatesAvailable > 1 ? 's' : ''} available</span>
                    : 'Up to date'}
                </p>
              </div>

              {updateProgress.length > 0 && (
                <div className="bg-board-dark/80 border border-chalk-dim/20 rounded p-3 max-h-48 overflow-y-auto text-xs xl:text-sm font-mono space-y-1">
                  {updateProgress.map((msg, i) => (
                    <div key={i} className={msg.status === 'error' ? 'text-loss' : msg.status === 'done' ? 'text-win' : 'text-chalk-dim'}>
                      {msg.output ? msg.output.trim() : msg.error ? `Error: ${msg.error}` : `${msg.step}...`}
                    </div>
                  ))}
                  {updateDone && <div className="text-gold mt-2">Update complete — reloading...</div>}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={checkForUpdates}
                  disabled={updateChecking || updateRunning}
                  className="btn-press flex-1 py-3 xl:py-4 text-sm xl:text-base font-display font-bold text-chalk border border-chalk-dim/30 rounded bg-trim/50 hover:bg-trim disabled:opacity-40 transition-colors"
                >
                  {updateChecking ? 'Checking...' : 'Check for Updates'}
                </button>
                {updatesAvailable > 0 && !updateDone && (
                  <button
                    onClick={doUpdate}
                    disabled={updateRunning}
                    className="btn-press flex-1 py-3 xl:py-4 text-sm xl:text-base font-display font-bold text-board-dark rounded bg-gold hover:bg-gold/80 disabled:opacity-40 transition-colors"
                  >
                    {updateRunning ? 'Updating...' : 'Update Now'}
                  </button>
                )}
              </div>

              {!updateRunning && !updateDone && (
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="w-full py-2 text-sm text-chalk-dim/50 hover:text-chalk-dim transition-colors"
                >
                  Close
                </button>
              )}
              {updateError && !updateRunning && (
                <button
                  onClick={() => setUpdateProgress([])}
                  className="w-full py-2 text-sm text-chalk-dim/50 hover:text-chalk-dim transition-colors"
                >
                  Dismiss Error
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
