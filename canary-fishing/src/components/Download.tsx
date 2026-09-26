import { Compass, Flame, Globe, type LucideIcon } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Badge } from './ui/Badge'

interface BrowserOption {
  icon: LucideIcon
  name: string
}

const BROWSERS: BrowserOption[] = [
  { icon: Globe, name: 'Chrome' },
  { icon: Compass, name: 'Edge' },
  { icon: Flame, name: 'Firefox' },
]

export function Download() {
  return (
    <Section id="download" className="bg-bg-muted">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-h2">Bring Canary to your browser.</h2>
          <p className="text-body mt-4 text-text-muted">
            Canary Fishing is currently in development. Here's where you'll be able to install
            it once it's ready.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {BROWSERS.map((browser) => (
            <div
              key={browser.name}
              className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-muted">
                <browser.icon className="h-6 w-6 text-teal-300" aria-hidden="true" />
              </span>
              <p className="font-semibold text-text">{browser.name}</p>
              <Badge variant="neutral">Coming soon</Badge>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
