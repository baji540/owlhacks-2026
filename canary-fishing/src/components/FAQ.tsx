import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { cn } from '../lib/cn'

interface FaqItem {
  question: string
  answer: ReactNode
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is Canary Fishing?',
    answer:
      'Canary Fishing is a browser extension built to help you spot phishing emails, scam messages, fake alerts, risky downloads, and other online threats before they cause harm.',
  },
  {
    question: 'Who is Canary Fishing for?',
    answer:
      'Anyone who wants an extra set of eyes on their inbox — especially people who want warnings explained in plain language, including older adults and anyone less familiar with spotting scams.',
  },
  {
    question: 'How does Canary identify suspicious messages?',
    answer:
      "Canary looks for common warning signs — mismatched senders, links that don't match their claimed destination, and urgent or pressuring language — and explains what it finds in plain language. The detection engine is still under active development.",
  },
  {
    question: 'What are Trusted Contacts?',
    answer:
      'Trusted Contacts let you designate family members, caregivers, or friends who can be notified if a serious threat is detected. This feature is currently a planned concept and is not yet available.',
  },
  {
    question: 'Can Canary check downloaded files?',
    answer:
      "Checking downloaded files is a core capability we're designing Canary around. The plan is to analyze suspicious downloads and classify them as Safe, Possible Threat, or Malicious, using infrastructure such as the VirusTotal API. That backend isn't connected yet — right now this is a planned capability, not a live scan.",
  },
  {
    question: 'Does Canary read my emails?',
    answer:
      "Canary is being built to look for warning signs in your messages without exposing more of your data than necessary. We'll publish full details on how data is handled before launch.",
  },
  {
    question: 'Is Canary free?',
    answer:
      "Canary Fishing is being built for OwlHacks 2026, and pricing hasn't been finalized. We'll share details as the project develops.",
  },
  {
    question: 'Which browsers are supported?',
    answer: (
      <>
        We're targeting Chrome, Edge, and Firefox. See current availability in the{' '}
        <a href="#download" className="font-medium text-teal-300 underline">
          download section
        </a>
        .
      </>
    ),
  },
]

export function FAQ() {
  const shouldReduceMotion = useReducedMotion()
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())

  function toggle(index: number) {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <Section id="faq">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-h2">Frequently asked questions</h2>
        </div>

        <div className="mt-10 max-w-3xl divide-y divide-border border-y border-border">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openItems.has(index)
            const panelId = `faq-panel-${index}`
            const buttonId = `faq-button-${index}`

            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="font-semibold text-text">{item.question}</span>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 shrink-0 text-text-muted transition-transform',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                      animate={shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }}
                      exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <p className="text-body pb-5 text-text-muted">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
