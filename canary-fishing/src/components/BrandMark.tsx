import { Bird } from 'lucide-react'
import { cn } from '../lib/cn'

interface BrandMarkProps {
  className?: string
}

/**
 * The Canary Fishing logo mark: a canary perched on a minimal fishing rod,
 * inside a solid teal badge. Shared by the navbar and footer.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <a
      href="#"
      className={cn('flex items-center gap-2 text-text', className)}
      aria-label="Canary Fishing home"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-500">
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line
            x1="5"
            y1="31"
            x2="26"
            y2="9"
            stroke="#ffffff"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <path
            d="M24 11 Q27 16 24 21"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="24" cy="21" r="1.3" fill="#ffffff" />
        </svg>
        <Bird
          className="relative h-4 w-4 shrink-0 text-white"
          style={{ transform: 'translate(2px, -9px)' }}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </span>
      <span className="text-lg font-bold">Canary Fishing</span>
    </a>
  )
}
