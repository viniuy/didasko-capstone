'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export function LoadingSpinner({ className, size = 24 }: LoadingSpinnerProps) {
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-[#124A69]/80'>
      <Loader2
        className={cn('animate-spin text-white', className)}
        size={size}
      />
    </div>
  );
}
