import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

interface GameCoverArtProps {
  src: string;
  alt: string;
  accentGradient?: string;
  className?: string;
}

export const GameCoverArt: React.FC<GameCoverArtProps> = ({
  src,
  alt,
  accentGradient = 'from-cyan-950/90 via-slate-900/90 to-slate-950',
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br ${accentGradient} p-6 text-center select-none ${className}`}
      >
        <Gamepad2 className="w-10 h-10 text-cyan-400/70 mb-2 shrink-0" />
        <span className="text-sm font-display font-semibold text-slate-200 line-clamp-2 max-w-[22ch]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
