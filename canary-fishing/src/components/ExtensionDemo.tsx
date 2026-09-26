import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileArchive,
  FileText,
  Link2Off,
  Loader2,
  Lock,
  ShieldAlert,
} from 'lucide-react'
import { Container } from './ui/Container'
import { Section } from './ui/Section'
import { Badge, type BadgeVariant } from './ui/Badge'
import { cn } from '../lib/cn'

type DemoMode = 'email' | 'file'
type ScanPhase = 'checking' | 'analyzing' | 'done'

interface DemoMessage {
  id: string
  sender: string
  senderEmail: string
  subject: string
  preview: string
  time: string
  body: string
  isSuspicious: boolean
  suspiciousLink?: string
  warningSignals?: string[]
  explanation?: string
}

const MESSAGES: DemoMessage[] = [
  {
    id: 'friend',
    sender: 'Mia Chen',
    senderEmail: 'mia.chen@gmail.com',
    subject: 'Re: Weekend plans',
    preview: "Sounds fun! I'll bring the snacks...",
    time: '9:14 AM',
    body: "Sounds fun! I'll bring the snacks if you can grab drinks. See you Saturday!",
    isSuspicious: false,
  },
  {
    id: 'bank-alert',
    sender: 'Security Alert',
    senderEmail: 'security-alert@secure-bankverify.com',
    subject: 'URGENT: Your bank account requires verification',
    preview: 'We noticed unusual activity on your account...',
    time: '8:52 AM',
    body: 'We noticed unusual activity on your account. Click the link below within 24 hours to verify your identity or your account will be suspended.',
    isSuspicious: true,
    suspiciousLink: 'verify-now-secure-login.com/account',
    warningSignals: [
      'Suspicious sender address',
      'Urgent, high-pressure language',
      "Link doesn't match the claimed bank",
    ],
    explanation:
      "This message comes from an address that isn't associated with any real bank, uses urgency to rush a decision, and links to a domain unrelated to the organization it claims to represent. Legitimate banks don't ask you to verify your account through a link in an email like this.",
  },
  {
    id: 'shipping',
    sender: 'Order Updates',
    senderEmail: 'shipping@example-store.com',
    subject: 'Your order has shipped',
    preview: 'Good news! Your recent order is on its way...',
    time: 'Yesterday',
    body: 'Good news! Your recent order is on its way and should arrive within 3-5 business days. Track your package any time from your account.',
    isSuspicious: false,
  },
]

type Classification = 'safe' | 'possible-threat' | 'malicious'

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  safe: 'Safe',
  'possible-threat': 'Possible Threat',
  malicious: 'Malicious',
}

const CLASSIFICATION_BADGE_VARIANT: Record<Classification, BadgeVariant> = {
  safe: 'success',
  'possible-threat': 'warning',
  malicious: 'danger',
}

interface DemoFile {
  id: string
  name: string
  size: string
  time: string
  source: string
  classification: Classification
  signals?: string[]
  explanation?: string
}

const FILES: DemoFile[] = [
  {
    id: 'vacation-photos',
    name: 'Vacation_Photos.zip',
    size: '24.1 MB',
    time: 'Yesterday',
    source: 'Downloaded from photo-share.example.com',
    classification: 'safe',
  },
  {
    id: 'invoice',
    name: 'Invoice_September.pdf',
    size: '482 KB',
    time: '11:20 AM',
    source: 'Downloaded from an email attachment',
    classification: 'possible-threat',
    signals: [
      "File structure doesn't match a genuine PDF",
      'Delivered as a link rather than from a known invoicing service',
      'Matches patterns seen in past scam campaigns',
    ],
    explanation:
      "This file is named and iconed to look like a routine invoice, but its internal structure doesn't match a real PDF, and it arrived via a link rather than a trusted invoicing service. Files disguised this way are a common tactic for delivering malware.",
  },
  {
    id: 'bank-statement',
    name: 'Bank_Statement.pdf.exe',
    size: '1.1 MB',
    time: '9:03 AM',
    source: 'Downloaded from a link in a text message',
    classification: 'malicious',
    signals: [
      'Hidden executable file extension',
      'Distributed through an unsolicited text message',
      'Known indicators associated with malicious software',
    ],
    explanation:
      "Despite the name, this file is a program, not a document — a common disguise for malware. It arrived through an unsolicited text message rather than your actual bank, and carries indicators strongly associated with malicious software.",
  },
]

