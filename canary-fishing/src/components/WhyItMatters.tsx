import { Banknote, Download, Link2Off, type LucideIcon } from 'lucide-react'
import { Container } from './ui/Container'

interface Example {
  icon: LucideIcon
  label: string
}

const EXAMPLES: Example[] = [
  { icon: Banknote, label: 'a fake bank alert' },
  { icon: Link2Off, label: 'a suspicious link' },
  { icon: Download, label: 'an unexpected download' },
]

export function WhyItMatters() {
  return (
    <section className="border-y border-border bg-bg-muted py-10 sm:py-12">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-h3">Scams are designed to make you react before you think.</p>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {EXAMPLES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 text-small text-text-muted"
              >
                <Icon className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <p className="text-body mt-6 text-text-muted">
            Canary gives you a moment to stop, check, and understand what you're looking at —
            before you click, reply, or open anything.
          </p>
        </div>
      </Container>
    </section>
  )
}
