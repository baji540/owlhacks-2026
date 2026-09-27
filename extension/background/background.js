'use strict';

/**
 * Canary — background service worker.
 *
 * Responsibilities:
 *   1. evaluateEmail()  — heuristic phishing engine that returns a traffic-light
 *                         verdict plus a plain-English explanation.
 *   2. onMessage router — the contract documented in shared/messages.md.
 *   3. onCreated hook   — pauses risky downloads and warns the user.
 *
 * Dependency-free. Runs as a classic MV3 service worker (no modules, no imports).
 */

const ENGINE_VERSION = '1.0.0';

const RATING = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' };

const SHIELDS_KEY = 'canary.shieldsEnabled';
const SESSION_KEY = 'canary.session';

/* ------------------------------------------------------------------ *
 * Heuristic vocabularies
 * ------------------------------------------------------------------ */

/**
 * Domains whose mail is genuine often enough that ordinary sales wording, order
 * confirmations, and receipts must not raise a warning. Membership is about the
 * *sending address*, not about anything the email claims — see isReputableSender.
 */
const REPUTABLE_DOMAINS = new Set([
  // Tech
  'apple.com',
  'google.com',
  'microsoft.com',
  'amazon.com',
  'samsung.com',
  'meta.com',
  // Streaming and media
  'netflix.com',
  'spotify.com',
  'disneyplus.com',
  'youtube.com',
  'hulu.com',
  'steampowered.com',
  // Banking and finance
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'capitalone.com',
  'citi.com',
  'americanexpress.com',
  'fidelity.com',
  'vanguard.com',
  // Retail and services
  'paypal.com',
  'target.com',
  'walmart.com',
  'ebay.com',
  'uber.com',
  'lyft.com',
  'doordash.com',
  // Shipping
  'ups.com',
  'fedex.com',
  'usps.com',
]);

/**
 * Sales pressure. Every retailer on earth writes like this, so it only counts
 * against a sender we cannot verify.
 */
const PROMOTIONAL_URGENCY = new Set([
  'act now',
  'buy now',
  'save big',
  'limited time',
  'limited time only',
  'last chance',
  'today only',
  'ends tonight',
  'final hours',
  'while supplies last',
  'exclusive offer',
  'hurry',
]);

/** Pressure wording. Scammers need you to act before you think. */
const URGENCY_PHRASES = [
  'urgent',
  'urgent action',
  'urgent action required',
  'account suspended',
  'account has been suspended',
  'your account will be suspended',
  'suspended',
  'immediate action',
  'immediate action required',
  'unauthorized charge',
  'unauthorised charge',
  'wire immediately',
  'password reset requested',
  'final warning',
  'last warning',
  'within 24 hours',
  'within 48 hours',
  'avoid termination',
  'verify your account',
  'confirm your identity',
  'your account is locked',
  // Sales pressure: a warning sign from a stranger, ordinary from a real store.
  // Suppressed for reputable senders via PROMOTIONAL_URGENCY.
  ...PROMOTIONAL_URGENCY,
];

/** Money that cannot be clawed back once it is gone. */
const FINANCIAL_LURES = [
  'wire transfer',
  'wire immediately',
  'gift card',
  'gift cards',
  'crypto',
  'cryptocurrency',
  'bitcoin',
  'refund approved',
  'refund has been approved',
  'western union',
  'money gram',
  'moneygram',
  'zelle payment',
  'cash app',
  'routing number',
  'social security number',
];

/** Throwaway top-level domains that get burned within days. */
const SUSPICIOUS_TLDS = [
  '.xyz',
  '.top',
  '.buzz',
  '.click',
  '.zip',
  '.mov',
  '.cam',
  '.rest',
  '.work',
  '.gq',
  '.tk',
  '.ml',
  '.cf',
  '.country',
];

/** Generic shorteners hide the real destination. */
const URL_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rb.gy',
  'cutt.ly',
  'shorturl.at',
  'rebrand.ly',
  'tiny.cc',
  's.id',
];

/** Free mailbox providers — fine for people, never for a bank. */
const FREEMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'yandex.com',
];

/** Brands that scammers wear as a costume. */
const IMPOSTER_BRANDS = [
  { name: 'Chase', tokens: ['chase'], legit: ['chase.com', 'jpmorganchase.com'] },
  { name: 'PayPal', tokens: ['paypal'], legit: ['paypal.com'] },
  { name: 'Bank of America', tokens: ['bankofamerica', 'bofa'], legit: ['bankofamerica.com'] },
  { name: 'Wells Fargo', tokens: ['wellsfargo'], legit: ['wellsfargo.com'] },
  { name: 'Citibank', tokens: ['citibank', 'citi'], legit: ['citi.com', 'citibank.com'] },
  { name: 'the IRS', tokens: ['irs'], legit: ['irs.gov'] },
  { name: 'Social Security', tokens: ['ssa', 'socialsecurity'], legit: ['ssa.gov'] },
  { name: 'Medicare', tokens: ['medicare'], legit: ['medicare.gov', 'cms.gov'] },
  { name: 'Amazon', tokens: ['amazon'], legit: ['amazon.com', 'amazonses.com'] },
  { name: 'Apple', tokens: ['apple', 'icloud'], legit: ['apple.com', 'icloud.com'] },
  {
    name: 'Microsoft',
    tokens: ['microsoft', 'office365', 'outlook'],
    legit: ['microsoft.com', 'microsoftonline.com', 'office.com', 'outlook.com'],
  },
  { name: 'Netflix', tokens: ['netflix'], legit: ['netflix.com'] },
  { name: 'USPS', tokens: ['usps'], legit: ['usps.com', 'usps.gov'] },
  { name: 'FedEx', tokens: ['fedex'], legit: ['fedex.com'] },
  { name: 'UPS', tokens: ['ups'], legit: ['ups.com'] },
  { name: 'DHL', tokens: ['dhl'], legit: ['dhl.com'] },
  { name: 'Norton', tokens: ['norton'], legit: ['norton.com', 'nortonlifelock.com'] },
  { name: 'McAfee', tokens: ['mcafee'], legit: ['mcafee.com'] },
  { name: 'Geek Squad', tokens: ['geeksquad'], legit: ['bestbuy.com', 'geeksquad.com'] },
];

