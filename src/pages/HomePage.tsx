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

type View = 'idle' | 'picking' | 'session' | 'summary';
type MatchStep = 'pickPlayer1' | 'pickPlayer2' | 'gameOn';

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
  const [feedback, setFeedback] = useState<string | null>(null);

  // ── Data ──

  const {
    activeSession,
    players,
    allPlayers,
    sessionFrames,
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

  // Persist recording toggle + start/stop OBS if mid-session
  const toggleRecording = useCallback(async () => {
    const next = !recordingEnabled;
    setRecordingEnabled(next);
    localStorage.setItem('rackup-recording-enabled', String(next));
    updateOverlay({ isRecording: next });

    if (activeSession && next) {
      // Toggled ON mid-session → start recording now
      try {
        await fetch('/api/obs/start-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch (e) {
        console.warn('OBS: Failed to start recording', e);
      }
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

  // PiP preview screenshot polling
  const [pipSrc, setPipSrc] = useState<string | null>(null);
  const pipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!recordingEnabled || !obsStatus.connected) {
      setPipSrc(null);
      return;
    }

    const fetchFrame = async () => {
      try {
        const res = await fetch('/api/obs/screenshot');
        if (res.ok) {
          const data = await res.json();
          setPipSrc(data.imageData);
        }
      } catch {
        // ignore
      }
    };

    fetchFrame();
    pipIntervalRef.current = setInterval(fetchFrame, 2000);
    return () => {
      if (pipIntervalRef.current) clearInterval(pipIntervalRef.current);
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

  // ── Player name lookup ──
  const playerName = useCallback(
    (id: number) => allPlayers.find(p => p.id === id)?.name ?? '?',
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

  // ── Handlers ──

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1500);
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
    setSelectedPlayerIds([]);
    setView('session');
    updateOverlay({
      visible: true,
      playerA: { id: String(first), name: playerName(first), score: 0 },
      playerB: { id: String(second), name: playerName(second), score: 0 },
      sessionDate: new Date().toISOString().slice(0, 10),
      frameNumber: 1,
      lastWinnerId: null,
    });
    refresh();

    // Start OBS recording for first frame if enabled
    if (recordingEnabled) {
      try {
        await fetch('/api/obs/start-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directory: undefined, // server will use default
            filename: undefined,  // server will generate
          }),
        });
      } catch (e) {
        console.warn('OBS: Failed to start recording', e);
      }
    }
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
    setPlayer2Id(id);
    // Build the challenger queue: everyone except the two playing, in roster order
    const remaining = activeSession.playerIds.filter(pid => pid !== player1Id && pid !== id);
    setChallengerQueue(remaining);
    setMatchStep('gameOn');
    // Compute h2h between player1 and the selected player2
    const p1h2h = sessionFrames.filter(f => f.winnerId === player1Id && f.loserId === id).length;
    const p2h2h = sessionFrames.filter(f => f.winnerId === id && f.loserId === player1Id).length;
    updateOverlay({
      visible: true,
      playerA: { id: String(player1Id!), name: playerName(player1Id!), score: p1h2h },
      playerB: { id: String(id), name: playerName(id), score: p2h2h },
      frameNumber: sessionFrames.length + 1,
      lastWinnerId: null,
    });
  };

  const handleRecordWinner = async (winnerId: number) => {
    if (!activeSession?.id || player1Id === null || player2Id === null) return;
    const loserId = winnerId === player1Id ? player2Id : player1Id;

    // OBS frame transition if recording enabled
    let videoFilePath: string | undefined;
    if (recordingEnabled && obsStatus.recording) {
      try {
        const p1Wins = sessionFrames.filter(f => f.winnerId === player1Id).length + (winnerId === player1Id ? 1 : 0);
        const p2Wins = sessionFrames.filter(f => f.winnerId === player2Id).length + (winnerId === player2Id ? 1 : 0);
        const res = await fetch('/api/obs/frame-transition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1: playerName(player1Id),
            player2: playerName(player2Id),
            score: `${p1Wins}-${p2Wins}`,
            sessionDate: activeSession.date,
            frameNumber: sessionFrames.length + 1,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          videoFilePath = data.videoFilePath;
        }
      } catch (e) {
        console.warn('OBS: Frame transition failed', e);
      }
    }

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

    updateOverlay({
      visible: true,
      playerA: { id: String(nextP1Id), name: playerName(nextP1Id), score: nextP1Score },
      playerB: { id: String(nextP2Id), name: playerName(nextP2Id), score: nextP2Score },
      frameNumber: sessionFrames.length + 2, // +1 for current frame, +1 for next
      lastWinnerId: String(winnerId),
    });

    await recordFrame(activeSession.id, winnerId, loserId, videoFilePath);
    showFeedback(`${playerName(winnerId)} wins!`);

    // Winner stays on — loser goes to back of queue, next challenger steps up
    if (challengerQueue.length > 0) {
      const [nextChallenger, ...restOfQueue] = challengerQueue;
      setPlayer1Id(winnerId);
      setPlayer2Id(nextChallenger);
      setChallengerQueue([...restOfQueue, loserId]);
    } else {
      setPlayer1Id(winnerId);
      setPlayer2Id(loserId);
    }
    refresh();
  };

  const handleNewMatchup = () => {
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
    showFeedback(`${playerName(playerId)} joined!`);
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
    showFeedback('Last frame removed');
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
            <h2 className="font-display text-gold text-xl xl:text-3xl 2xl:text-4xl mb-3 xl:mb-6">This Month</h2>
            <div className="flex flex-col gap-2 xl:gap-4">
              {monthlyLeaderboard.map((entry, i) => {
                const medal = i === 0 ? 'text-gold glow-gold' : i === 1 ? 'text-silver' : i === 2 ? 'text-bronze' : 'text-chalk-dim';
                return (
                  <div key={entry.name} className="flex items-center justify-between px-2 py-1 xl:px-4 xl:py-3">
                    <div className="flex items-center gap-3 xl:gap-5">
                      <span className={`text-lg xl:text-3xl 2xl:text-4xl font-bold w-6 xl:w-12 text-center score-num ${medal}`}>{i + 1}</span>
                      <span className="text-chalk text-lg xl:text-2xl 2xl:text-3xl chalk-text">{entry.name}</span>
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

        {players.length === 0 ? (
          <p className="text-chalk-dim text-lg xl:text-2xl text-center py-8">
            No players yet. Add some on the Players tab.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:gap-4">
              {players.map(p => {
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
                    {p.name}
                  </button>
                );
              })}
            </div>
            <p className="text-chalk-dim text-base xl:text-xl text-center">
              Tap in playing order. #1 and #2 play first.
            </p>
          </>
        )}

        {/* Record option on picker screen */}
        <button
          onClick={toggleRecording}
          className={`btn-press w-full py-4 xl:py-6 panel text-lg xl:text-2xl font-semibold min-h-[56px] xl:min-h-[80px] flex items-center justify-center gap-3 xl:gap-4 ${
            recordingEnabled ? '!border-loss/60 text-loss' : 'text-chalk-dim'
          }`}
        >
          <span className={`inline-flex items-center justify-center w-6 h-6 xl:w-7 xl:h-7 rounded border-2 flex-shrink-0 ${
            recordingEnabled ? 'border-loss bg-loss/20' : 'border-chalk-dim/50'
          }`}>
            {recordingEnabled && <span className="text-loss text-sm xl:text-base font-black">&#10003;</span>}
          </span>
          Auto-Record Frames
        </button>

        {selectedPlayerIds.length >= 2 && (
          <button
            onClick={handleStartSession}
            className="btn-press w-full py-5 xl:py-8 bg-win text-board-dark text-[24px] xl:text-[40px] 2xl:text-[48px] font-bold rounded-xl min-h-[64px] xl:min-h-[96px] shadow-lg mt-2"
          >
            Start Session ({selectedPlayerIds.length} players)
          </button>
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
        <div className="fixed top-4 xl:top-8 left-1/2 -translate-x-1/2 bg-win text-board-dark font-bold text-xl xl:text-3xl 2xl:text-4xl px-8 xl:px-14 py-4 xl:py-6 rounded-xl shadow-lg z-50">
          {feedback}
        </div>
      )}

      {/* ── Header Bar ── */}
      <div className="panel-wood !rounded-none !border-x-0 !border-t-0 border-b-2 border-trim-light px-4 py-3 xl:px-8 xl:py-5 2xl:px-10 2xl:py-6 flex items-center flex-shrink-0 relative">
        <div className="flex items-center gap-3 xl:gap-5">
          <span className="bg-gold text-board-dark font-black text-sm xl:text-xl 2xl:text-2xl px-2 py-1 xl:px-4 xl:py-2 rounded">8 BALL</span>
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
          <span className="ml-3 xl:ml-6">Frames: <span className="text-chalk font-bold score-num">{totalFrames}</span></span>
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
                  className="btn-press w-full min-h-[72px] xl:min-h-[120px] py-4 xl:py-8 px-6 xl:px-10 panel text-[28px] xl:text-[48px] 2xl:text-[60px] font-bold text-chalk"
                >
                  {playerName(pid)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selecting Player 2 */}
        {matchStep === 'pickPlayer2' && player1Id !== null && (
          <div className="w-full max-w-lg xl:max-w-3xl 2xl:max-w-5xl flex flex-col items-center gap-4 xl:gap-6">
            <p className="text-gold text-2xl xl:text-5xl 2xl:text-6xl font-bold glow-gold">{playerName(player1Id)}</p>
            <p className="text-chalk-dim text-xl xl:text-3xl uppercase tracking-widest font-display">v</p>
            <p className="text-chalk-dim text-xl xl:text-3xl 2xl:text-4xl uppercase tracking-widest font-display">Select Player 2</p>
            <div className="w-full flex flex-col gap-3 xl:gap-5">
              {activeSession?.playerIds
                .filter(pid => pid !== player1Id)
                .map(pid => (
                  <button
                    key={pid}
                    onClick={() => handleSelectPlayer2(pid)}
                    className="btn-press w-full min-h-[72px] xl:min-h-[120px] py-4 xl:py-8 px-6 xl:px-10 panel text-[28px] xl:text-[48px] 2xl:text-[60px] font-bold text-chalk"
                  >
                    {playerName(pid)}
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

            {/* Tap the winner */}
            <p className="text-chalk-dim text-sm xl:text-xl 2xl:text-2xl uppercase tracking-widest mb-2 xl:mb-4">Tap the winner</p>

            <div className="w-full flex items-center justify-center gap-4 xl:gap-8">
              {/* Player 1 - tap to win */}
              <button
                onClick={() => handleRecordWinner(player1Id)}
                className="btn-press flex-1 max-w-[45%] py-8 xl:py-14 2xl:py-18 panel !border-2 !border-board-light active:!border-win"
              >
                <span className="text-[clamp(28px,5vw,100px)] font-black text-chalk chalk-text block text-center leading-tight">
                  {playerName(player1Id)}
                </span>
              </button>

              <span className="text-chalk-dim text-[clamp(24px,3vw,72px)] font-bold font-display">v</span>

              {/* Player 2 - tap to win */}
              <button
                onClick={() => handleRecordWinner(player2Id)}
                className="btn-press flex-1 max-w-[45%] py-8 xl:py-14 2xl:py-18 panel !border-2 !border-board-light active:!border-win"
              >
                <span className="text-[clamp(28px,5vw,100px)] font-black text-chalk chalk-text block text-center leading-tight">
                  {playerName(player2Id)}
                </span>
              </button>
            </div>

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

            {/* Next up queue */}
            {challengerQueue.length > 0 && (
              <div className="mt-3 xl:mt-6 flex items-center gap-2 xl:gap-4 flex-wrap justify-center">
                <span className="text-chalk-dim text-base xl:text-xl 2xl:text-2xl uppercase tracking-wider font-display">Next up:</span>
                {challengerQueue.map((pid, i) => (
                  <span key={pid} className={`text-base xl:text-xl 2xl:text-2xl font-semibold ${i === 0 ? 'text-gold glow-gold' : 'text-chalk-dim'}`}>
                    {playerName(pid)}{i < challengerQueue.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Change matchup button */}
            <button
              onClick={handleNewMatchup}
              className="btn-press mt-3 xl:mt-6 px-6 xl:px-10 py-3 xl:py-5 panel-wood text-chalk-dim text-lg xl:text-2xl font-semibold min-h-[56px] xl:min-h-[80px]"
            >
              Change Players
            </button>

          </div>
        )}

        {/* PiP Camera Preview */}
        {recordingEnabled && obsStatus.connected && (
          <button
            onClick={() => navigate('/camera')}
            className="btn-press absolute top-2 right-2 xl:top-4 xl:right-4 w-32 h-20 xl:w-44 xl:h-26 panel !border-2 overflow-hidden z-30 p-0 shadow-lg"
            style={{ borderColor: obsStatus.recording ? 'rgba(239,68,68,0.6)' : 'rgba(212,175,55,0.4)' }}
          >
            {pipSrc ? (
              <img src={pipSrc} alt="OBS" className="w-full h-full object-cover" />
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
                    className="btn-press py-3 xl:py-5 px-5 xl:px-8 panel text-chalk text-lg xl:text-2xl font-semibold min-h-[48px] xl:min-h-[72px]"
                  >
                    {p.name}
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
                <span className="text-chalk font-semibold text-base xl:text-xl 2xl:text-2xl truncate chalk-text">{p.name}</span>
                <span className="text-gold font-black text-xl xl:text-3xl 2xl:text-4xl score-num">{p.frames}</span>
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

            {confirmEnd ? (
              <>
                <button
                  onClick={handleEndSession}
                  className="btn-press py-2 xl:py-3 px-3 xl:px-5 bg-loss text-board-dark text-sm xl:text-lg font-bold rounded-lg min-h-[40px] xl:min-h-[56px]"
                >
                  Confirm End
                </button>
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-bold min-h-[40px] xl:min-h-[56px]"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                className="btn-press py-2 xl:py-3 px-3 xl:px-5 panel text-chalk-dim text-sm xl:text-lg font-semibold min-h-[40px] xl:min-h-[56px]"
              >
                End Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
