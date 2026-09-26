import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Container } from './ui/Container'
import { Button } from './ui/Button'
import { BrandMark } from './BrandMark'
import { NAV_LINKS } from '../lib/navLinks'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!isMenuOpen) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMenuOpen])

  // Closing the mobile menu shifts the layout, which can race with the
  // browser's native hash-scroll. Close first, then scroll once the
  // collapse animation has settled.
  function handleMobileNavLinkClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const href = event.currentTarget.getAttribute('href')
    setIsMenuOpen(false)
    if (!href) return
    const target = document.querySelector(href)
    window.setTimeout(
      () => target?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' }),
      shouldReduceMotion ? 0 : 220,
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 shadow-sm">
      <Container>
        <div className="flex h-16 items-center justify-between sm:h-20">
          <BrandMark />

          <nav aria-label="Primary" className="hidden lg:flex lg:items-center lg:gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-body font-medium text-text-muted transition-colors hover:text-teal-300"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button href="#download" size="md">
              Get Canary
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-text lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-b border-border bg-bg lg:hidden"
          >
            <Container>
              <div className="flex flex-col gap-1 py-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-3 text-body font-medium text-text-muted hover:bg-bg-muted hover:text-teal-300"
                    onClick={handleMobileNavLinkClick}
                  >
                    {link.label}
                  </a>
                ))}
                <Button
                  href="#download"
                  size="md"
                  className="mt-2 w-full"
                  onClick={handleMobileNavLinkClick}
                >
                  Get Canary
                </Button>
              </div>
            </Container>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
