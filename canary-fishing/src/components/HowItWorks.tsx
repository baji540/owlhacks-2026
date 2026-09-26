import { Fragment } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Eye, ScanEye, ShieldAlert, type LucideIcon } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'

interface Step {
  number: string
  icon: LucideIcon
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: '01',
    icon: Eye,
    title: 'Canary sees it',
    description:
      'As you go through your inbox and downloads, Canary keeps an eye out for messages, links, and files that carry the fingerprints of a scam.',
  },
  {
    number: '02',
    icon: ScanEye,
    title: 'Canary checks it',
    description:
      'Links, messages, and downloaded files get checked against known warning signs and security intelligence — mismatched senders, spoofed links, urgent language, risky files.',
  },
  {
    number: '03',
    icon: ShieldAlert,
    title: 'Canary warns you',
    description:
      'If something looks risky, you get a clear, plain-language warning so you can decide what to do next.',
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Section id="how-it-works">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-h2">Three simple steps between you and a scam.</h2>
        </div>

        <div className="mt-14 flex flex-col gap-10 md:flex-row md:items-start md:gap-6">
          {STEPS.map((step, index) => (
            <Fragment key={step.number}>
              <motion.div
                className="flex-1"
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canary-400 text-base font-bold text-navy-900">
                    {step.number}
                  </span>
                  <step.icon className="h-6 w-6 text-teal-300" aria-hidden="true" />
                </div>
                <h3 className="text-h3 mt-4">{step.title}</h3>
                <p className="text-body mt-2 text-text-muted">{step.description}</p>
              </motion.div>

              {index < STEPS.length - 1 && (
                <div
                  className="hidden items-center justify-center pt-4 md:flex"
                  aria-hidden="true"
                >
                  <ArrowRight className="h-6 w-6 text-border" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </Container>
    </Section>
  )
}
