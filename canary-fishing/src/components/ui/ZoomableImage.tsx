import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Maximize2, X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface ZoomableImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

/**
 * A product screenshot that opens in a large centered lightbox on click.
 * The trigger image is decorative (empty alt) since the button's own label
 * already announces it; the lightbox's image carries the real alt text.
 */
export function ZoomableImage({ src, alt, width, height, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const trigger = triggerRef.current
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn('group relative block w-full cursor-zoom-in', className)}
        aria-label={`${alt}. Click to view a larger version.`}
      >
        <img
          src={src}
          alt=""
          width={width}
          height={height}
          className="h-auto w-full transition-opacity duration-150 group-hover:opacity-90"
        />
        <span
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-text opacity-70 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
          aria-hidden="true"
        >
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              <motion.div
                className="relative z-10 max-h-full max-w-full"
                initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <span id={titleId} className="sr-only">
                  {alt}
                </span>
                <img
                  src={src}
                  alt={alt}
                  className="max-h-[85vh] max-w-[92vw] rounded-lg border border-border object-contain shadow-lg sm:max-h-[90vh] sm:max-w-[85vw]"
                />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close enlarged image"
                  className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text shadow-lg transition-colors hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-300 sm:-top-4 sm:-right-4"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
