import { motion, useReducedMotion } from 'framer-motion'
import {
  Banknote,
  FileScan,
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
import { cn } from '../lib/cn'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  badge?: string
  muted?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: MailSearch,
    title: 'Suspicious Messages',
    description: 'Emails, texts, and impersonation attempts that try to pass as someone they’re not.',
  },
  {
    icon: Link2Off,
    title: 'Dangerous Links',
    description: "Links that don't lead where they claim to are flagged before you follow them.",
  },
  {
    icon: FileScan,
    title: 'Risky Downloads',
    description: 'Downloaded files checked against known and suspicious threats before you open them.',
    badge: 'Planned',
  },
  {
    icon: Banknote,
    title: 'Fake Bank & Security Alerts',
    description: 'Urgent, high-pressure messages designed to make you panic get a closer look.',
  },
  {
    icon: Lightbulb,
    title: 'Plain-English Warnings',
    description: 'Every warning is explained in plain language — no security background required.',
  },
  {
    icon: HeartHandshake,
    title: 'Protection for People You Trust',
    description: 'Trusted Contacts add an extra safety net for the people who matter to you.',
    muted: true,
  },
]

export function Features() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Section id="features" className="bg-bg-muted">
      <Container>
        <div className="max-w-2xl">
          <p className="text-label text-teal-300">What Canary watches for</p>
          <h2 className="text-h2 mt-3">Protection that makes sense.</h2>
          <p className="text-body mt-4 text-text-muted">
            Canary watches for the patterns real scams use and explains what it finds in
            language anyone can follow.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
            >
              <Card
                className={cn(
                  'group flex h-full flex-col transition-all duration-200 motion-safe:hover:-translate-y-1',
                  feature.muted
                    ? 'hover:border-border'
                    : 'hover:border-teal-500/40 hover:shadow-md',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200',
                      feature.muted
                        ? 'bg-bg-muted text-text-muted'
                        : 'bg-teal-500/10 text-teal-300 group-hover:bg-teal-500/20',
                    )}
                  >
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {feature.badge && <Badge variant="neutral">{feature.badge}</Badge>}
                </div>
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