/** Words bolted onto a brand name to make a fake domain look official. */
const SPOOF_SUFFIXES = [
  'update',
  'updates',
  'verify',
  'verification',
  'secure',
  'security',
  'support',
  'service',
  'services',
  'alert',
  'alerts',
  'billing',
  'account',
  'accounts',
  'login',
  'signin',
  'confirm',
  'notice',
  'help',
  'center',
  'online',
  'refund',
];

/** Delivery-notice bait. Yellow unless a real tracking identifier is present. */
const DELIVERY_PHRASES = [
  'parcel waiting',
  'parcel is waiting',
  'package delayed',
  'package is delayed',
  'package on hold',
  'parcel on hold',
  'delivery attempt',
  'failed delivery',
  'redelivery',
  'shipment on hold',
  'schedule your delivery',
  'confirm your address',
  'customs fee',
];

/** Bulk-mail markers. Annoying, not usually dangerous. */
const MARKETING_PHRASES = [
  'unsubscribe',
  'limited time offer',
  'limited-time offer',
  'newsletter',
  'special offer',
  'exclusive offer',
  'deal of the day',
  'flash sale',
  'shop now',
  'no longer wish to receive',
  'view this email in your browser',
  'promotional',
  'you are receiving this email because',
];

/** Extensions that can take over a machine when opened. */
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.scr',
  '.vbs',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.jar',
  '.msi',
  '.hta',
  '.ps1',
  '.reg',
  '.lnk',
  '.apk',
  '.iso',
  '.js',
  '.jse',
  '.wsf',
];

/** "invoice.pdf.exe" — a document costume over a program. */
const DOUBLE_EXTENSION_RE =
  /\.(pdf|docx?|xlsx?|pptx?|txt|jpe?g|png|gif|zip|rar|csv)\.(exe|scr|vbs|bat|cmd|com|pif|js|jse|hta|ps1|lnk)$/i;

const RAW_IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
/** Link schemes that run code or reach outside the browser instead of opening a page. */
const DANGEROUS_PROTOCOL_RE =
  /(?:javascript:|vbscript:|file:\/\/|ftp:\/\/|data:text\/html|data:application\/)/i;
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const BARE_DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const TRACKING_ID_RE = /\b(?:1Z[0-9A-Z]{16}|[0-9]{12,22}|[A-Z]{2}[0-9]{9}[A-Z]{2})\b/;

/** Severity → points. The overall light comes from the total plus overrides. */
const SEVERITY_POINTS = { low: 8, medium: 18, high: 34, critical: 60 };

/**
 * Findings that a whitelisted sending domain cannot excuse. A bare IP address or a
 * link that runs code instead of opening a page means the mail is forged or the
 * account is compromised, whoever it claims to be from.
 */
const TRUST_OVERRIDE_IDS = new Set([
  'sender_raw_ip',
  'link_raw_ip',
  'link_dangerous_protocol',
  'link_userinfo_trick',
]);

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const asText = (value) => (typeof value === 'string' ? value : '');
const lower = (value) => asText(value).toLowerCase();

/** Quote a value the way a non-technical reader expects to see it. */
const quote = (value) => `\u201c${value}\u201d`;

function uniq(list) {
  return Array.from(new Set(list));
}

/** `"Chase Support" <alerts@chase-update.top>` → `alerts@chase-update.top` */
function extractEmailAddress(sender) {
  const text = asText(sender).trim();
  const angled = text.match(/<([^<>]+)>/);
  const candidate = (angled ? angled[1] : text).trim();
  return candidate.includes('@') ? candidate.toLowerCase() : '';
}