function FileIcon({ name }: { name: string }) {
  if (name.endsWith('.zip')) {
    return <FileArchive className="h-4 w-4 shrink-0" aria-hidden="true" />
  }
  return <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
}

function ScanStatus({ label, reduceMotion }: { label: string; reduceMotion: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-small text-text-muted"
    >
      <Loader2
        className={cn('h-4 w-4 shrink-0 text-teal-300', !reduceMotion && 'animate-spin')}
        aria-hidden="true"
      />
      {label}
    </div>
  )
}

export function ExtensionDemo() {
  const shouldReduceMotion = useReducedMotion()
  const [mode, setMode] = useState<DemoMode>('email')
  const [selectedMessageId, setSelectedMessageId] = useState<string>('bank-alert')
  const [selectedFileId, setSelectedFileId] = useState<string>('invoice')
  const [showExplanation, setShowExplanation] = useState(false)
  const [phase, setPhase] = useState<ScanPhase>('done')
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const selectedMessage =
    MESSAGES.find((message) => message.id === selectedMessageId) ?? MESSAGES[0]
  const selectedFile = FILES.find((file) => file.id === selectedFileId) ?? FILES[0]

  const scanLabel =
    phase === 'checking'
      ? mode === 'email'
        ? 'Scanning message…'
        : 'Checking file…'
      : mode === 'email'
        ? 'Analyzing sender & links…'
        : 'Analyzing file…'

  function runScanSequence() {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []

    if (shouldReduceMotion) {
      setPhase('done')
      return
    }

    setPhase('checking')
    const t1 = window.setTimeout(() => setPhase('analyzing'), 500)
    const t2 = window.setTimeout(() => setPhase('done'), 1050)
    timeoutsRef.current = [t1, t2]
  }

  function selectMode(next: DemoMode) {
    setMode(next)
    setShowExplanation(false)
    runScanSequence()
  }

  function selectMessage(id: string) {
    setSelectedMessageId(id)
    setShowExplanation(false)
    runScanSequence()
  }

  function selectFile(id: string) {
    setSelectedFileId(id)
    setShowExplanation(false)
    runScanSequence()
  }

  return (
    <Section id="demo" className="bg-bg-muted">
      <Container>
        <div className="max-w-2xl">
          <h2 className="text-h2">See Canary in action.</h2>
          <p className="text-body mt-4 text-text-muted">
            Select an email or a downloaded file below to see how Canary would flag it. This is
            a frontend demo with sample data — Canary isn't scanning your real inbox or files.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Demo mode"
          className="mt-6 inline-flex gap-1 rounded-md border border-border bg-card p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'email'}
            onClick={() => selectMode('email')}
            className={cn(
              'rounded px-4 py-2 text-small font-semibold transition-colors',
              mode === 'email' ? 'bg-teal-500 text-white' : 'text-text-muted hover:text-text',
            )}
          >
            Suspicious Email
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            onClick={() => selectMode('file')}
            className={cn(
              'rounded px-4 py-2 text-small font-semibold transition-colors',
              mode === 'file' ? 'bg-teal-500 text-white' : 'text-text-muted hover:text-text',
            )}
          >
            Downloaded File
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-muted px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
              </div>
              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-small text-text-muted sm:flex">
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{mode === 'email' ? 'mail.example.com' : 'downloads.example.com'}</span>
                <span
                  className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-teal-500 text-[10px] font-bold text-white"
                  aria-hidden="true"
                >
                  C
                </span>
              </div>
            </div>
            <Badge variant="neutral">Product preview — illustrative demo</Badge>
          </div>

          {mode === 'email' ? (
            <div className="grid md:grid-cols-[280px_1fr]">
              <ul className="divide-y divide-border border-b border-border md:border-b-0 md:border-r">
                {MESSAGES.map((message) => {
                  const isSelected = message.id === selectedMessageId
                  return (
                    <li key={message.id}>
                      <button
                        type="button"
                        aria-current={isSelected}
                        onClick={() => selectMessage(message.id)}
                        className={cn(
                          'flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors',
                          isSelected ? 'bg-teal-bg' : 'hover:bg-bg-muted',
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-small font-semibold text-text">
                            {message.sender}
                          </span>
                          <span className="shrink-0 text-small text-text-muted">
                            {message.time}
                          </span>
                        </div>
                        <span className="line-clamp-1 text-small font-medium text-text">
                          {message.subject}
                        </span>
                        <span className="line-clamp-1 text-small text-text-muted">
                          {message.preview}
                        </span>
                        {message.isSuspicious && (
                          <span className="mt-1 inline-flex items-center gap-1 text-small font-medium text-danger">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            Flagged
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="p-5 sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedMessage.id}
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-body font-semibold text-text">
                          {selectedMessage.sender}
                        </p>
                        <p className="text-small text-text-muted">
                          {selectedMessage.senderEmail}
                        </p>
                      </div>
                      <span className="shrink-0 text-small text-text-muted">
                        {selectedMessage.time}
                      </span>
                    </div>

                    <p className="mt-4 font-semibold text-text">{selectedMessage.subject}</p>
                    <p className="text-body mt-2 text-text-muted">{selectedMessage.body}</p>

                    {selectedMessage.suspiciousLink && (
                      <div
                        className={cn(
                          'mt-4 flex items-center gap-2 rounded-md border px-3 py-2 transition-colors',
                          phase === 'done'
                            ? 'border-danger/30 bg-danger-bg'
                            : 'border-border bg-bg-muted',
                        )}
                      >
                        <Link2Off
                          className={cn(
                            'h-4 w-4 shrink-0',
                            phase === 'done' ? 'text-danger' : 'text-text-muted',
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            'truncate text-small',
                            phase === 'done' ? 'text-danger underline' : 'text-text-muted',
                          )}
                        >
                          {selectedMessage.suspiciousLink}
                        </span>
                      </div>
                    )}

                    {phase !== 'done' ? (
                      <div className="mt-5 rounded-lg border border-border bg-bg-muted p-4">
                        <ScanStatus label={scanLabel} reduceMotion={!!shouldReduceMotion} />
                      </div>
                    ) : selectedMessage.isSuspicious ? (
                      <div className="mt-5 rounded-lg border border-teal-400/40 bg-teal-bg p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-500">
                            <ShieldAlert className="h-4 w-4 text-white" aria-hidden="true" />
                          </span>
                          <p className="text-body font-semibold text-text">
                            Potential phishing attempt
                          </p>
                        </div>

                        <ul className="mt-3 space-y-1.5">
                          {selectedMessage.warningSignals?.map((signal) => (
                            <li
                              key={signal}
                              className="flex items-center gap-2 text-small text-text-muted"
                            >
                              <CircleAlert
                                className="h-3.5 w-3.5 shrink-0 text-danger"
                                aria-hidden="true"
                              />
                              {signal}
                            </li>
                          ))}
                        </ul>

                        <button
                          type="button"
                          aria-expanded={showExplanation}
                          aria-controls="demo-explanation"
                          onClick={() => setShowExplanation((open) => !open)}
                          className="mt-4 inline-flex items-center gap-1.5 text-small font-semibold text-teal-300 hover:text-teal-200"
                        >
                          {showExplanation ? 'Hide explanation' : 'Why is this suspicious?'}
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform',
                              showExplanation && 'rotate-180',
                            )}
                            aria-hidden="true"
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {showExplanation && (
                            <motion.div
                              id="demo-explanation"
                              initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                              animate={
                                shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }
                              }
                              exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <p className="mt-3 text-small text-text-muted">
                                {selectedMessage.explanation}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="mt-5 flex items-center gap-2 text-small text-success">
                        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                        No warning signs found in this message.
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-[280px_1fr]">
              <ul className="divide-y divide-border border-b border-border md:border-b-0 md:border-r">
                {FILES.map((file) => {
                  const isSelected = file.id === selectedFileId
                  return (
                    <li key={file.id}>
                      <button
                        type="button"
                        aria-current={isSelected}
                        onClick={() => selectFile(file.id)}
                        className={cn(
                          'flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors',
                          isSelected ? 'bg-teal-bg' : 'hover:bg-bg-muted',
                        )}
                      >
                        <div className="flex w-full items-center gap-2 text-text">
                          <FileIcon name={file.name} />
                          <span className="line-clamp-1 text-small font-semibold">
                            {file.name}
                          </span>
                        </div>
                        <span className="text-small text-text-muted">
                          {file.size} · {file.time}
                        </span>
                        <Badge
                          variant={CLASSIFICATION_BADGE_VARIANT[file.classification]}
                          className="mt-1"
                        >
                          {CLASSIFICATION_LABEL[file.classification]}
                        </Badge>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="p-5 sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedFile.id}
                    initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-text">
                        <FileIcon name={selectedFile.name} />
                        <p className="text-body font-semibold">{selectedFile.name}</p>
                      </div>
                      <span className="shrink-0 text-small text-text-muted">
                        {selectedFile.size}
                      </span>
                    </div>

                    <p className="text-small mt-2 text-text-muted">{selectedFile.source}</p>

                    <div className="mt-5 rounded-lg border border-border bg-bg-muted p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-body font-semibold text-text">Canary analysis</p>
                        {phase === 'done' && (
                          <Badge variant={CLASSIFICATION_BADGE_VARIANT[selectedFile.classification]}>
                            {CLASSIFICATION_LABEL[selectedFile.classification]}
                          </Badge>
                        )}
                      </div>

                      {phase !== 'done' ? (
                        <div className="mt-3">
                          <ScanStatus label={scanLabel} reduceMotion={!!shouldReduceMotion} />
                        </div>
                      ) : selectedFile.signals ? (
                        <>
                          <ul className="mt-3 space-y-1.5">
                            {selectedFile.signals.map((signal) => (
                              <li
                                key={signal}
                                className="flex items-center gap-2 text-small text-text-muted"
                              >
                                <CircleAlert
                                  className={cn(
                                    'h-3.5 w-3.5 shrink-0',
                                    selectedFile.classification === 'malicious'
                                      ? 'text-danger'
                                      : 'text-warning',
                                  )}
                                  aria-hidden="true"
                                />
                                {signal}
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            aria-expanded={showExplanation}
                            aria-controls="demo-file-explanation"
                            onClick={() => setShowExplanation((open) => !open)}
                            className="mt-4 inline-flex items-center gap-1.5 text-small font-semibold text-teal-300 hover:text-teal-200"
                          >
                            {showExplanation ? 'Hide explanation' : 'Why is this suspicious?'}
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                showExplanation && 'rotate-180',
                              )}
                              aria-hidden="true"
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {showExplanation && (
                              <motion.div
                                id="demo-file-explanation"
                                initial={
                                  shouldReduceMotion ? undefined : { height: 0, opacity: 0 }
                                }
                                animate={
                                  shouldReduceMotion ? undefined : { height: 'auto', opacity: 1 }
                                }
                                exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <p className="mt-3 text-small text-text-muted">
                                  {selectedFile.explanation}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 text-small text-success">
                          <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                          No threats detected in this file.
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </Container>
    </Section>
  )
}
