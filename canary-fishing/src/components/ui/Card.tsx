import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Rounded, bordered surface with a soft shadow. The base building block for content blocks. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
