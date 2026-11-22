import type { GameType } from '../../../shared/types.ts';

interface GameEmblemProps {
  gameType: GameType;
  className?: string;
}

export function GameEmblem({ gameType, className = 'w-10 h-10' }: GameEmblemProps) {
  if (gameType === 'TICTACTOE') {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <rect x="2" y="2" width="44" height="44" rx="10" fill="#161D31" stroke="#6366F1" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M18 10V38M30 10V38M10 18H38M10 30H38" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11.5 11.5L15.5 15.5M15.5 11.5L11.5 15.5" stroke="#818CF8" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" stroke="#38BDF8" strokeWidth="2.2" />
        <path d="M32.5 32.5L36.5 36.5M36.5 32.5L32.5 36.5" stroke="#818CF8" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (gameType === 'RPS') {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <rect x="2" y="2" width="44" height="44" rx="10" fill="#161D31" stroke="#06B6D4" strokeOpacity="0.45" strokeWidth="1.5" />
        <polygon points="24,10 35,29 13,29" stroke="#22D3EE" strokeWidth="2" fill="#06B6D422" />
        <circle cx="24" cy="11" r="3" fill="#22D3EE" />
        <rect x="11" y="27" width="6" height="6" rx="1.5" fill="#818CF8" />
        <polygon points="35,26 39,33 31,33" fill="#3B82F6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#161D31" stroke="#3B82F6" strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="9" y="11" width="30" height="26" rx="4" fill="#1E3A8A" fillOpacity="0.45" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="15" cy="18" r="3" fill="#334155" />
      <circle cx="24" cy="18" r="3" fill="#F43F5E" />
      <circle cx="33" cy="18" r="3" fill="#334155" />
      <circle cx="15" cy="29" r="3" fill="#FACC15" />
      <circle cx="24" cy="29" r="3" fill="#F43F5E" />
      <circle cx="33" cy="29" r="3" fill="#FACC15" />
    </svg>
  );
}
