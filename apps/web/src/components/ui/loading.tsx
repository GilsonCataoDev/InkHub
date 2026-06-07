import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  className?: string;
  size?: number;
  text?: string;
}

export function Loading({ className, size = 24, text }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-ink-400', className)}>
      <Loader2 size={size} className="animate-spin" />
      {text && <p className="text-sm">{text}</p>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loading size={32} text="Carregando..." />
    </div>
  );
}
