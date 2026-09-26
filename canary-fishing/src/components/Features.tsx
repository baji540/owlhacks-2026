import { motion, useReducedMotion } from 'framer-motion'
import {
  Banknote,
  FileScan,
  Fingerprint,
  HeartHandshake,
  Lightbulb,
  Link2Off,
  MailSearch,
  type LucideIcon,
} from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: MailSearch,
    title: 'Phishing Detection',
    description:
      'Canary looks for the telltale signs of a phishing attempt in emails and messages, so you can pause before you click.',
  },
  {
    icon: Link2Off,
    title: 'Malicious Link Scanning',
    description:
      "Links that don't lead where they claim to are flagged before you visit them, not after.",
  },
  {
    icon: Banknote,
    title: 'Fake Bank Alerts',
    description:
      'Urgent-sounding messages pretending to be from your bank or another institution get a closer look.',
  },
  {
    icon: Fingerprint,
    title: 'Impersonation Detection',
    description:
      "Canary watches for signs that a sender isn't who they claim to be, like mismatched addresses and spoofed names.",
  },
  {
    icon: Lightbulb,
    title: 'Simple Explanations',
    description:
      'Every warning comes with a plain-language reason — no jargon, so you always know why something looks risky.',
  },
  {
    icon: HeartHandshake,
    title: 'Trusted Contacts',
    description:
      'Designate people you trust so they can be notified if Canary detects a serious threat aimed at you.',
  },
]

export function Features() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Section id="features" className="bg-bg-muted">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-h2">Protection that makes sense.</h2>
          <p className="text-body mt-4 text-text-muted">
            Canary watches for the patterns real scams use and explains what it finds in
            language anyone can follow.
          </p>
        </div>

        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-12"
        >
          <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-canary-100">
              <FileScan className="h-6 w-6 text-canary-700" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h3 className="text-h3">Download / File Scanning</h3>
              <p className="text-body mt-2 text-text-muted">
                Suspicious downloaded files can be analyzed and classified so you know what
                you're dealing with before you open them.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge variant="success">Safe</Badge>
              <Badge variant="warning">Possible Threat</Badge>
              <Badge variant="danger">Malicious</Badge>
            </div>
          </Card>
        </motion.div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
            >
              <Card className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-md bg-canary-100">
                  <feature.icon className="h-5 w-5 text-canary-700" aria-hidden="true" />
                </span>
                <h3 className="text-h3 mt-4">{feature.title}</h3>
                <p className="text-body mt-2 text-text-muted">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
