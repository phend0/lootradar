import React from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isNativeApk, install } = usePWAInstall();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[90vh] flex flex-col">
        {/* Top Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-cyan-950/90 via-slate-900 to-emerald-950/70 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-cyan-300">
                Android Package Build • Samsung Galaxy S26 Ultra Ready
              </div>
              <h2
                id="apk-modal-title"
                className="text-xl font-display font-bold text-white"
              >
                Install LootRadar on Samsung S26 Ultra
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Primary APK Download Card */}
          <div className="p-5 rounded-xl bg-[#0B0F19] border border-cyan-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Signed V1 + V2 + V3 Release APK</span>
                </div>
                <h3 className="text-lg font-display font-bold text-white">
                  LootRadar-S26Ultra.apk
                </h3>
                <p className="text-xs text-slate-400">
                  Package: <span className="font-mono text-slate-300">com.lootradar.s26ultra</span> • Universal arm64-v8a • Bundled Offline UI + Live Epic / Steam / GOG / itch.io Direct Feed Bridge
                </p>
              </div>

              <a
                href="/LootRadar-S26Ultra.apk"
                download="LootRadar-S26Ultra.apk"
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm transition-colors shrink-0 shadow-lg shadow-cyan-500/10"
              >
                <Download className="w-4 h-4" />
                <span>Download APK</span>
              </a>
            </div>

            {/* Optional One-Tap WebAPK Install if browser supports beforeinstallprompt */}
            {isInstallable && !isInstalled && (
              <div className="pt-3 border-t border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-cyan-300">
                    Instant Browser WebAPK:
                  </span>{' '}
                  Install directly to your Samsung One UI home screen with zero sideload prompts.
                </div>
                <button
                  onClick={install}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>One-Tap PWA Install</span>
                </button>
              </div>
            )}

            {(isInstalled || isNativeApk) && (
              <div className="pt-3 border-t border-slate-800/90 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isNativeApk
                    ? 'Running natively inside the LootRadar Samsung S26 Ultra Android APK.'
                    : 'LootRadar is currently installed in standalone mode on this device.'}
                </span>
              </div>
            )}
          </div>

          {/* Technical Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Target Device
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                Galaxy S26 Ultra
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Display Mode
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                QHD+ 120Hz Full
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Store Sync
              </div>
              <div className="mt-1 text-sm font-semibold text-emerald-400">
                Native Bridge
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Signature
              </div>
              <div className="mt-1 text-sm font-semibold text-cyan-300">
                APK Signature v2/v3
              </div>
            </div>
          </div>

          {/* Step-by-Step S26 Ultra Installation Guide */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Samsung Galaxy S26 Ultra (One UI 7 / Android 15+) Installation Steps
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-400/15 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <span className="font-semibold text-white">
                    Download LootRadar-S26Ultra.apk:
                  </span>{' '}
                  Tap the <span className="text-cyan-300 font-medium">Download APK</span> button above on your phone (or transfer the downloaded <span className="font-mono">.apk</span> file to your S26 Ultra).
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-400/15 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <span className="font-semibold text-white">
                     Samsung Auto Blocker & Unknown Apps Check:
                  </span>{' '}
                  On Samsung Galaxy S26 Ultra (One UI 7), if <span className="text-slate-100 font-medium">Auto Blocker</span> is active, open <span className="font-mono text-slate-200">Settings → Security and Privacy → Auto Blocker</span> and toggle it off temporarily during APK installation, then allow <span className="font-mono text-slate-200">Install unknown apps</span> for Chrome / My Files.
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-400/15 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <span className="font-semibold text-white">
                    Launch LootRadar from Your App Drawer:
                  </span>{' '}
                  Open <span className="text-white font-medium">LootRadar</span> to track live 100% free giveaways across Epic Games Store, Steam, GOG, Prime Gaming, and itch.io with direct one-tap store claim links.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0B0F19] border-t border-slate-800 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Direct Endpoint:{' '}
            <a
              href="/LootRadar-S26Ultra.apk"
              download="LootRadar-S26Ultra.apk"
              className="font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
            >
              /LootRadar-S26Ultra.apk
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
