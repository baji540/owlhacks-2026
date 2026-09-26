import { BrandMark } from './BrandMark'
import { Container } from './ui/Container'
import { NAV_LINKS } from '../lib/navLinks'

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-muted">
      <Container className="py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <BrandMark />
            <p className="text-body mt-4 text-text-muted">
              Your early warning system for online scams.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-body font-medium text-text-muted hover:text-canary-400"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-small text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Canary Fishing · Built for OwlHacks 2026.</p>
          <p>canary.fishing</p>
        </div>
      </Container>
    </footer>
  )
}
