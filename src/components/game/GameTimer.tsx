import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  deadlineAt: string | null;
  label?: string;
}

export function GameTimer({ deadlineAt, label = 'Shot Clock' }: GameTimerProps) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineAt) {
      setRemainingSec(null);
      return;
    }

    const update = () => {
      const ms = new Date(deadlineAt).getTime() - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(ms / 1000)));
    };

    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (remainingSec === null) return null;

  const urgent = remainingSec <= 7;
  const warning = !urgent && remainingSec <= 12;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
        urgent
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          : warning
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
            : 'border-white/10 bg-[#161D31] text-slate-200'
      }`}
      aria-live="off"
    >
      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">
        {String(remainingSec).padStart(2, '0')}s
      </span>
    </div>
  );
}
