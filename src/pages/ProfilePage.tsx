import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AVATAR_PRESETS } from '../../shared/avatars.ts';
import {
  GAME_METADATA,
  type GameType,
  type MatchHistoryItem,
  type PlayerStats,
  type PublicUser,
} from '../../shared/types.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { GameEmblem } from '../components/common/GameEmblem.tsx';
import { RankBadge } from '../components/common/RankBadge.tsx';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews.tsx';
import { XpProgress } from '../components/common/XpProgress.tsx';
import { api } from '../lib/api.ts';
import { useAuth } from '../providers/AuthProvider.tsx';

const GAMES: GameType[] = ['TICTACTOE', 'RPS', 'CONNECT_FOUR'];

export function ProfilePage() {
  const { username: routeUsername } = useParams<{ username?: string }>();
  const { user, stats: ownStats, setUserAndStats, refreshStats } = useAuth();

  const isOwnProfile =
    !routeUsername || (user !== null && routeUsername.toLowerCase() === user.username.toLowerCase());

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit profile form state
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isOwnProfile && user) {
        await refreshStats();
        const history = await api.getMatchHistory({ page: 1, limit: 6 });
        setProfile(user);
        setStats(ownStats);
        setRecentMatches(history.items);
        setEditUsername(user.username);
        setEditAvatar(user.avatar);
        setEditBio(user.bio);
      } else if (routeUsername) {
        const data = await api.getPublicProfile(routeUsername);
        setProfile(data.profile);
        setStats(data.stats);
        setRecentMatches(data.recentMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load player profile.');
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, user, routeUsername, ownStats, refreshStats]);

  useEffect(() => {
    void loadProfile();
  }, [routeUsername, user?.id]);

  useEffect(() => {
    if (isOwnProfile && user) {
      setProfile(user);
      if (ownStats) setStats(ownStats);
    }
  }, [isOwnProfile, user, ownStats]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await api.updateProfile({
        username: editUsername.trim(),
        avatar: editAvatar,
        bio: editBio.trim(),
      });
      setUserAndStats(updated.user, updated.stats);
      setProfile(updated.user);
      setStats(updated.stats);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg({
        type: 'success',
        text: 'Password updated. Other active sessions have been signed out.',
      });
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not change password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <LoadingState label="Loading player profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <ErrorState message={error || 'Player not found.'} onRetry={() => void loadProfile()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {/* Player Profile Header */}
      <section className="rounded-xl border border-white/10 bg-[#101524] p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar avatarId={profile.avatar} username={profile.username} size="xl" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-white">{profile.username}</h1>
                <RankBadge rank={stats?.rank ?? 'Bronze'} showLabel />
              </div>
              <p className="text-xs text-slate-400">
                Joined {new Date(profile.createdAt).toLocaleDateString()}
                {isOwnProfile && user ? ` · ${user.email}` : ''}
              </p>
              {profile.bio && (
                <p className="max-w-lg text-sm leading-relaxed text-slate-300">{profile.bio}</p>
              )}
            </div>
          </div>

          <div className="md:w-72">
            <XpProgress
              level={stats?.level ?? 1}
              currentLevelXp={stats?.currentLevelXp ?? 0}
              nextLevelXp={stats?.nextLevelXp ?? 500}
              totalXp={stats?.totalXp ?? 0}
            />
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-5">
          <div>
            <div className="text-xs text-slate-400">Total XP</div>
            <div className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
              {(stats?.totalXp ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Matches</div>
            <div className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
              {stats?.totalMatches ?? 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Wins</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-400 tabular-nums">
              {stats?.wins ?? 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Losses / Draws</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-200 tabular-nums">
              {stats?.losses ?? 0} / {stats?.draws ?? 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className="mt-1 font-mono text-xl font-bold text-indigo-300 tabular-nums">
              {stats?.winRate ?? 0}%
            </div>
          </div>
        </div>
      </section>

      {/* Per-Game Statistics */}
      <section>
        <h2 className="font-display text-lg font-bold text-white">Per-Game Breakdown</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {GAMES.map((gameId) => {
            const g = stats?.perGame[gameId] ?? { matches: 0, wins: 0, losses: 0, draws: 0 };
            const rate = g.matches > 0 ? Math.round((g.wins / g.matches) * 1000) / 10 : 0;
            return (
              <div
                key={gameId}
                className="rounded-xl border border-white/10 bg-[#101524] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GameEmblem gameType={gameId} className="h-9 w-9" />
                    <span className="font-display text-base font-semibold text-white">
                      {GAME_METADATA[gameId].name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-indigo-300 tabular-nums">{rate}% WR</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-3 text-center font-mono text-xs tabular-nums">
                  <div>
                    <div className="text-slate-500">Played</div>
                    <div className="mt-0.5 text-sm font-semibold text-white">{g.matches}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Wins</div>
                    <div className="mt-0.5 text-sm font-semibold text-emerald-400">{g.wins}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Losses</div>
                    <div className="mt-0.5 text-sm font-semibold text-rose-400">{g.losses}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Draws</div>
                    <div className="mt-0.5 text-sm font-semibold text-cyan-300">{g.draws}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Matches + Own Account Settings */}
      <div className="grid gap-8 lg:grid-cols-12">
        <section className={isOwnProfile ? 'lg:col-span-6 space-y-4' : 'lg:col-span-12 space-y-4'}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Recent Matches</h2>
            {isOwnProfile && (
              <Link to="/history" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                Full History →
              </Link>
            )}
          </div>

          {recentMatches.length === 0 ? (
            <EmptyState
              title="No recent matches"
              description="Completed games will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101524] divide-y divide-white/10">
              {recentMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GameEmblem gameType={m.gameType} className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">
                        vs {m.opponent?.username ?? 'Opponent'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {GAME_METADATA[m.gameType].name} ·{' '}
                        {new Date(m.completedAt || m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-semibold ${
                        m.outcomeForUser === 'WIN'
                          ? 'text-emerald-400'
                          : m.outcomeForUser === 'LOSS'
                            ? 'text-rose-400'
                            : 'text-cyan-300'
                      }`}
                    >
                      {m.outcomeForUser}
                    </div>
                    <div className="font-mono text-xs text-slate-400 tabular-nums">
                      +{m.xpEarned} XP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isOwnProfile && user && (
          <section className="lg:col-span-6 space-y-6">
            {/* Edit Profile Form */}
            <form
              onSubmit={handleSaveProfile}
              className="rounded-xl border border-white/10 bg-[#101524] p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-white">Edit Profile</h2>

              {profileMsg && (
                <div
                  role={profileMsg.type === 'error' ? 'alert' : 'status'}
                  className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                    profileMsg.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {profileMsg.text}
                </div>
              )}

              <div>
                <label htmlFor="edit-username" className="block text-sm font-medium text-slate-200">
                  Username
                </label>
                <input
                  id="edit-username"
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2 text-sm text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="edit-bio" className="block text-sm font-medium text-slate-200">
                  Short Bio
                </label>
                <textarea
                  id="edit-bio"
                  rows={2}
                  maxLength={160}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Optional player tagline..."
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-slate-200">Avatar Emblem</span>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {AVATAR_PRESETS.map((preset) => {
                    const selected = editAvatar === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEditAvatar(preset.id)}
                        aria-pressed={selected}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                          selected
                            ? 'border-indigo-400 bg-indigo-500/15'
                            : 'border-white/10 bg-[#080B14] hover:border-white/25'
                        }`}
                      >
                        <Avatar avatarId={preset.id} size="sm" />
                        <span className="w-full truncate text-center text-[11px] text-slate-300">
                          {preset.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>

            {/* Change Password Form (FR-AUTH-09) */}
            <form
              onSubmit={handleChangePassword}
              className="rounded-xl border border-white/10 bg-[#101524] p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-white">Change Password</h2>

              {passwordMsg && (
                <div
                  role={passwordMsg.type === 'error' ? 'alert' : 'status'}
                  className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                    passwordMsg.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div>
                <label htmlFor="cur-pw" className="block text-sm font-medium text-slate-200">
                  Current Password
                </label>
                <input
                  id="cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2 text-sm text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="new-pw" className="block text-sm font-medium text-slate-200">
                  New Password
                </label>
                <input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 8 chars, letters & numbers"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword}
                className="rounded-lg border border-white/15 bg-[#161D31] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
