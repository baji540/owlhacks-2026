import { motion, useReducedMotion } from 'framer-motion'
import { Bird } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Button } from './ui/Button'
import { ZoomableImage } from './ui/ZoomableImage'

function EmailPreview() {
  return (
    <div className="mx-auto max-w-md lg:mx-0">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <ZoomableImage
          src="/screenshots/scam-alert-banner.png"
          alt="Canary's scam alert banner shown inside Gmail, flagging a link that goes to a bare numeric address and explaining what to do"
          width={1400}
          height={636}
        />
      </div>

      <p className="mt-6 text-center text-small text-text-muted lg:text-left">
        A real Canary alert, shown inside Gmail.
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
