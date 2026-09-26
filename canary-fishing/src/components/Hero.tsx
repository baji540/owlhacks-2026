import { motion, useReducedMotion } from 'framer-motion'
import { Bird, Clock, Link2Off, MailWarning, ShieldAlert } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Button } from './ui/Button'

const WARNING_SIGNALS = [
  { icon: MailWarning, label: "Sender doesn't look right" },
  { icon: Link2Off, label: "Link destination doesn't match" },
  { icon: Clock, label: 'Message uses urgency' },
]

function EmailPreview() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="mx-auto max-w-md lg:mx-0">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border bg-bg-muted px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
          </div>
          <span className="text-small font-medium text-text-muted">Inbox preview</span>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-body font-semibold text-text">Security Alert</p>
              <p className="text-small text-text-muted">security-alert@example.com</p>
            </div>
            <span className="text-small text-text-muted">Just now</span>
          </div>

          <p className="font-semibold text-text">
            URGENT: Your bank account requires verification
          </p>

          <p className="text-small text-text-muted">
            We noticed unusual activity on your account. Click the link below within 24 hours
            to avoid suspension.
          </p>

          <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2">
            <Link2Off className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <span className="truncate text-small text-danger underline">
              verify-now-secure-login.com/account
            </span>
          </div>
        </div>
      </div>

      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.96 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
        className="relative z-10 ml-auto -mt-6 mr-4 max-w-xs rounded-lg border border-canary-400/40 bg-canary-bg p-4 shadow-md sm:mr-8"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canary-400">
            <ShieldAlert className="h-4 w-4 text-navy-900" aria-hidden="true" />
          </span>
          <p className="text-body font-semibold text-text">Potential phishing attempt</p>
        </div>

        <ul className="mt-3 space-y-1.5">
          {WARNING_SIGNALS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-small text-text-muted">
              <Icon className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </motion.div>

      <p className="mt-6 text-center text-small text-text-muted lg:text-left">
        Product preview illustrating how Canary works — not a live scan of a real email.
      </p>
    </div>
  )
}

export function Hero() {
  const shouldReduceMotion = useReducedMotion()
  const fadeUp = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: 'easeOut' as const },
      }

  return (
    <Section className="pt-12 sm:pt-16 lg:pt-20">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div {...fadeUp}>
            <div className="flex items-center gap-2 text-label text-teal-300">
              <Bird className="h-4 w-4" aria-hidden="true" />
              Your early warning system for online scams.
            </div>

            <h1 className="text-display mt-4">Stay one step ahead of online scams.</h1>

            <p className="text-subheading mt-6 max-w-xl">
              Canary Fishing helps you spot suspicious emails, scam messages, dangerous links,
              and risky downloads before they cause harm.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="#download" size="lg">
                Get Canary
              </Button>
              <Button href="#how-it-works" variant="outline" size="lg">
                See How It Works
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          >
            <EmailPreview />
          </motion.div>
        </div>
      </Container>
    </Section>
  )
}
