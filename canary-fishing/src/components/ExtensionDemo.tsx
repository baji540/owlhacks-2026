import { motion, useReducedMotion } from 'framer-motion'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { ZoomableImage } from './ui/ZoomableImage'

export function ExtensionDemo() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Section id="demo" className="bg-bg-muted">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-h2">See Canary in action.</h2>
          <p className="text-body mt-4 text-text-muted">
            These are real screenshots of the Canary extension running inside Gmail, not a
            mockup.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-muted px-4 py-3">
              <p className="text-small font-medium text-text-muted">Gmail inbox</p>
              <span className="text-small text-text-muted">Real screenshot</span>
            </div>
            <ZoomableImage
              src="/screenshots/gmail-inbox-badges.png"
              alt="A real Gmail inbox with Canary's safety badges shown next to each email's subject line"
              width={1400}
              height={345}
            />
            <div className="px-5 py-4">
              <p className="text-body font-semibold text-text">Watches your inbox as you read it</p>
              <p className="text-small mt-1 text-text-muted">
                Canary checks each message and marks it right next to the subject line, so you
                see the warning before you ever open anything risky.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-muted px-4 py-3">
              <p className="text-small font-medium text-text-muted">Opened alert</p>
              <span className="text-small text-text-muted">Real screenshot</span>
            </div>
            <ZoomableImage
              src="/screenshots/scam-alert-banner.png"
              alt="Canary's scam alert banner inside Gmail, explaining exactly why a message looks like a scam"
              width={1400}
              height={636}
            />
            <div className="px-5 py-4">
              <p className="text-body font-semibold text-text">Explains the warning in plain English</p>
              <p className="text-small mt-1 text-text-muted">
                No jargon, just a clear reason why something looks wrong, and what to do about
                it.
              </p>
            </div>
          </motion.div>
        </div>
      </Container>
    </Section>
  )
}
