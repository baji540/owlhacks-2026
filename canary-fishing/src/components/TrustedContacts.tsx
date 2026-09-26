import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BellRing,
  ShieldAlert,
  SlidersHorizontal,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { cn } from '../lib/cn'

interface Contact {
  name: string
  relation: string
  initials: string
}

const CONTACTS: Contact[] = [
  { name: 'Sarah', relation: 'Daughter', initials: 'S' },
  { name: 'David', relation: 'Son', initials: 'D' },
  { name: 'Emily', relation: 'Caregiver', initials: 'E' },
]

interface Point {
  icon: LucideIcon
  title: string
  description: string
}

const POINTS: Point[] = [
  {
    icon: UserPlus,
    title: 'Choose who to trust',
    description:
      "Add family members, caregivers, or close friends you'd want by your side if something looked wrong.",
  },
  {
    icon: BellRing,
    title: 'Alerts only when it matters',
    description:
      'Trusted contacts are notified for serious, high-confidence threats — not everyday noise.',
  },
  {
    icon: SlidersHorizontal,
    title: 'You stay in control',
    description: "You choose who's on your list and can update it any time.",
  },
]

export function TrustedContacts() {
  const shouldReduceMotion = useReducedMotion()
  const [notify, setNotify] = useState<Record<string, boolean>>({
    Sarah: true,
    David: true,
    Emily: false,
  })

  return (
    <Section id="trusted-contacts">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <Badge variant="info">Concept preview</Badge>
            <h2 className="text-h2 mt-4">You don't have to face a scam alone.</h2>
            <p className="text-body mt-4 text-text-muted">
              Trusted Contacts let you designate family members, caregivers, or close friends
              who can be alerted when Canary detects a serious threat aimed at you.
            </p>

            <ul className="mt-8 space-y-6">
              {POINTS.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-500/10">
                    <point.icon className="h-5 w-5 text-teal-300" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-text">{point.title}</p>
                    <p className="text-body mt-1 text-text-muted">{point.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border px-5 py-4">
                <p className="font-semibold text-text">Trusted Contacts</p>
                <p className="text-small text-text-muted">Notified for high-risk alerts only</p>
              </div>

              <ul className="divide-y divide-border">
                {CONTACTS.map((contact) => {
                  const isOn = notify[contact.name] ?? false
                  return (
                    <li
                      key={contact.name}
                      className="grid grid-cols-[40px_minmax(0,1fr)_52px] items-center gap-3 px-5 py-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/10 font-semibold text-teal-300">
                        {contact.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text">{contact.name}</p>
                        <p className="truncate text-small text-text-muted">
                          {contact.relation}
                        </p>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`Notify ${contact.name} for high-risk alerts`}
                          onClick={() =>
                            setNotify((prev) => ({ ...prev, [contact.name]: !isOn }))
                          }
                          className={cn(
                            'relative h-[28px] w-[52px] shrink-0 rounded-full transition-colors',
                            isOn ? 'bg-teal-500' : 'bg-border',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-[2px] left-[2px] h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
                              isOn ? 'translate-x-[24px]' : 'translate-x-0',
                            )}
                          />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="border-t border-border px-5 py-4">
                <Button variant="outline" size="sm" disabled className="w-full">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Add trusted contact
                </Button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <p className="font-semibold text-text">How an alert reaches them</p>
                <Badge variant="info">Preview</Badge>
              </div>

              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                    <ShieldAlert className="h-4 w-4 text-teal-300" aria-hidden="true" />
                  </span>
                  <p className="text-small text-text-muted">Canary detects a serious threat</p>
                </div>
                <ArrowRight
                  className="hidden h-4 w-4 shrink-0 text-border sm:block"
                  aria-hidden="true"
                />
                <div className="flex flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                    <BellRing className="h-4 w-4 text-teal-300" aria-hidden="true" />
                  </span>
                  <p className="text-small text-text-muted">You receive a warning</p>
                </div>
                <ArrowRight
                  className="hidden h-4 w-4 shrink-0 text-border sm:block"
                  aria-hidden="true"
                />
                <div className="flex flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-small font-semibold text-teal-300">
                    S
                  </span>
                  <p className="text-small text-text-muted">Sarah is notified</p>
                </div>
              </div>

              <div className="border-t border-border bg-bg-muted px-5 py-4">
                <div className="rounded-lg border border-teal-400/40 bg-teal-bg p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-500">
                      <BellRing className="h-4 w-4 text-white" aria-hidden="true" />
                    </span>
                    <p className="text-body font-semibold text-text">Canary Alert</p>
                  </div>
                  <p className="mt-2 text-small text-text-muted">
                    Canary detected a suspicious message that may be trying to steal personal
                    information.
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-small font-semibold text-teal-300">
                        S
                      </span>
                      <div>
                        <p className="text-small font-semibold text-text">Sarah</p>
                        <p className="text-small text-text-muted">Daughter</p>
                      </div>
                    </div>
                    <span className="text-small font-medium text-success">was notified</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-small text-text-muted">
              This is a concept mockup — Trusted Contacts settings and notifications aren't
              connected yet.
            </p>
          </motion.div>
        </div>
      </Container>
    </Section>
  )
}
