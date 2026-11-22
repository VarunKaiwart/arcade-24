import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AVATAR_PRESETS, DEFAULT_AVATAR_ID } from '../../shared/avatars.ts';
import { Avatar } from '../components/common/Avatar.tsx';
import { useAuth } from '../providers/AuthProvider.tsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your email or username and your password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await login(identifier.trim(), password);
      if (res.activeMatchId) {
        navigate(`/match/${res.activeMatchId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-14 sm:px-6">
      <div className="rounded-xl border border-white/10 bg-[#101524] p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-white">Sign in to DuelZone</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Access matchmaking, private rooms, and your progression record.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="login-identifier" className="block text-sm font-medium text-slate-200">
              Email or Username
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="player@example.com or handle"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/10 bg-[#080B14] py-2.5 pl-3.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New to DuelZone?{' '}
          <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim();

    if (trimmedUser.length < 3 || trimmedUser.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
      setError('Username must be 3–20 characters using letters, numbers, underscores, or hyphens.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include at least one letter and one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register({
        username: trimmedUser,
        email: trimmedEmail,
        password,
        avatar,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-white/10 bg-[#101524] p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-white">Create your DuelZone account</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Pick a handle and emblem to start competing in live 1v1 matches.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="reg-username" className="block text-sm font-medium text-slate-200">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. NovaStrike"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">3–20 characters · letters, numbers, _ or -</p>
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-200">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  className="w-full rounded-lg border border-white/10 bg-[#080B14] py-2.5 pl-3.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-200">
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#080B14] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            At least 8 characters including a letter and a number.
          </p>

          <div>
            <span className="block text-sm font-medium text-slate-200">Choose Avatar Emblem</span>
            <div className="mt-2 grid grid-cols-4 gap-2.5">
              {AVATAR_PRESETS.map((preset) => {
                const selected = avatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatar(preset.id)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
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
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
