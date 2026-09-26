import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeVariant = 'neutral' | 'canary' | 'success' | 'warning' | 'danger' | 'info'

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-muted text-text-muted border-border',
  canary: 'bg-canary-100 text-canary-700 border-canary-300',
  success: 'bg-success-bg text-success border-success/20',
  warning: 'bg-warning-bg text-warning border-warning/20',
  danger: 'bg-danger-bg text-danger border-danger/20',
  info: 'bg-teal-400/10 text-teal-300 border-teal-400/30',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  icon?: ReactNode
}

/** Small pill used to label status, categories, or highlight a short piece of text. */
export function Badge({ variant = 'neutral', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-label',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}
