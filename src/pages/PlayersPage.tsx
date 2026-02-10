import { useState, useEffect, useCallback } from 'react';
import type { Player } from '../db/dexie';
import {
  getAllPlayers,
  addPlayer,
  renamePlayer,
  archivePlayer,
  restorePlayer,
  deletePlayer,
} from '../db/services';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function PlayersPage() {
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [archivedPlayers, setArchivedPlayers] = useState<Player[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await getAllPlayers();
    setActivePlayers(all.filter((p) => !p.archived));
    setArchivedPlayers(all.filter((p) => p.archived));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addPlayer(trimmed);
    setNewName('');
    setShowAddForm(false);
    refresh();
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await renamePlayer(id, trimmed);
    setRenamingId(null);
    setRenameValue('');
    refresh();
  }

  async function handleArchive(id: string) {
    await archivePlayer(id);
    setConfirmArchiveId(null);
    refresh();
  }

  async function handleRestore(id: string) {
    await restorePlayer(id);
    refresh();
  }

  async function handleDelete(id: string) {
    try {
      await deletePlayer(id);
      setConfirmDeleteId(null);
      setDeleteError(null);
      refresh();
    } catch {
      setDeleteError('Cannot delete — this player has match history. They can only be archived.');
    }
  }

  return (
    <div className="max-w-lg xl:max-w-3xl 2xl:max-w-4xl mx-auto">
      <h1 className="font-display text-3xl xl:text-5xl 2xl:text-6xl text-chalk chalk-text mb-6 xl:mb-10">Players</h1>

      {/* Add Player */}
      {showAddForm ? (
        <div className="mb-6 xl:mb-10 panel p-4 xl:p-8">
          <label className="block text-chalk-dim text-sm xl:text-lg mb-2 xl:mb-3 uppercase tracking-wider">Player name</label>
          <input
            type="text"
            inputMode="none"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') {
                setShowAddForm(false);
                setNewName('');
              }
            }}
            placeholder="Enter name..."
            className="w-full px-4 py-3 xl:px-6 xl:py-5 rounded-lg bg-board-dark border border-board-light text-chalk text-lg xl:text-2xl placeholder-chalk-dim"
          />
          <VirtualKeyboard
            value={newName}
            onChange={setNewName}
            onDone={handleAdd}
            onCancel={() => {
              setShowAddForm(false);
              setNewName('');
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-press w-full min-h-[64px] xl:min-h-[96px] mb-6 xl:mb-10 rounded-xl bg-gold text-board-dark font-bold text-xl xl:text-3xl shadow-md"
        >
          + Add Player
        </button>
      )}

      {/* Active Players */}
      {activePlayers.length === 0 && !showAddForm && (
        <p className="text-chalk-dim text-center text-lg xl:text-2xl py-8 xl:py-12">
          No players yet. Add one to get started.
        </p>
      )}

      <div className="space-y-2 xl:space-y-4">
        {activePlayers.map((player) => (
          <div
            key={player.id}
            className="panel p-4 xl:p-6"
          >
            {/* Rename mode */}
            {renamingId === player.id ? (
              <div>
                <input
                  type="text"
                  inputMode="none"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(player.id!);
                    if (e.key === 'Escape') {
                      setRenamingId(null);
                      setRenameValue('');
                    }
                  }}
                  className="w-full px-4 py-3 xl:px-6 xl:py-5 rounded-lg bg-board-dark border border-board-light text-chalk text-lg xl:text-2xl placeholder-chalk-dim"
                />
                <VirtualKeyboard
                  value={renameValue}
                  onChange={setRenameValue}
                  onDone={() => handleRename(player.id!)}
                  onCancel={() => {
                    setRenamingId(null);
                    setRenameValue('');
                  }}
                />
              </div>
            ) : confirmArchiveId === player.id ? (
              /* Archive confirmation */
              <div>
                <p className="text-chalk text-lg xl:text-2xl mb-3 xl:mb-5">
                  Archive <span className="font-bold text-gold">{player.name}</span>?
                </p>
                <div className="flex gap-3 xl:gap-5">
                  <button
                    onClick={() => handleArchive(player.id!)}
                    className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-loss text-white font-bold text-lg xl:text-2xl"
                  >
                    Yes, Archive
                  </button>
                  <button
                    onClick={() => setConfirmArchiveId(null)}
                    className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-board-light text-chalk-dim font-bold text-lg xl:text-2xl"
                  >
                    No, Keep
                  </button>
                </div>
              </div>
            ) : (
              /* Normal display */
              <div className="flex items-center justify-between gap-3 xl:gap-5">
                <span className="text-[28px] xl:text-[44px] 2xl:text-[52px] font-semibold text-chalk chalk-text truncate flex-1">
                  {player.name}
                </span>
                <div className="flex gap-2 xl:gap-4 shrink-0">
                  <button
                    onClick={() => {
                      setRenamingId(player.id!);
                      setRenameValue(player.name);
                      setConfirmArchiveId(null);
                    }}
                    className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-4 xl:px-6 rounded-lg bg-board-light text-chalk-dim font-semibold text-base xl:text-xl border border-board-light"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      setConfirmArchiveId(player.id!);
                      setRenamingId(null);
                    }}
                    className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-4 xl:px-6 rounded-lg bg-board-light text-loss font-semibold text-base xl:text-xl border border-board-light"
                  >
                    Archive
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Archived Players */}
      {archivedPlayers.length > 0 && (
        <div className="mt-8 xl:mt-12">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="btn-press w-full min-h-[64px] xl:min-h-[96px] rounded-xl panel-wood !border-trim-light text-chalk-dim font-semibold text-lg xl:text-2xl flex items-center justify-center gap-2"
          >
            <span
              className="inline-block transition-transform"
              style={{ transform: showArchived ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              &#9654;
            </span>
            Archived ({archivedPlayers.length})
          </button>

          {showArchived && (
            <div className="mt-2 xl:mt-4 space-y-2 xl:space-y-4">
              {archivedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="panel p-4 xl:p-6 opacity-70"
                >
                  {confirmDeleteId === player.id ? (
                    <div>
                      <p className="text-chalk text-lg xl:text-2xl mb-3 xl:mb-5">
                        Permanently delete <span className="font-bold text-gold">{player.name}</span>?
                      </p>
                      {deleteError && (
                        <p className="text-loss text-sm xl:text-lg mb-3 xl:mb-5">{deleteError}</p>
                      )}
                      <div className="flex gap-3 xl:gap-5">
                        <button
                          onClick={() => handleDelete(player.id!)}
                          className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-loss text-white font-bold text-lg xl:text-2xl"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                          className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-board-light text-chalk-dim font-bold text-lg xl:text-2xl"
                        >
                          No, Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 xl:gap-5">
                      <span className="text-[28px] xl:text-[44px] 2xl:text-[52px] font-semibold text-chalk-dim truncate flex-1">
                        {player.name}
                      </span>
                      <div className="flex gap-2 xl:gap-4 shrink-0">
                        <button
                          onClick={() => handleRestore(player.id!)}
                          className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-5 xl:px-8 rounded-lg bg-win text-board-dark font-bold text-base xl:text-xl"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(player.id!); setDeleteError(null); }}
                          className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-5 xl:px-8 rounded-lg bg-board-light text-loss font-bold text-base xl:text-xl border border-board-light"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
