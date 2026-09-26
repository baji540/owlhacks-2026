import { Bird } from 'lucide-react'
import { cn } from '../lib/cn'

interface BrandMarkProps {
  className?: string
}

/**
 * The Canary Fishing logo mark: the Lucide `Bird` icon, enlarged and
 * positioned so it clearly reads as sitting on a thin tapered fishing rod,
 * inside a solid teal badge. The rod is confined to the open space below the
 * bird's feet so it never shows through the icon's unfilled interior.
 * Shared by the navbar and footer.
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
          {/* Fishing rod: thin tapered pole confined to the open space below the
              bird's feet, with a trailing line + hook past the tip */}
          <polygon
            points="1.29,35.85 33.08,24.24 32.92,23.76 0.71,34.15"
            fill="#ffffff"
            opacity="0.85"
          />
          <path
            d="M33 24 Q36 25.5 34.5 29"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle cx="34.5" cy="29" r="1" fill="#ffffff" opacity="0.6" />
        </svg>

        <Bird
          className="absolute text-white"
          style={{ top: '8%', left: '6%', width: '78%', height: '78%' }}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
      <span className="text-lg font-bold">Canary Fishing</span>
    </a>
  )
}
