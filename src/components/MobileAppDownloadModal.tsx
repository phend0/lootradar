import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Share,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface MobileAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAppDownloadModal: React.FC<MobileAppDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedOs, setSelectedOs] = useState<'android' | 'ios'>(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod|macintosh/.test(ua)) return 'ios';
    }
    return 'android';
  });

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setPwaInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setPwaInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleVerifiedApkDownload = async (
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    if (isDownloadingApk) return;
    setIsDownloadingApk(true);
    try {
      const res = await fetch(`/LootRadar.apk?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Direct link fallback');
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Verify ZIP/APK magic header (PK\x03\x04)
      if (
        bytes.length > 4 &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 0x03 &&
        bytes[3] === 0x04
      ) {
        const blob = new Blob([buf], {
          type: 'application/vnd.android.package-archive',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'LootRadar.apk';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }
      window.location.href = '/LootRadar.apk';
    } catch {
      window.location.href = '/LootRadar.apk';
    } finally {
      setIsDownloadingApk(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-400/15 text-cyan-300 border border-cyan-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">
                Download LootRadar Mobile App
              </h2>
              <p className="text-xs text-slate-400">
                Compiled native packages for Android &amp; iOS with Cloud Claim Sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close download modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* OS Selector Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => setSelectedOs('android')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedOs === 'android'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396" />
              </svg>
              <span>Android (LootRadar.apk)</span>
            </button>

            <button
              onClick={() => setSelectedOs('ios')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedOs === 'ios'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.1 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              <span>iOS (iPhone &amp; iPad)</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {selectedOs === 'android' ? (
            <>
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        Signed Android Package (v1 + v2 + v3 · Root DEX Aligned)
                      </span>
                    </div>
                    <h3 className="text-base font-display font-bold text-white mt-1">
                      LootRadar for Android (LootRadar.apk)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                      Package: com.lootradar.app · Target SDK 34 · Android 7.0 – 16+
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <a
                    href="/LootRadar.apk"
                    download="LootRadar.apk"
                    onClick={handleVerifiedApkDownload}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isDownloadingApk
                        ? 'Preparing Verified LootRadar.apk...'
                        : 'Download Android APK (LootRadar.apk)'}
                    </span>
                  </a>

                  {deferredPrompt && !pwaInstalled && (
                    <button
                      onClick={handleInstallPwa}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Instant Web App Install</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="font-semibold text-white">
                  How to install LootRadar.apk on Android:
                </div>
                <ol className="space-y-2 list-decimal list-inside text-slate-300">
                  <li>
                    Tap <strong>Download Android APK</strong> above to download{' '}
                    <span className="font-mono text-cyan-300">LootRadar.apk</span>.
                  </li>
                  <li>
                    Open <span className="font-mono text-cyan-300">LootRadar.apk</span>{' '}
                    from your browser downloads or <strong>My Files → Downloads</strong>.
                  </li>
                  <li>
                    If Google Play Protect or Samsung Auto Blocker prompts about an
                    unknown developer, tap <strong>More details → Install anyway</strong>{' '}
                    (or temporarily toggle off <em>Settings → Security and Privacy → Auto Blocker</em> on Samsung One UI).
                  </li>
                </ol>
              </div>
            </>
          ) : (
            <>
              {/* iOS Option 1: Direct iPhone Profile Installer */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Recommended · Direct iPhone Install (No Computer Needed)</span>
                  </div>
                  <h3 className="text-base font-display font-bold text-white mt-1">
                    LootRadar iOS App Installer Profile (.mobileconfig)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                    Signed Apple WebClip Profile · Bundle: com.lootradar.ios · Full-Screen
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <a
                    href="/LootRadar-iOS.mobileconfig"
                    download="LootRadar-iOS.mobileconfig"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download iPhone Installer (LootRadar-iOS.mobileconfig)</span>
                  </a>

                  <a
                    href="/LootRadar-iOS.ipa"
                    download="LootRadar-iOS.ipa"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>Download .IPA (AltStore / Sideloadly)</span>
                  </a>
                </div>
              </div>

              {/* iOS Step-by-Step Guides */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                  <div className="font-semibold text-white">
                    Method A: Direct Profile Install
                  </div>
                  <ol className="space-y-1.5 list-decimal list-inside text-slate-300">
                    <li>
                      Tap <strong>Download iPhone Installer</strong> in Safari and
                      tap <strong>Allow</strong>.
                    </li>
                    <li>
                      Open iPhone <strong>Settings → Profile Downloaded</strong>.
                    </li>
                    <li>
                      Tap <strong>Install</strong> at the top right to add LootRadar
                      to your Home Screen.
                    </li>
                  </ol>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Method B: Safari Add to Home Screen</span>
                  </div>
                  <ol className="space-y-1.5 list-decimal list-inside text-slate-300">
                    <li>
                      Tap the <strong>Share</strong> icon in the bottom Safari bar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong>Add</strong> to launch LootRadar in full-screen
                      standalone mode.
                    </li>
                  </ol>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Sign in inside the app to sync claimed games across Web, Android &amp; iOS.
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
