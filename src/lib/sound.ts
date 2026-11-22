/**
 * Lightweight Web Audio API synthesized sound feedback for DuelZone matches.
 */
class SoundController {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(value: boolean): void {
    this.muted = value;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gainLevel = 0.06, delay = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainLevel, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Audio playback blocked before gesture — ignore quietly
    }
  }

  public playMove(): void {
    this.tone(440, 0.09, 'triangle', 0.05);
  }

  public playDrop(): void {
    this.tone(320, 0.07, 'sine', 0.05);
    this.tone(220, 0.09, 'triangle', 0.04, 0.05);
  }

  public playLockIn(): void {
    this.tone(520, 0.08, 'sine', 0.05);
  }

  public playWin(): void {
    this.tone(523.25, 0.14, 'triangle', 0.07, 0);
    this.tone(659.25, 0.14, 'triangle', 0.07, 0.1);
    this.tone(783.99, 0.24, 'triangle', 0.08, 0.2);
  }

  public playLoss(): void {
    this.tone(330, 0.14, 'sine', 0.05, 0);
    this.tone(261.6, 0.24, 'sine', 0.05, 0.12);
  }

  public playDraw(): void {
    this.tone(392, 0.12, 'triangle', 0.05, 0);
    this.tone(392, 0.16, 'triangle', 0.05, 0.13);
  }

  public playMatchFound(): void {
    this.tone(587.33, 0.1, 'sine', 0.06, 0);
    this.tone(880, 0.18, 'sine', 0.06, 0.09);
  }
}

export const soundFx = new SoundController();
