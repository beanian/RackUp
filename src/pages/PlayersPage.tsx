import { useState, useEffect, useCallback } from 'react';
import type { Player } from '../db/supabase';
import {
  getAllPlayers,
  addPlayer,
  renamePlayer,
  archivePlayer,
  restorePlayer,
  deletePlayer,
  updatePlayerEmoji,
} from '../db/services';
import VirtualKeyboard from '../components/VirtualKeyboard';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';

export default function PlayersPage() {
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [archivedPlayers, setArchivedPlayers] = useState<Player[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('\uD83C\uDFB1');
  const [editingEmojiId, setEditingEmojiId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameEmoji, setRenameEmoji] = useState<string>('\uD83C\uDFB1');
  const [showEmojiPicker, setShowEmojiPicker] = useState<'add' | 'rename' | 'edit' | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
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
    await addPlayer(trimmed, newEmoji);
    setNewName('');
    setNewEmoji('\uD83C\uDFB1');
    setShowAddForm(false);
    refresh();
  }

  async function handleEmojiChange(playerId: number, emoji: string) {
    await updatePlayerEmoji(playerId, emoji);
    setEditingEmojiId(null);
    refresh();
  }

  async function handleRename(id: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const player = activePlayers.find(p => p.id === id);
    const originalEmoji = player?.emoji || '\uD83C\uDFB1';
    await renamePlayer(id, trimmed);
    if (renameEmoji !== originalEmoji) {
      await updatePlayerEmoji(id, renameEmoji);
    }
    setRenamingId(null);
    setRenameValue('');
    refresh();
  }

  async function handleArchive(id: number) {
    await archivePlayer(id);
    setConfirmArchiveId(null);
    refresh();
  }

  async function handleRestore(id: number) {
    await restorePlayer(id);
    refresh();
  }

  async function handleDelete(id: number) {
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
          <div className="flex items-center gap-3 xl:gap-4 mb-3">
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === 'add' ? null : 'add')}
              className="btn-press w-14 h-14 xl:w-20 xl:h-20 rounded-lg bg-board-dark border border-board-light text-3xl xl:text-5xl flex items-center justify-center shrink-0"
            >
              {newEmoji}
            </button>
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
              className="flex-1 px-4 py-3 xl:px-6 xl:py-5 rounded-lg bg-board-dark border border-board-light text-chalk text-lg xl:text-2xl placeholder-chalk-dim"
            />
          </div>
          {showEmojiPicker === 'add' && (
            <div className="mb-3">
              <EmojiPicker
                onEmojiClick={(emojiData: EmojiClickData) => {
                  setNewEmoji(emojiData.emoji);
                  setShowEmojiPicker(null);
                }}
                theme={Theme.DARK}
                width="100%"
                height={350}
                searchPlaceholder="Search emojis..."
                lazyLoadEmojis
              />
            </div>
          )}
          <VirtualKeyboard
            value={newName}
            onChange={setNewName}
            onDone={handleAdd}
            onCancel={() => {
              setShowAddForm(false);
              setNewName('');
              setShowEmojiPicker(null);
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
            {/* Rename/edit mode */}
            {renamingId === player.id ? (
              <div>
                <div className="flex items-center gap-3 xl:gap-4 mb-3">
                  <button
                    onClick={() => setShowEmojiPicker(showEmojiPicker === 'rename' ? null : 'rename')}
                    className="btn-press w-14 h-14 xl:w-20 xl:h-20 rounded-lg bg-board-dark border border-board-light text-3xl xl:text-5xl flex items-center justify-center shrink-0"
                  >
                    {renameEmoji}
                  </button>
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
                        setShowEmojiPicker(null);
                      }
                    }}
                    className="flex-1 px-4 py-3 xl:px-6 xl:py-5 rounded-lg bg-board-dark border border-board-light text-chalk text-lg xl:text-2xl placeholder-chalk-dim"
                  />
                </div>
                {showEmojiPicker === 'rename' && (
                  <div className="mb-3">
                    <EmojiPicker
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        setRenameEmoji(emojiData.emoji);
                        setShowEmojiPicker(null);
                      }}
                      theme={Theme.DARK}
                      width="100%"
                      height={350}
                      searchPlaceholder="Search emojis..."
                      lazyLoadEmojis
                    />
                  </div>
                )}
                <VirtualKeyboard
                  value={renameValue}
                  onChange={setRenameValue}
                  onDone={() => handleRename(player.id!)}
                  onCancel={() => {
                    setRenamingId(null);
                    setRenameValue('');
                    setShowEmojiPicker(null);
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 xl:gap-5">
                  <div className="flex items-center gap-3 xl:gap-4 truncate flex-1">
                    <button
                      onClick={() => setEditingEmojiId(editingEmojiId === player.id ? null : player.id!)}
                      className="btn-press text-3xl xl:text-5xl shrink-0"
                    >
                      {player.emoji || '\uD83C\uDFB1'}
                    </button>
                    <span className="text-[28px] xl:text-[44px] 2xl:text-[52px] font-semibold text-chalk chalk-text truncate">
                      {player.name}
                    </span>
                  </div>
                  <div className="flex gap-2 xl:gap-4 shrink-0">
                    <button
                      onClick={() => {
                        setRenamingId(player.id!);
                        setRenameValue(player.name);
                        setRenameEmoji(player.emoji || '\uD83C\uDFB1');
                        setConfirmArchiveId(null);
                        setEditingEmojiId(null);
                        setShowEmojiPicker(null);
                      }}
                      className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-4 xl:px-6 rounded-lg bg-board-light text-chalk-dim font-semibold text-base xl:text-xl border border-board-light"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setConfirmArchiveId(player.id!);
                        setRenamingId(null);
                        setEditingEmojiId(null);
                      }}
                      className="btn-press min-h-[64px] xl:min-h-[96px] min-w-[64px] xl:min-w-[96px] px-4 xl:px-6 rounded-lg bg-board-light text-loss font-semibold text-base xl:text-xl border border-board-light"
                    >
                      Archive
                    </button>
                  </div>
                </div>
                {editingEmojiId === player.id && (
                  <div className="pt-2 pb-1">
                    <EmojiPicker
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        handleEmojiChange(player.id!, emojiData.emoji);
                      }}
                      theme={Theme.DARK}
                      width="100%"
                      height={350}
                      searchPlaceholder="Search emojis..."
                      lazyLoadEmojis
                    />
                  </div>
                )}
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
