import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-canary-400 text-navy-900 hover:bg-canary-500 border border-transparent',
  secondary: 'bg-teal-500 text-white hover:bg-teal-600 border border-transparent',
  outline: 'bg-transparent text-text border border-border hover:bg-bg-muted',
  ghost: 'bg-transparent text-text hover:bg-bg-muted border border-transparent',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-base',
  lg: 'h-13 px-8 text-lg',
}

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )
}

interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

type ButtonAsButton = ButtonOwnProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }

type ButtonAsAnchor = ButtonOwnProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type ButtonProps = ButtonAsButton | ButtonAsAnchor

/**
 * Standard call-to-action with brand-consistent variants and sizes.
 * Pass `href` to render an anchor (e.g. linking to a page section) instead of a button.
 */
export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  if (props.href !== undefined) {
    const { href, ...anchorProps } = props
    return (
      <a href={href} className={buttonClasses(variant, size, className)} {...anchorProps} />
    )
  }

  return <button className={buttonClasses(variant, size, className)} {...props} />
}