/** The human-facing part of a From line, without the address. */
function extractDisplayName(sender) {
  const text = asText(sender).trim();
  const angled = text.indexOf('<');
  const name = angled > -1 ? text.slice(0, angled) : text.includes('@') ? '' : text;
  return name.replace(/^["'\s]+|["'\s]+$/g, '');
}

function domainOfAddress(address) {
  const at = address.lastIndexOf('@');
  return at > -1 ? address.slice(at + 1).replace(/[>.,;\s]+$/, '') : '';
}

function hostOfUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** `mail.chase.com` is within `chase.com`; `chase.com.evil.top` is not. */
function isWithinDomain(host, base) {
  return host === base || host.endsWith(`.${base}`);
}

/** Is this hostname a whitelisted domain, or a genuine subdomain of one? */
function isReputableDomain(domain) {
  if (!domain) return false;
  if (REPUTABLE_DOMAINS.has(domain)) return true;

  for (const trusted of REPUTABLE_DOMAINS) {
    if (domain.endsWith(`.${trusted}`)) return true;
  }
  return false;
}

/**
 * Did this email really come from a whitelisted company?
 *
 * Reads the address out of `Name <user@host>` (or takes the whole string when
 * there are no angle brackets), lowercases it, and keeps only the part after the
 * final `@`. Subdomains pass, so `mailer.netflix.com` and `insideapple.apple.com`
 * are trusted while `netflix.com.deals.top` and `netflix-billing.xyz` are not.
 *
 * @param {string} rawSender a full From line, or a bare email address
 * @returns {boolean}
 */
function isReputableSender(rawSender) {
  return isReputableDomain(domainOfAddress(extractEmailAddress(rawSender)));
}

function suspiciousTldOf(host) {
  return SUSPICIOUS_TLDS.find((tld) => host.endsWith(tld)) || '';
}

/**
 * Does a hostname really contain this brand token? Splits on label and word
 * separators so `chase-update.top` matches but `purchases.example.com` does not.
 */
function hostMentionsToken(host, token) {
  return host.split('.').some((label) => {
    if (label === token) return true;
    if (label.split(/[^a-z0-9]+/).includes(token)) return true;
    // Glued-together spoofs like "paypalsecurity"; long tokens only, to keep
    // short ones such as "ups" or "citi" from matching innocent words.
    return token.length >= 5 && label.startsWith(token) && label.length > token.length;
  });
}

function findPhrases(haystack, phrases) {
  return phrases.filter((phrase) => haystack.includes(phrase));
}

/** Pull every URL and bare hostname out of free text. */
function collectHosts(text, extraUrls) {
  const hosts = [];
  const urls = [];

  for (const url of uniq([...(extraUrls || []), ...(asText(text).match(URL_RE) || [])])) {
    urls.push(url);
    const host = hostOfUrl(url);
    if (host) hosts.push(host);
    else {
      const ip = url.match(RAW_IP_RE);
      if (ip) hosts.push(ip[0]);
    }
  }

  // Bare "www.chase-update.top" style references with no scheme.
  for (const match of asText(text).match(BARE_DOMAIN_RE) || []) {
    const host = match.toLowerCase();
    if (!host.includes('@') && !hosts.includes(host)) hosts.push(host);
  }

  return { hosts: uniq(hosts), urls: uniq(urls) };
}

/* ------------------------------------------------------------------ *
 * The threat engine
 * ------------------------------------------------------------------ */

/**
 * Evaluate one email.
 *
 * @param {{sender?: string, subject?: string, bodySnippet?: string,
 *          links?: string[], fingerprint?: string}} data
 * @returns {object} verdict payload (see shared/messages.md)
 */
function evaluateEmail(data) {
  const input = data && typeof data === 'object' ? data : {};

  const senderRaw = asText(input.sender);
  const subject = asText(input.subject);
  const bodySnippet = asText(input.bodySnippet ?? input.snippet);

  const senderEmail = extractEmailAddress(senderRaw);
  const senderName = extractDisplayName(senderRaw);
  const senderDomain = domainOfAddress(senderEmail);
  const senderTrusted = isReputableDomain(senderDomain);

  const haystack = lower(`${senderName} ${senderEmail} ${subject} ${bodySnippet}`);
  // A link is judged on its own merits even when it matches the sender's domain —
  // a throwaway domain is a problem in both places.
  const { hosts: linkHosts, urls } = collectHosts(`${subject} ${bodySnippet}`, input.links);

  const hits = [];

  collectUrgencyHits(hits, haystack, senderTrusted);
  collectFinancialHits(hits, haystack);
  collectSenderHits(hits, { senderRaw, senderEmail, senderName, senderDomain, haystack });
  collectLinkHits(hits, { linkHosts, urls, senderDomain, haystack });
  collectProtocolHits(hits, `${subject} ${bodySnippet}`, input.links);
  collectSoftHits(hits, { haystack, subject, bodySnippet, senderDomain, senderTrusted });

  const score = hits.reduce((total, hit) => total + SEVERITY_POINTS[hit.severity], 0);
  let rating = decideRating(score, hits);

  // A verified sending domain clears ordinary marketing noise, but never a forged
  // link. Anything in TRUST_OVERRIDE_IDS keeps its rating regardless of the sender.
  const overriding = hits.find((hit) => TRUST_OVERRIDE_IDS.has(hit.id));
  const trustSuppressed = senderTrusted && rating !== RATING.GREEN && !overriding;
  if (trustSuppressed) rating = RATING.GREEN;

  const primary = pickPrimaryHit(hits);
  const categories = uniq(hits.map((hit) => hit.category));

  return {
    fingerprint: asText(input.fingerprint),
    score: rating, // traffic light, per the agreed payload shape
    riskPoints: trustSuppressed ? 0 : Math.min(100, score),
    confidence: describeConfidence(rating, hits),
    senderTrusted,
    trustSuppressed,
    threatCategory: primary && !trustSuppressed ? primary.category : 'none',
    threatLabel:
      primary && !trustSuppressed ? primary.label : 'Nothing suspicious found',
    threatCategories: categories.length ? categories : ['none'],
    simpleExplanation: composeExplanation(rating, hits, {
      senderName,
      senderEmail,
      senderDomain,
      senderTrusted,
      trustSuppressed,
    }),
    actionRecommendation: composeRecommendation(rating, categories, senderTrusted),
    badge: badgeFor(rating),
    reasons: hits.map((hit) => ({
      id: hit.id,
      category: hit.category,
      severity: hit.severity,
      label: hit.label,
      explanation: hit.plain,
      evidence: hit.evidence || '',
    })),
    sponsorShields: shieldFlags(rating, categories, { linkHosts, urls }),
    shieldNotes: shieldNotes(rating, categories, { linkHosts, urls }),
    analyzedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
  };
}

function collectUrgencyHits(hits, haystack, senderTrusted) {
  const matched = findPhrases(haystack, URGENCY_PHRASES);

  // "Last chance, save big" is a sale when it comes from Target, and a warning
  // sign when it comes from a stranger.
  const found = senderTrusted
    ? matched.filter((phrase) => !PROMOTIONAL_URGENCY.has(phrase))
    : matched;

  if (!found.length) return;

  // Longest match reads best in an explanation ("account suspended" > "suspended").
  const phrase = found.sort((a, b) => b.length - a.length)[0];

  hits.push({
    id: 'urgency_pressure',
    category: 'urgency_pressure',
    severity: found.length >= 2 ? 'high' : 'medium',
    label: 'Tries to rush you',
    evidence: phrase,
    plain: `This message is trying to scare you into acting fast — it uses wording like ${quote(phrase)}. Real banks and government offices never give you a few hours to save your account.`,
  });
}

function collectFinancialHits(hits, haystack) {
  const found = findPhrases(haystack, FINANCIAL_LURES);
  if (!found.length) return;

  hits.push({
    id: 'wire_fraud',
    category: 'wire_fraud',
    severity: 'high',
    label: 'Asks for money you cannot get back',
    evidence: found[0],
    plain: `It brings up ${quote(found[0])}. Money sent by wire, gift card, or crypto is gone for good — that is exactly why scammers ask for it.`,
  });
}

function collectSenderHits(hits, ctx) {
  const { senderEmail, senderName, senderDomain, haystack } = ctx;

  if (!senderEmail) {
    hits.push({
      id: 'unverified_sender',
      category: 'unverified_sender',
      severity: 'low',
      label: 'Sender address is hidden',
      evidence: senderName || '',
      plain: 'We could not read a real email address for this sender, only a display name. A display name can say anything the sender wants.',
    });
    return;
  }

  for (const brand of IMPOSTER_BRANDS) {
    const claimsBrand = brand.tokens.some((token) => {
      const pattern = new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`, 'i');
      return pattern.test(haystack);
    });
    if (!claimsBrand) continue;

    const legitSender = brand.legit.some((base) => isWithinDomain(senderDomain, base));
    if (legitSender) continue;

    const spoofed = brand.tokens.some((token) => hostMentionsToken(senderDomain, token));
    const dressedUp =
      spoofed && SPOOF_SUFFIXES.some((suffix) => hostMentionsToken(senderDomain, suffix));

    if (spoofed) {
      hits.push({
        id: 'brand_domain_mismatch',
        category: 'brand_impersonation',
        severity: dressedUp ? 'critical' : 'high',
        label: `Pretends to be ${brand.name}`,
        evidence: senderDomain,
        plain: `This email looks like it is from ${brand.name}, but it was actually sent from ${quote(senderDomain)}. A real ${brand.name} message always ends in ${quote(brand.legit[0])}.`,
      });
      return;
    }

    if (FREEMAIL_DOMAINS.includes(senderDomain)) {
      hits.push({
        id: 'brand_from_freemail',
        category: 'brand_impersonation',
        severity: 'high',
        label: `Claims to be ${brand.name}`,
        evidence: senderDomain,
        plain: `It claims to be ${brand.name}, but it came from a free personal mailbox (${quote(senderDomain)}). ${brand.name} never writes to customers from an address like that.`,
      });
      return;
    }
  }

  if (suspiciousTldOf(senderDomain)) {
    hits.push({
      id: 'sender_throwaway_domain',
      category: 'lookalike_domain',
      severity: 'high',
      label: 'Sent from a throwaway website',
      evidence: senderDomain,
      plain: `The sender's address ends in ${quote(suspiciousTldOf(senderDomain))}. Those web addresses cost almost nothing and are usually thrown away after a few days of scamming.`,
    });
  }

  if (RAW_IP_RE.test(senderDomain)) {
    hits.push({
      id: 'sender_raw_ip',
      category: 'lookalike_domain',
      severity: 'high',
      label: 'Sender has no real website',
      evidence: senderDomain,
      plain: 'The sender address ends in a bare string of numbers instead of a company website. No legitimate business sends mail that way.',
    });
  }
}

function collectLinkHits(hits, ctx) {
  const { linkHosts, urls, senderDomain, haystack } = ctx;

  const ipHost = linkHosts.find((host) => RAW_IP_RE.test(host));
  if (ipHost) {
    hits.push({
      id: 'link_raw_ip',
      category: 'malicious_link',
      severity: 'critical',
      label: 'Link goes to a bare numeric address',
      evidence: ipHost,
      plain: `One link points at ${quote(ipHost)} — a bare string of numbers instead of a company website. That is a hallmark of a scam page.`,
    });
  }

  const throwaway = linkHosts.find((host) => suspiciousTldOf(host));
  if (throwaway) {
    hits.push({
      id: 'link_throwaway_domain',
      category: 'malicious_link',
      severity: 'high',
      label: 'Link goes to a throwaway website',
      evidence: throwaway,
      plain: `A link leads to ${quote(throwaway)}. Addresses ending in ${quote(suspiciousTldOf(throwaway))} are cheap, disposable sites that scammers set up and abandon.`,
    });
  }

  const shortened = linkHosts.find((host) =>
    URL_SHORTENERS.some((base) => isWithinDomain(host, base)),
  );
  if (shortened) {
    hits.push({
      id: 'link_shortener',
      category: 'malicious_link',
      severity: 'medium',
      label: 'Link destination is hidden',
      evidence: shortened,
      plain: `A link is hidden behind a shortener (${quote(shortened)}), so there is no way to see where it really takes you until it is too late.`,
    });
  }

  const lookalike = linkHosts.find((host) =>
    IMPOSTER_BRANDS.some(
      (brand) =>
        brand.tokens.some((token) => hostMentionsToken(host, token)) &&
        !brand.legit.some((base) => isWithinDomain(host, base)),
    ),
  );
  if (lookalike) {
    hits.push({
      id: 'link_lookalike_domain',
      category: 'lookalike_domain',
      severity: 'high',
      label: 'Link imitates a well-known company',
      evidence: lookalike,
      plain: `A link points to ${quote(lookalike)}. It borrows a familiar company name, but it is not that company's real website.`,
    });
  }

  // Credential-stealing pages love "@" tricks: https://chase.com@evil.top/login
  const userInfoTrick = urls.find((url) => /^https?:\/\/[^/\s]*@/i.test(url));
  if (userInfoTrick) {
    hits.push({
      id: 'link_userinfo_trick',
      category: 'credential_phishing',
      severity: 'critical',
      label: 'Link is disguised',
      evidence: userInfoTrick.slice(0, 80),
      plain: 'One link is built to look like a familiar website while actually sending you somewhere else. Only a scam needs to hide its destination that way.',
    });
  }

  const insecure = urls.find((url) => /^http:\/\//i.test(url) && !RAW_IP_RE.test(url));
  if (insecure && !hits.some((hit) => hit.category === 'malicious_link')) {
    hits.push({
      id: 'link_insecure',
      category: 'malicious_link',
      severity: 'low',
      label: 'Link is not secure',
      evidence: hostOfUrl(insecure) || insecure,
      plain: 'A link uses an unlocked connection, so anything you type on that page travels where others can read it.',
    });
  }

  const askedForCredentials =
    /\b(sign in|log ?in|verify your password|re-?enter your password|update your payment|confirm your (?:card|password|identity|ssn))\b/i;

  // "Sign in to your account" is ordinary wording when the link really does go to
  // the company's own website. It only becomes phishing when the destination is
  // somewhere we cannot vouch for.
  const unvouchedLinks = linkHosts.filter((host) => {
    if (isReputableDomain(host)) return false;
    if (IMPOSTER_BRANDS.some((brand) => brand.legit.some((base) => isWithinDomain(host, base)))) {
      return false;
    }
    const senderIsCredible = senderDomain && !suspiciousTldOf(senderDomain) && !RAW_IP_RE.test(senderDomain);
    return !(senderIsCredible && isWithinDomain(host, senderDomain));
  });

  if (
    unvouchedLinks.length &&
    askedForCredentials.test(haystack) &&
    !hits.some((hit) => hit.category === 'credential_phishing')
  ) {
    hits.push({
      id: 'credential_request',
      category: 'credential_phishing',
      severity: 'high',
      label: 'Asks for your password or card',
      evidence: senderDomain,
      plain: 'It wants you to follow a link and type in a password or card number. Companies you already do business with never need you to do that from an email.',
    });
  }
}

/**
 * Links that are not really web addresses. Kept separate because these survive the
 * reputable-sender whitelist — no real company sends one, so seeing one means the
 * message is forged or the account behind it is compromised.
 */
function collectProtocolHits(hits, rawText, declaredLinks) {
  const inText = DANGEROUS_PROTOCOL_RE.exec(asText(rawText))?.[0];
  const inLinks = (Array.isArray(declaredLinks) ? declaredLinks : []).find((link) =>
    /^(?!https?:)[a-z][a-z0-9+.-]*:/i.test(asText(link)),
  );

  const offender = inText || inLinks;
  if (!offender) return;

  hits.push({
    id: 'link_dangerous_protocol',
    category: 'malicious_link',
    severity: 'critical',
    label: 'Link runs a command instead of opening a page',
    evidence: asText(offender).slice(0, 60),
    plain: `One link is not an ordinary web address at all — it starts with ${quote(asText(offender).split(/[/?#]/)[0])}, which tells your computer to run something rather than show you a page. No real company ever sends a link like that.`,
  });
}

function collectSoftHits(hits, ctx) {
  const { haystack, subject, bodySnippet, senderTrusted } = ctx;

  const delivery = findPhrases(haystack, DELIVERY_PHRASES);
  if (delivery.length && !TRACKING_ID_RE.test(`${subject} ${bodySnippet}`)) {
    hits.push({
      id: 'delivery_notice_unverified',
      category: 'package_delivery_notice',
      severity: 'medium',
      label: 'Delivery notice with nothing to check',
      evidence: delivery[0],
      plain: `It talks about a package (${quote(delivery[0])}) but gives no tracking number you can look up. Fake delivery notices are one of the most common scams today.`,
    });
  }

  const marketing = findPhrases(haystack, MARKETING_PHRASES);
  if (marketing.length) {
    // An "unsubscribe" line on its own is normal on mail you asked for. Two or more
    // bulk markers means this is an advertisement you probably never signed up for.
    const onlyUnsubscribeLink = marketing.length === 1 && marketing[0] === 'unsubscribe';

    hits.push({
      id: 'bulk_marketing',
      category: 'bulk_marketing',
      severity: onlyUnsubscribeLink || senderTrusted ? 'low' : 'medium',
      label: 'Looks like bulk advertising',
      evidence: marketing[0],
      plain: senderTrusted
        ? 'This is an advertisement sent to a large mailing list rather than a personal message. It comes from the company it claims to, so it is safe to read, ignore, or unsubscribe from.'
        : 'This reads like an advertisement sent to a large mailing list rather than a personal message written to you. It is probably not dangerous, but nothing in it has been vouched for either.',
    });
  }
}

function decideRating(score, hits) {
  const severities = hits.map((hit) => hit.severity);
  if (severities.includes('critical')) return RATING.RED;
  if (severities.filter((severity) => severity === 'high').length >= 2) return RATING.RED;
  if (score >= 55) return RATING.RED;
  if (score >= 15) return RATING.YELLOW;
  return RATING.GREEN;
}

function pickPrimaryHit(hits) {
  const order = ['critical', 'high', 'medium', 'low'];
  return [...hits].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  )[0];
}

function describeConfidence(rating, hits) {
  if (rating === RATING.RED) {
    return hits.some((hit) => hit.severity === 'critical') ? 'high' : 'medium';
  }
  if (rating === RATING.YELLOW) return 'medium';
  return hits.length ? 'medium' : 'high';
}

function badgeFor(rating) {
  if (rating === RATING.RED) {
    return {
      emoji: '\uD83D\uDD34',
      label: 'Scam Alert',
      text: '\uD83D\uDD34 Scam Alert',
      className: 'canary-red',
      ariaLabel: 'Scam alert. This email looks dangerous. Activate for a plain-English explanation.',
    };
  }
  if (rating === RATING.YELLOW) {
    return {
      emoji: '\uD83D\uDFE1',
      label: 'Caution',
      text: '\uD83D\uDFE1 Caution',
      className: 'canary-yellow',
      ariaLabel: 'Caution. Something about this email is unusual. Activate for details.',
    };
  }
  return {
    emoji: '\uD83D\uDFE2',
    label: 'Safe',
    text: '\uD83D\uDFE2 Safe',
    className: 'canary-green',
    ariaLabel: 'Safe. Canary found nothing suspicious in this email.',
  };
}

function composeExplanation(rating, hits, sender) {
  if (rating === RATING.GREEN) {
    if (sender.senderTrusted) {
      const base = `This really was sent from ${quote(sender.senderDomain)}, a verified address belonging to a company we recognise.`;

      if (!sender.trustSuppressed) {
        return `${base} Canary checked the wording and every link and found nothing dangerous.`;
      }

      // Say *why* we stood down. Calling a genuine fraud alert "pushy sales
      // wording" would be both wrong and dangerous.
      return hits.some((hit) => hit.category === 'bulk_marketing')
        ? `${base} It is trying to sell you something, so the wording is pushy, but there is nothing in it that can harm you.`
        : `${base} A few phrases in it would normally make Canary cautious, but because the message genuinely came from them, there is nothing here that can harm you. If it asks you to do something important, it is still safest to contact the company the way you normally would rather than through this email.`;
    }

    const who = sender.senderDomain ? ` from ${quote(sender.senderDomain)}` : '';
    const base = `Canary checked who sent this${who}, the wording, and every link, and found nothing dangerous.`;
    return hits.length
      ? `${base} One small note: ${hits[0].plain.charAt(0).toLowerCase()}${hits[0].plain.slice(1)}`
      : `${base} It reads like an ordinary message.`;
  }

  const order = ['critical', 'high', 'medium', 'low'];
  const ranked = [...hits].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );

  const opener =
    rating === RATING.RED
      ? 'This is almost certainly a scam.'
      : 'Something about this email does not add up.';

  const body = ranked.slice(0, 2).map((hit) => hit.plain);
  const extra = ranked.length > 2 ? ` We spotted ${ranked.length - 2} more warning sign${ranked.length - 2 === 1 ? '' : 's'}.` : '';

  return `${opener} ${body.join(' ')}${extra}`.trim();
}

function composeRecommendation(rating, categories, senderTrusted) {
  if (rating === RATING.GREEN && senderTrusted && categories.includes('bulk_marketing')) {
    return 'This is a genuine message from a company you can look up, so there is nothing to worry about. If you would rather not receive these, use the unsubscribe link at the bottom instead of replying.';
  }

  if (rating === RATING.RED) {
    if (categories.includes('wire_fraud')) {
      return 'Do not send any money, gift cards, or account numbers, and do not reply. If someone claims to need payment urgently, hang up or close the email and call that company yourself using a number you already have. Then delete this message.';
    }
    if (categories.includes('credential_phishing') || categories.includes('brand_impersonation')) {
      return 'Do not click anything in this email and do not type your password anywhere it sends you. If you are worried about the account, open the company\u2019s app or type their website address yourself, or call the number on the back of your card. Then mark this email as phishing.';
    }
    return 'Do not click the links and do not reply. Delete this email, or mark it as phishing so your mail provider learns about it. If it mentions an account you really have, contact that company using a number or website you already trust.';
  }

  if (rating === RATING.YELLOW) {
    return 'Take your time with this one. Do not click the links. If you think it might be real, check it the slow way: open the company\u2019s website or app yourself, or call a number you already have. When in doubt, ask someone you trust to look at it with you.';
  }

  return 'Nothing suspicious found, so you can read this as usual. Keep the habit of stopping to think before sending money or typing a password, no matter who seems to be asking.';
}

function shieldFlags(rating, categories, ctx) {
  const risky = rating !== RATING.GREEN;
  const hasLinks = ctx.urls.length > 0 || ctx.linkHosts.length > 0;

  return {
    // Outbound links get opened inside a sandboxed VPN exit before you do.
    nordvpn: hasLinks,
    // Credential auto-fill is withheld on anything that smells like phishing.
    nordpass:
      risky &&
      (categories.includes('credential_phishing') ||
        categories.includes('brand_impersonation') ||
        categories.includes('malicious_link')),
    // Identity / dark-web exposure check on the sending domain.
    coveron:
      rating === RATING.RED ||
      categories.includes('lookalike_domain') ||
      categories.includes('brand_impersonation'),
    // Broker takedown / unsubscribe path, for list-sourced mail.
    incogni: categories.includes('bulk_marketing') || rating === RATING.RED,
    // Same protection when the same inbox is read over cellular data.
    saily: true,
  };
}

function shieldNotes(rating, categories, ctx) {
  const flags = shieldFlags(rating, categories, ctx);
  const linkCount = ctx.urls.length || ctx.linkHosts.length;

  return {
    nordvpn: flags.nordvpn
      ? `${linkCount} link${linkCount === 1 ? '' : 's'} opened in a protected sandbox before they can reach you.`
      : 'No links in this email, so there was nothing to sandbox.',
    nordpass: flags.nordpass
      ? 'Your saved passwords are blocked from filling in on the page this email points to.'
      : 'Password protection is armed and watching for fake sign-in pages.',
    coveron: flags.coveron
      ? 'The sending website matches patterns seen in dark-web scam kits — your identity details are being watched.'
      : 'No dark-web match for this sender.',
    incogni: flags.incogni
      ? 'This address can be pulled from the data-broker lists that leaked it. A removal request is ready to file.'
      : 'No broker removal needed for this message.',
    saily: 'The same checks run when you read this inbox on mobile data.',
  };
}

/* ------------------------------------------------------------------ *
 * Session state (survives popup closes, resets with the browser)
 * ------------------------------------------------------------------ */

const EMPTY_SESSION = {
  startedAt: Date.now(),
  emailsScanned: 0,
  threatsBlocked: 0,
  cautions: 0,
  downloadsScanned: 0,
  downloadsBlocked: 0,
  recent: [],
};

/** chrome.storage.session is ephemeral; fall back to local on older builds. */
const sessionArea = chrome.storage.session || chrome.storage.local;

async function readSession() {
  try {
    const stored = await sessionArea.get(SESSION_KEY);
    return { ...EMPTY_SESSION, ...(stored[SESSION_KEY] || {}) };
  } catch {
    return { ...EMPTY_SESSION };
  }
}

async function writeSession(next) {
  try {
    await sessionArea.set({ [SESSION_KEY]: next });
  } catch {
    // Storage is best-effort; a failed counter must never break analysis.
  }
}

async function recordEmailVerdict(verdict, context) {
  const session = await readSession();
  session.emailsScanned += 1;
  if (verdict.score === RATING.RED) session.threatsBlocked += 1;
  if (verdict.score === RATING.YELLOW) session.cautions += 1;

  if (verdict.score !== RATING.GREEN) {
    session.recent = [
      {
        fingerprint: verdict.fingerprint,
        rating: verdict.score,
        sender: context.sender || '',
        subject: context.subject || '',
        headline: verdict.threatLabel,
        at: verdict.analyzedAt,
      },
      ...session.recent,
    ].slice(0, 10);
  }

  await writeSession(session);
}

async function areShieldsEnabled() {
  try {
    const stored = await chrome.storage.local.get(SHIELDS_KEY);
    return stored[SHIELDS_KEY] !== false;
  } catch {
    return true;
  }
}

/** Fire-and-forget broadcast. Rejects when nothing is listening — that is fine. */
function broadcast(message) {
  try {
    const sending = chrome.runtime.sendMessage(message);
    if (sending && typeof sending.catch === 'function') sending.catch(() => {});
  } catch {
    // No receiver (no popup open). Nothing to do.
  }
}

/* ------------------------------------------------------------------ *
 * Message router — see shared/messages.md
 * ------------------------------------------------------------------ */

const analysisCache = new Map();
const CACHE_LIMIT = 300;

function cacheVerdict(verdict) {
  if (!verdict.fingerprint) return;
  analysisCache.set(verdict.fingerprint, verdict);
  if (analysisCache.size > CACHE_LIMIT) {
    analysisCache.delete(analysisCache.keys().next().value);
  }
}

async function handleAnalyzeEmail(payload) {
  const hasIdentity = asText(payload?.sender) || asText(payload?.subject);
  if (!hasIdentity) {
    throw Object.assign(new Error('ANALYZE_EMAIL needs at least a sender or a subject.'), {
      code: 'BAD_PAYLOAD',
    });
  }

  const cached = payload.fingerprint && analysisCache.get(payload.fingerprint);
  if (cached) return cached;

  if (!(await areShieldsEnabled())) {
    return { ...evaluateEmailPaused(payload) };
  }

  const verdict = evaluateEmail(payload);
  cacheVerdict(verdict);
  await recordEmailVerdict(verdict, payload);
  broadcast({ ok: true, type: 'EMAIL_ANALYSIS_RESULT', payload: verdict });
  return verdict;
}

/** Shields off: report a neutral verdict so no badge is drawn. */
function evaluateEmailPaused(payload) {
  return {
    fingerprint: asText(payload.fingerprint),
    score: RATING.GREEN,
    paused: true,
    threatCategory: 'none',
    threatLabel: 'Canary is paused',
    threatCategories: ['none'],
    simpleExplanation: 'Canary is switched off right now, so this email was not checked.',
    actionRecommendation: 'Open the Canary icon in your toolbar and switch the shield back on.',
    badge: badgeFor(RATING.GREEN),
    reasons: [],
    sponsorShields: {
      nordvpn: false,
      nordpass: false,
      coveron: false,
      incogni: false,
      saily: false,
    },
    shieldNotes: {},
    analyzedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
  };
}

const LAYER_DESCRIPTIONS = [
  { layer: 'nordvpn', name: 'NordVPN', title: 'Link sandbox', detail: 'Risky links are opened in a protected sandbox before you reach them.' },
  { layer: 'nordpass', name: 'NordPass', title: 'Password protection', detail: 'Saved passwords never fill in on a fake sign-in page.' },
  { layer: 'coveron', name: 'Coveron', title: 'Dark web check', detail: 'Sender websites are checked against known scam and breach lists.' },
  { layer: 'incogni', name: 'Incogni', title: 'Data broker removal', detail: 'Removal requests for the lists that leaked your address.' },
  { layer: 'saily', name: 'Saily', title: 'Safe mobile data', detail: 'The same protection follows you onto cellular data.' },
];

async function handleShieldsStatus() {
  const [shieldsEnabled, session] = await Promise.all([areShieldsEnabled(), readSession()]);

  const triggered = new Set();
  for (const entry of session.recent) {
    if (entry.rating === RATING.RED) {
      triggered.add('nordpass');
      triggered.add('coveron');
    }
  }
  if (session.downloadsScanned > 0) triggered.add('nordvpn');

  return {
    shieldsEnabled,
    engineVersion: ENGINE_VERSION,
    session: {
      startedAt: session.startedAt,
      emailsScanned: session.emailsScanned,
      threatsBlocked: session.threatsBlocked,
      cautions: session.cautions,
      downloadsScanned: session.downloadsScanned,
      downloadsBlocked: session.downloadsBlocked,
    },
    layers: LAYER_DESCRIPTIONS.map((layer) => ({
      ...layer,
      state: !shieldsEnabled ? 'offline' : triggered.has(layer.layer) ? 'triggered' : 'active',
    })),
    recent: session.recent,
  };
}

async function handleSetShieldsEnabled(payload) {
  const enabled = payload?.enabled !== false;
  await chrome.storage.local.set({ [SHIELDS_KEY]: enabled });
  return handleShieldsStatus();
}

/**
 * canary.fishing's "Add trusted contact" button: open the popup straight on
 * its add-contact form. The popup reads `popupIntent` when it loads.
 * If Chrome refuses to open the popup (no focused window, older Chrome),
 * fall back to the same page in a tab so the user is never stuck.
 */
async function handleOpenAddContact() {
  await chrome.storage.local.set({ popupIntent: 'add-contact' });
  try {
    await chrome.action.openPopup();
    return { opened: 'popup' };
  } catch {
    await chrome.storage.local.remove('popupIntent');
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html#add-contact') });
    return { opened: 'tab' };
  }
}

const HANDLERS = {
  OPEN_ADD_CONTACT: {
    responseType: 'OPEN_ADD_CONTACT_RESULT',
    run: () => handleOpenAddContact(),
  },
  ANALYZE_EMAIL: {
    responseType: 'EMAIL_ANALYSIS_RESULT',
    run: (payload) => handleAnalyzeEmail(payload),
  },
  GET_SHIELDS_STATUS: {
    responseType: 'SHIELDS_STATUS',
    run: () => handleShieldsStatus(),
  },
  SET_SHIELDS_ENABLED: {
    responseType: 'SHIELDS_STATUS',
    run: (payload) => handleSetShieldsEnabled(payload),
  },
  SCAN_DOWNLOAD: {
    responseType: 'DOWNLOAD_SCAN_RESULT',
    run: (payload) => handleScanDownload(payload),
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type;
  const handler = HANDLERS[type];

  if (!handler) {
    // Broadcasts we emit ourselves land here too; stay quiet about those.
    return false;
  }

  handler
    .run(message.payload || {})
    .then((payload) => {
      sendResponse({
        ok: true,
        type: handler.responseType,
        requestId: message.requestId,
        payload,
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        type: handler.responseType,
        requestId: message.requestId,
        error: {
          code: error?.code || 'INTERNAL_ERROR',
          message: error?.message || 'Canary could not finish this check.',
        },
      });
    });

  return true; // keep the channel open for the async reply
});

/* ------------------------------------------------------------------ *
 * Download interception
 * ------------------------------------------------------------------ */

function fileNameOf(item) {
  const direct = asText(item.filename);
  if (direct) return direct.split(/[\\/]/).pop();
  try {
    return decodeURIComponent(new URL(item.url).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

/**
 * Judge a download by its name and where it came from.
 * @returns {{rating: string, category: string, reason: string, evidence: string}}
 */
function inspectDownload(url, filename) {
  const name = filename.toLowerCase();
  const host = hostOfUrl(url);

  if (DOUBLE_EXTENSION_RE.test(name)) {
    return {
      rating: RATING.RED,
      category: 'malware_attachment',
      evidence: filename,
      reason: `${quote(filename)} is dressed up as a document, but the real ending makes it a program. Opening it would let a stranger run software on your computer.`,
    };
  }

  const extension = DANGEROUS_EXTENSIONS.find((ext) => name.endsWith(ext));
  if (extension) {
    return {
      rating: RATING.RED,
      category: 'malware_attachment',
      evidence: extension,
      reason: `${quote(filename)} is a program, not a document. Files ending in ${quote(extension)} can take over your computer as soon as you open them.`,
    };
  }

  if (RAW_IP_RE.test(host)) {
    return {
      rating: RATING.YELLOW,
      category: 'malicious_link',
      evidence: host,
      reason: `This file is coming from ${quote(host)} — a bare string of numbers instead of a real company website.`,
    };
  }

  const throwaway = suspiciousTldOf(host);
  if (throwaway) {
    return {
      rating: RATING.YELLOW,
      category: 'malicious_link',
      evidence: host,
      reason: `This file is coming from ${quote(host)}. Websites ending in ${quote(throwaway)} are cheap, disposable addresses that scammers favour.`,
    };
  }

  return { rating: RATING.GREEN, category: 'none', evidence: '', reason: '' };
}

async function pauseDownload(downloadId) {
  try {
    await chrome.downloads.pause(downloadId);
    return true;
  } catch {
    // Already finished, cancelled, or not resumable.
    return false;
  }
}

chrome.downloads.onCreated.addListener((item) => {
  void handleDownloadCreated(item);
});

async function handleDownloadCreated(item) {
  if (!(await areShieldsEnabled())) return;

  const filename = fileNameOf(item);
  const url = asText(item.url) || asText(item.finalUrl);
  const finding = inspectDownload(url, filename);

  const session = await readSession();
  session.downloadsScanned += 1;
  await writeSession(session);

  if (finding.rating === RATING.GREEN) return;

  const paused = await pauseDownload(item.id);

  broadcast({
    ok: true,
    type: 'DOWNLOAD_ALERT',
    payload: {
      downloadId: item.id,
      filename,
      url,
      host: hostOfUrl(url),
      rating: finding.rating,
      threatCategory: finding.category,
      action: paused ? 'paused' : 'allowed',
      badge: badgeFor(finding.rating),
      simpleExplanation: paused
        ? `We stopped a download so you can look at it first. ${finding.reason}`
        : `A risky download finished before we could hold it. ${finding.reason}`,
      actionRecommendation: paused
        ? 'If you were not expecting this file, throw it away. Only let it through if you asked a person you trust to send it.'
        : 'Do not open this file. Delete it from your Downloads folder.',
      sponsorShields: {
        nordvpn: true,
        nordpass: false,
        coveron: finding.rating === RATING.RED,
        incogni: false,
        saily: true,
      },
      scannedAt: Date.now(),
    },
  });
}

/**
 * Re-check a download, or apply the user's decision from the popup.
 * `decision: "allow"` resumes, `"block"` cancels, `"auto"` re-runs heuristics.
 */
async function handleScanDownload(payload) {
  const downloadId = Number(payload?.downloadId);
  if (!Number.isInteger(downloadId)) {
    throw Object.assign(new Error('SCAN_DOWNLOAD needs a numeric downloadId.'), {
      code: 'BAD_PAYLOAD',
    });
  }

  const [item] = await chrome.downloads.search({ id: downloadId });
  if (!item) {
    throw Object.assign(new Error(`No download found with id ${downloadId}.`), {
      code: 'DOWNLOAD_NOT_FOUND',
    });
  }

  const filename = asText(payload.filename) || fileNameOf(item);
  const url = asText(payload.url) || asText(item.url);
  const finding = inspectDownload(url, filename);
  const decision = payload.decision || 'auto';

  let action = 'paused';

  if (decision === 'allow') {
    try {
      await chrome.downloads.resume(downloadId);
      action = 'resumed';
    } catch {
      action = 'allowed';
    }
  } else if (decision === 'block' || (decision === 'auto' && finding.rating === RATING.RED)) {
    try {
      await chrome.downloads.cancel(downloadId);
      action = 'cancelled';
    } catch {
      action = 'allowed';
    }
    const session = await readSession();
    session.downloadsBlocked += 1;
    session.threatsBlocked += 1;
    await writeSession(session);
  } else if (finding.rating === RATING.GREEN) {
    try {
      await chrome.downloads.resume(downloadId);
      action = 'resumed';
    } catch {
      action = 'allowed';
    }
  }

  return {
    downloadId,
    filename,
    rating: finding.rating,
    action,
    threatCategory: finding.category,
    simpleExplanation:
      action === 'cancelled'
        ? `We removed this file before it could do any harm. ${finding.reason}`
        : finding.reason || 'This file looks like an ordinary download.',
    actionRecommendation:
      action === 'cancelled'
        ? 'Nothing else to do. If you truly need the file, ask the sender for a plain document instead.'
        : 'Only open files you were expecting from someone you know.',
    scannedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(SHIELDS_KEY);
  if (typeof stored[SHIELDS_KEY] !== 'boolean') {
    await chrome.storage.local.set({ [SHIELDS_KEY]: true });
  }
  await writeSession({ ...EMPTY_SESSION, startedAt: Date.now() });
});

chrome.runtime.onStartup.addListener(() => {
  void writeSession({ ...EMPTY_SESSION, startedAt: Date.now() });
});
