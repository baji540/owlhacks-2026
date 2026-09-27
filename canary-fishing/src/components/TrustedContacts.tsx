import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BellRing, SlidersHorizontal, UserPlus, type LucideIcon } from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Button } from './ui/Button'
import { ZoomableImage } from './ui/ZoomableImage'

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
      'Trusted contacts are only brought in for serious, high-confidence threats, not everyday noise.',
  },
  {
    icon: SlidersHorizontal,
    title: 'You stay in control',
    description: "You choose who's on your list and can update it any time.",
  },
]

/**
 * "Add trusted contact" opens the Canary extension on its add-contact form, so
 * contacts are always saved through the extension (in Chrome, not on a server).
 * The extension's site bridge (extension/site/site-bridge.js) marks the page with
 * data-canary-extension="installed" and listens for this message.
 */
function useCanaryExtension() {
  const [installed, setInstalled] = useState(false)
  const [status, setStatus] = useState<'idle' | 'opening' | 'failed'>('idle')

  useEffect(() => {
    const check = () =>
      setInstalled(document.documentElement.dataset.canaryExtension === 'installed')
    check()
    window.addEventListener('canary-extension-ready', check)

    function onResult(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== 'canary-extension') return
      if (event.data.type === 'OPEN_ADD_CONTACT_RESULT') {
        setStatus(event.data.ok ? 'idle' : 'failed')
      }
    }
    window.addEventListener('message', onResult)
    return () => {
      window.removeEventListener('canary-extension-ready', check)
      window.removeEventListener('message', onResult)
    }
  }, [])

  function openAddContact() {
    if (!installed) {
      document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setStatus('opening')
    window.postMessage({ source: 'canary-site', type: 'OPEN_ADD_CONTACT' }, window.location.origin)
  }

  return { installed, status, openAddContact }
}

export function TrustedContacts() {
  const shouldReduceMotion = useReducedMotion()
  const { installed, status, openAddContact } = useCanaryExtension()

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
            <h2 className="text-h2">You don't have to face a scam alone.</h2>
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
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <p className="font-semibold text-text">Trusted Contacts</p>
                <span className="text-small text-text-muted">Real screenshot</span>
              </div>

              <ZoomableImage
                src="/screenshots/trusted-contacts-popup.png"
                alt="The Canary extension's Trusted Contacts screen, showing a saved example contact with a notify switch turned on"
                width={656}
                height={420}
              />

              <div className="border-t border-border px-5 py-4">
                <Button variant="outline" size="sm" className="w-full" onClick={openAddContact}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Add trusted contact
                </Button>
                <p className="mt-2 text-center text-small text-text-muted" aria-live="polite">
                  {!installed
                    ? 'Install Canary first, then add your contacts from the extension.'
                    : status === 'failed'
                      ? 'Click the Canary icon in your toolbar, then open Trusted contacts.'
                      : 'Opens Canary so you can add someone. Contacts stay in your browser.'}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <p className="font-semibold text-text">How an alert reaches them</p>
                <span className="text-small text-text-muted">Real screenshot</span>
              </div>

              <ZoomableImage
                src="/screenshots/guardian-button.png"
                alt="Canary's warning card with an Inform my guardian button and a note that Gmail opens a ready-to-check email before anything is sent"
                width={1200}
                height={246}
              />

              <div className="px-5 py-4">
                <p className="text-small text-text-muted">
                  When Canary flags a serious threat, this button appears right in the warning.
                  Pick who to ask, and Gmail opens an email for you to check, nothing sends
                  until you press Gmail's own Send button.
                </p>
              </div>
            </div>

            <p className="mt-4 text-small text-text-muted">
              Trusted contacts are added in the Canary extension and saved only in your
              browser.
            </p>
          </motion.div>
        </div>
      </Container>
    </Section>
  )
}
