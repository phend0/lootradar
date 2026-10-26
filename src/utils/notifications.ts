import { RadarAlert } from '../types';

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Two-tone crisp radar ping
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5

    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.36);
  } catch {
    // Ignore audio context restriction errors if user hasn't interacted yet
  }
}

export function dispatchNativeNotification(alert: RadarAlert): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    new Notification(alert.title, {
      body: alert.message,
      tag: alert.id,
    });
    return true;
  } catch {
    return false;
  }
}

export function formatCountdown(targetIso: string, nowMs: number): {
  formatted: string;
  isUrgent: boolean;
  isExpired: boolean;
  totalHours: number;
} {
  const targetMs = new Date(targetIso).getTime();
  const diff = Math.max(0, targetMs - nowMs);

  if (diff <= 0) {
    return {
      formatted: '00d 00h 00m 00s',
      isUrgent: false,
      isExpired: true,
      totalHours: 0,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const totalHours = diff / (1000 * 3600);
  const isUrgent = totalHours <= 24;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted =
    days > 0
      ? `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return {
    formatted,
    isUrgent,
    isExpired: false,
    totalHours,
  };
}
