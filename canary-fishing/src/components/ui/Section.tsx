import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Applies consistent vertical rhythm between page sections. */
export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('scroll-mt-16 py-16 sm:scroll-mt-20 sm:py-20 lg:py-28', className)}
      {...props}
    />
  )
}
