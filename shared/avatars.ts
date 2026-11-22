export interface AvatarPreset {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  glyph: 'hex' | 'prism' | 'shield' | 'bolt' | 'nova' | 'crown' | 'orbit' | 'vortex';
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'cyber-hex', label: 'Hex Vanguard', primary: '#6366F1', secondary: '#312E81', glyph: 'hex' },
  { id: 'cobalt-prism', label: 'Cobalt Prism', primary: '#3B82F6', secondary: '#1E3A8A', glyph: 'prism' },
  { id: 'cyan-shield', label: 'Aegis Cyan', primary: '#06B6D4', secondary: '#164E63', glyph: 'shield' },
  { id: 'violet-bolt', label: 'Volt Striker', primary: '#8B5CF6', secondary: '#4C1D95', glyph: 'bolt' },
  { id: 'amber-nova', label: 'Solar Nova', primary: '#F59E0B', secondary: '#78350F', glyph: 'nova' },
  { id: 'emerald-crown', label: 'Apex Crown', primary: '#10B981', secondary: '#064E3B', glyph: 'crown' },
  { id: 'rose-orbit', label: 'Crimson Orbit', primary: '#F43F5E', secondary: '#881337', glyph: 'orbit' },
  { id: 'slate-vortex', label: 'Phantom Vortex', primary: '#94A3B8', secondary: '#1E293B', glyph: 'vortex' },
] as const;

export const VALID_AVATAR_IDS = new Set<string>(AVATAR_PRESETS.map((a) => a.id));

export const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0].id;
