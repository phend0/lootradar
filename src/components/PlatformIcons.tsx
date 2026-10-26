import React from 'react';
import { PlatformId, StoreId } from '../types';
import { PLATFORM_META } from '../data/giveaways';

interface StoreIconProps {
  store: StoreId;
  className?: string;
}

export const StoreIcon: React.FC<StoreIconProps> = ({
  store,
  className = 'w-3.5 h-3.5',
}) => {
  switch (store) {
    case 'epic':
      // Epic Games Store Shield Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M3.5 2.75h17a.75.75 0 0 1 .75.75v12.88a2.25 2.25 0 0 1-1.08 1.92L12.39 23a.75.75 0 0 1-.78 0l-7.78-4.7a2.25 2.25 0 0 1-1.08-1.92V3.5a.75.75 0 0 1 .75-.75Zm3.25 3.5v8.25h2.5v-3h3.25v-2.25H9.25V8.5h4V6.25H6.75Zm8.25 0v8.25h2.5V6.25H15Zm-3 10.5 3.5-2.1h-7l3.5 2.1Z" />
        </svg>
      );

    case 'steam':
      // Steam Piston / Crank Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.47-3.1-9.64-7.34l3.76 1.55a2.84 2.84 0 0 0 5.66-.56v-.1l3.47-2.48h.08a3.82 3.82 0 1 0-3.82-3.82v.05l-2.43 3.52a2.86 2.86 0 0 0-1.69.37L2.04 11.02A10 10 0 0 1 12 2Zm3.33 4.7a2.55 2.55 0 1 1 0 5.1 2.55 2.55 0 0 1 0-5.1Zm0 1.27a1.28 1.28 0 1 0 0 2.56 1.28 1.28 0 0 0 0-2.56ZM8.95 14.2a1.9 1.9 0 1 1-.73 3.72l-1.5-.62a1.42 1.42 0 0 0 2.23-3.1Z" />
        </svg>
      );

    case 'gog':
      // GOG.com Geometric Hexagon / Cube Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );

    case 'prime':
      // Prime Gaming Crown Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M2.5 18.5h19v2h-19v-2Zm.7-11.2 4.6 4.1L12 5.2l4.2 6.2 4.6-4.1-1.8 9.2H5L3.2 7.3Z" />
        </svg>
      );

    case 'itch':
    default:
      // itch.io Indie Controller / Storefront Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M6.5 6h11A4.5 4.5 0 0 1 22 10.5v4.25a3.75 3.75 0 0 1-6.56 2.48L13.5 15h-3l-1.94 2.23A3.75 3.75 0 0 1 2 14.75V10.5A4.5 4.5 0 0 1 6.5 6Zm.75 3.25v1.5H5.75v1.5h1.5v1.5h1.5v-1.5h1.5v-1.5h-1.5v-1.5h-1.5Zm9.25.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm-2.5 2a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" />
        </svg>
      );
  }
};

interface PlatformIconProps {
  platform: PlatformId;
  className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = 'w-3.5 h-3.5',
}) => {
  switch (platform) {
    case 'windows':
      // Windows 4-Pane Grid Logo
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M3 3.5h8.2v8.2H3V3.5Zm9.8 0H21v8.2h-8.2V3.5ZM3 13.3h8.2V21.5H3v-8.2Zm9.8 0H21V21.5h-8.2v-8.2Z" />
        </svg>
      );

    case 'mac':
      // Apple macOS Logo
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M16.36 12.66c.02 2.44 2.14 3.25 2.16 3.26-.02.06-.34 1.16-1.12 2.3-.67.98-1.37 1.96-2.47 1.98-1.08.02-1.43-.64-2.66-.64-1.24 0-1.63.62-2.64.66-1.06.04-1.87-1.06-2.55-2.04-1.38-2-2.44-5.64-1.02-8.11.71-1.23 1.97-2 3.34-2.02 1.04-.02 2.03.7 2.66.7.64 0 1.84-.87 3.1-.74.53.02 2.01.21 2.96 1.6-.08.05-1.77 1.03-1.76 3.05ZM14.32 5.95c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.57-.85 2.5.9.07 1.82-.46 2.38-1.14Z" />
        </svg>
      );

    case 'linux':
      // Linux Penguin / Kernel Emblem
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M12 2c2.5 0 4.2 1.8 4.2 4.5 0 1.4.5 2.7 1.4 4.1 1.1 1.7 1.9 3.6 1.9 5.5 0 2.5-1.6 4.4-4 4.8-.7.1-1.5.1-2.3-.3-.4-.2-.8-.3-1.2-.3s-.8.1-1.2.3c-.8.4-1.6.4-2.3.3-2.4-.4-4-2.3-4-4.8 0-1.9.8-3.8 1.9-5.5.9-1.4 1.4-2.7 1.4-4.1C7.8 3.8 9.5 2 12 2Zm-1.5 4.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 8.8c-1.1 0-2 .5-2 1.1 0 .6.9 1.1 2 1.1s2-.5 2-1.1c0-.6-.9-1.1-2-1.1Zm0 3.2c-2.2 0-3.8 1.9-3.8 4.3 0 2 1.5 3.3 3.8 3.3s3.8-1.3 3.8-3.3c0-2.4-1.6-4.3-3.8-4.3Z" />
        </svg>
      );

    case 'steamdeck':
      // Valve Steam Deck Half-Arc & Core Logo
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <path d="M12 2.5a9.5 9.5 0 1 1 0 19v-3.2a6.3 6.3 0 1 0 0-12.6V2.5Zm0 5.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
        </svg>
      );

    case 'console':
    default:
      // Console / Mobile Cross-Buy Gamepad
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 ${className}`}
        >
          <line x1="6" y1="12" x2="10" y2="12" />
          <line x1="8" y1="10" x2="8" y2="14" />
          <line x1="15" y1="13" x2="15.01" y2="13" />
          <line x1="18" y1="11" x2="18.01" y2="11" />
          <rect x="2" y="6" width="20" height="12" rx="4" />
        </svg>
      );
  }
};

interface PlatformIconListProps {
  platforms: PlatformId[];
  showLabels?: boolean;
  iconClassName?: string;
  className?: string;
}

export const PlatformIconList: React.FC<PlatformIconListProps> = ({
  platforms,
  showLabels = true,
  iconClassName = 'w-3.5 h-3.5',
  className = 'inline-flex flex-wrap items-center gap-2',
}) => {
  return (
    <span className={className}>
      {platforms.map((p, idx) => (
        <span
          key={p}
          title={PLATFORM_META[p].label}
          className="inline-flex items-center gap-1"
        >
          <PlatformIcon platform={p} className={iconClassName} />
          {showLabels && <span>{PLATFORM_META[p].shortLabel}</span>}
          {showLabels && idx < platforms.length - 1 && (
            <span aria-hidden="true" className="text-slate-600 ml-0.5">
              /
            </span>
          )}
        </span>
      ))}
    </span>
  );
};
