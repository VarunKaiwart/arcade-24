import { AVATAR_PRESETS } from '../../../shared/avatars.ts';

interface AvatarProps {
  avatarId: string;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
};

export function Avatar({ avatarId, username, size = 'md', className = '' }: AvatarProps) {
  const preset = AVATAR_PRESETS.find((a) => a.id === avatarId) ?? AVATAR_PRESETS[0];

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg border border-white/10 ${SIZE_CLASSES[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${preset.secondary} 0%, #0D1323 100%)`,
      }}
      title={username ? `${username} (${preset.label})` : preset.label}
      aria-label={username ? `${username} avatar` : preset.label}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden="true">
        {preset.glyph === 'hex' && (
          <>
            <polygon points="24,6 39,15 39,33 24,42 9,33 9,15" stroke={preset.primary} strokeWidth="2.5" fill={`${preset.primary}22`} />
            <polygon points="24,14 32,19 32,29 24,34 16,29 16,19" fill={preset.primary} />
          </>
        )}
        {preset.glyph === 'prism' && (
          <>
            <polygon points="24,7 41,37 7,37" stroke={preset.primary} strokeWidth="2.5" fill={`${preset.primary}22`} />
            <polygon points="24,16 33,33 15,33" fill={preset.primary} />
          </>
        )}
        {preset.glyph === 'shield' && (
          <>
            <path d="M24 7L38 12V24C38 32.5 31.8 38.4 24 41C16.2 38.4 10 32.5 10 24V12L24 7Z" stroke={preset.primary} strokeWidth="2.5" fill={`${preset.primary}22`} />
            <path d="M24 14L31 17V24C31 28.8 27.8 32.2 24 34C20.2 32.2 17 28.8 17 24V17L24 14Z" fill={preset.primary} />
          </>
        )}
        {preset.glyph === 'bolt' && (
          <path d="M27 7L12 27H23L21 41L36 21H25L27 7Z" fill={preset.primary} stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
        )}
        {preset.glyph === 'nova' && (
          <>
            <circle cx="24" cy="24" r="15" stroke={preset.primary} strokeWidth="2" strokeDasharray="4 4" />
            <polygon points="24,9 28,20 39,24 28,28 24,39 20,28 9,24 20,20" fill={preset.primary} />
          </>
        )}
        {preset.glyph === 'crown' && (
          <path d="M9 34L12 16L19 23L24 12L29 23L36 16L39 34H9Z" fill={preset.primary} stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
        )}
        {preset.glyph === 'orbit' && (
          <>
            <ellipse cx="24" cy="24" rx="17" ry="8" transform="rotate(-30 24 24)" stroke={preset.primary} strokeWidth="2.2" />
            <ellipse cx="24" cy="24" rx="17" ry="8" transform="rotate(30 24 24)" stroke={preset.primary} strokeWidth="2.2" />
            <circle cx="24" cy="24" r="5" fill={preset.primary} />
          </>
        )}
        {preset.glyph === 'vortex' && (
          <>
            <rect x="10" y="10" width="28" height="28" rx="6" transform="rotate(15 24 24)" stroke={preset.primary} strokeWidth="2.2" fill={`${preset.primary}1F`} />
            <rect x="16" y="16" width="16" height="16" rx="3" transform="rotate(45 24 24)" fill={preset.primary} />
          </>
        )}
      </svg>
    </div>
  );
}
