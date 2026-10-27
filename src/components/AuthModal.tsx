import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  KeyRound,
  LogOut,
  Mail,
  Server,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  User,
  detectProviderKind,
  loginWithEmailPassword,
  registerWithEmailPassword,
  sendAccountPasswordReset,
  signInWithGooglePopup,
  signOutAccount,
} from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: User | null;
  claimedCount: number;
  totalSavedUsd: number;
  isSyncingCloud: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentUser,
  claimedCount,
  totalSavedUsd,
  isSyncingCloud,
  onClose,
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | 'reset'>(
    'signup'
  );
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsConsoleEnable, setNeedsConsoleEnable] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatFirebaseError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    setNeedsConsoleEnable(false);

    if (raw.includes('auth/operation-not-allowed')) {
      setNeedsConsoleEnable(true);
      return 'Email/Password sign-up needs to be toggled ON in your Firebase Authentication Console (takes 10 seconds).';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Switch to "Sign In with Email" below.';
    }
    if (
      raw.includes('auth/invalid-credential') ||
      raw.includes('auth/wrong-password') ||
      raw.includes('auth/user-not-found')
    ) {
      return 'Invalid email or password. Please check your credentials or create an account.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password must be at least 6 characters long.';
    }
    if (raw.includes('auth/popup-closed-by-user')) {
      return 'Sign-in popup was closed before completing authentication.';
    }
    return raw.replace('Firebase: ', '');
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setStatusNotice(null);
    setIsLoading(true);
    try {
      const user = await signInWithGooglePopup();
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusNotice(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (authMode === 'reset') {
      setIsLoading(true);
      try {
        await sendAccountPasswordReset(cleanEmail);
        setStatusNotice(
          `Password reset link sent to ${cleanEmail}. Check your inbox.`
        );
      } catch (err) {
        setErrorMsg(formatFirebaseError(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        const user = await registerWithEmailPassword(
          displayName || cleanEmail.split('@')[0],
          cleanEmail,
          password
        );
        onAuthSuccess(user);
      } else {
        const user = await loginWithEmailPassword(cleanEmail, password);
        onAuthSuccess(user);
      }
    } catch (err) {
      setErrorMsg(formatFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutAccount();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const firebaseProvidersUrl =
    'https://console.firebase.google.com/project/gen-lang-client-0700368021/authentication/providers';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-400/15 text-cyan-300 border border-cyan-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">
                {currentUser
                  ? 'LootRadar Cloud Account'
                  : 'Create Account or Sign In'}
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser
                  ? 'Synced with Firebase Cloud Firestore across Web, Android & iOS'
                  : 'Sync your claimed free games & alerts across all your devices'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close account modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {currentUser ? (
            <div className="space-y-5">
              {/* Signed-In Profile Card */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-display font-bold text-base shrink-0">
                      {(currentUser.displayName || currentUser.email || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-display font-bold text-white truncate">
                        {currentUser.displayName || 'LootRadar Member'}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSyncingCloud ? 'Syncing...' : 'Cloud Synced'}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-center">
                  <div>
                    <div className="text-xs text-slate-400">Claimed Games</div>
                    <div className="text-lg font-mono font-bold tabular-nums text-white mt-0.5">
                      {claimedCount}
                    </div>
                  </div>
                  <div className="border-x border-slate-800/80">
                    <div className="text-xs text-slate-400">Total Saved</div>
                    <div className="text-lg font-mono font-bold tabular-nums text-emerald-400 mt-0.5">
                      ${totalSavedUsd.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Auth Method</div>
                    <div className="text-xs font-semibold text-cyan-300 uppercase mt-1.5">
                      {detectProviderKind(currentUser) === 'google'
                        ? 'Google / Gmail'
                        : 'Email & Password'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cloud Hosting & Database Persistence Info */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Where Your User Database Is Hosted</span>
                </div>
                <p className="leading-relaxed text-slate-300">
                  Your user accounts and claimed game records are stored permanently
                  in <strong>Google Cloud Firestore</strong> (Project:{' '}
                  <span className="font-mono text-cyan-300">
                    gen-lang-client-0700368021
                  </span>
                  ). Whether you deploy this app via <strong>Google Cloud Run</strong>,{' '}
                  <strong>Render</strong>, <strong>Railway</strong>, or use the
                  compiled Android/iOS mobile apps, every user’s claimed games
                  persist automatically in the same cloud database.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  Continue to Radar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Quick OAuth Provider: Google (Gmail) */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>Continue with Google (Gmail)</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-800" />
                <span className="shrink-0 px-3 text-xs text-slate-400">
                  or use Email &amp; Password
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMsg(null);
                    setStatusNotice(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Email Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMsg(null);
                    setStatusNotice(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    authMode === 'signin' || authMode === 'reset'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In with Email
                </button>
              </div>

              {/* Error / Setup Notice */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                  {needsConsoleEnable && (
                    <div className="pt-1 pl-6 space-y-1.5 text-slate-300">
                      <p>
                        To enable <strong>Email/Password</strong> sign-in in your
                        Firebase project:
                      </p>
                      <a
                        href={firebaseProvidersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold underline"
                      >
                        <span>Open Firebase Authentication Providers</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {statusNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{statusNotice}</span>
                </div>
              )}

              {/* Universal Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Gamer tag or name"
                        maxLength={80}
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={254}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {authMode !== 'reset' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        Password
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('reset');
                            setErrorMsg(null);
                            setStatusNotice(null);
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isLoading
                    ? 'Authenticating...'
                    : authMode === 'signup'
                    ? 'Create Account & Sync Claimed Games'
                    : authMode === 'signin'
                    ? 'Sign In & Load Claimed Library'
                    : 'Send Password Reset Email'}
                </button>
              </form>

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Any games you marked as claimed while browsing are automatically
                  saved to your account upon sign-in.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
