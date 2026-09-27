console.log("🐤 CANARY: content.js loaded on", window.location.href);
'use strict';

/**
 * Canary — Gmail content script.
 *
 * Watches the inbox for message rows and opened threads, asks the service worker
 * to judge each one, and injects a traffic-light pill next to the subject.
 *
 * Every Gmail selector here is best-effort: Gmail's markup is obfuscated and
 * changes without notice, so all reads use optional chaining and all writes are
 * additive. If a selector stops matching, Canary quietly does nothing instead of
 * breaking the user's inbox.
 */

(() => {
  // Content scripts can be injected twice (extension reload, SPA re-navigation).
  if (window.__canaryContentActive) return;
  window.__canaryContentActive = true;

  const SCAN_DEBOUNCE_MS = 250;
  const MAX_ROWS_PER_PASS = 60;
  const SNIPPET_LIMIT = 400;
  const MAX_LINKS = 20;

  /* ---------------------------------------------------------------- *
   * Gmail selectors, in the order we trust them
   * ---------------------------------------------------------------- */

  const SELECTORS = {
    // One row per conversation in any list view (inbox, search, label).
    listRow: 'tr.zA',
    // The subject/snippet cell inside a row; the badge is inserted before it.
    listSubjectBlock: '.y6',
    listSubject: 'span.bog, .y6 span[id]',
    listSnippet: '.y2',
    listSenderCell: '.yX .yW span[email], .yW span[email], .yX .yW span, .yW',
    // An opened conversation.
    threadContainer: 'div[role="main"]',
    threadSubject: 'h2.hP',
    threadMessage: 'div.gs',
    threadSenderCell: 'span.gD[email], span.gD, .gE .go span[email]',
    threadBody: 'div.a3s',
  };

  const BADGE_CLASS = 'canary-badge';
  const BADGE_FLAG = 'canaryBadge';
  const INLINE_ALERT_CLASS = 'canary-inline-alert';

  /* ---------------------------------------------------------------- *
   * Helpers
   * ---------------------------------------------------------------- */

  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();

  /**
   * Read an element's text while ignoring anything Canary injected. Without this,
   * a badge sitting inside Gmail's subject heading becomes part of the subject we
   * extract, the fingerprint changes, and the email is analyzed forever.
   */
  function visibleText(el) {
    if (!el) return '';

    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.nodeValue ?? '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (isCanaryNode(node)) continue;
        text += visibleText(node);
      }
    }
    return clean(text);
  }

  const isCanaryNode = (node) =>
    Boolean(
      node.classList?.contains(BADGE_CLASS) || node.classList?.contains(INLINE_ALERT_CLASS),
    );

  /** Stable short hash so the worker can cache and we can spot recycled rows. */
  function fingerprintOf(parts) {
    const input = parts.join('\u0000');
    let hash = 5381;
    for (let index = 0; index < input.length; index += 1) {
      hash = ((hash << 5) + hash + input.charCodeAt(index)) | 0;
    }
    return (hash >>> 0).toString(36);
  }

  /** Gmail prefixes list snippets with " - ". Drop it so the text reads cleanly. */
  const stripSnippetDash = (text) => text.replace(/^[\s\u2013\u2014-]+/, '');

  function readSender(scope) {
    const holder =
      scope?.querySelector('span[email]') ?? scope?.querySelector(SELECTORS.listSenderCell);

    const email = clean(holder?.getAttribute?.('email'));
    const name = clean(holder?.getAttribute?.('name')) || clean(holder?.textContent);

    if (email && name && name.toLowerCase() !== email.toLowerCase()) {
      return `"${name}" <${email}>`;
    }
    if (email) return email;
    return name || clean(scope?.querySelector(SELECTORS.listSenderCell)?.textContent);
  }

  /** Absolute hrefs from the message body, so the worker can judge destinations. */
  function readLinks(scope) {
    const anchors = scope?.querySelectorAll?.('a[href]');
    if (!anchors) return [];

    const links = [];
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) continue;
      // Gmail wraps outbound links in its own redirector; unwrap to the real target.
      const wrapped = href.match(/[?&]q=([^&]+)/);
      const url = wrapped ? decodeURIComponent(wrapped[1]) : href;
      if (!links.includes(url)) links.push(url);
      if (links.length >= MAX_LINKS) break;
    }
    return links;
  }

  /* ---------------------------------------------------------------- *
   * Extraction
   * ---------------------------------------------------------------- */

  /** @returns {{sender: string, subject: string, bodySnippet: string, links: string[], fingerprint: string, source: string}|null} */
  function extractFromRow(row) {
    const sender = readSender(row);
    const subject = visibleText(row?.querySelector(SELECTORS.listSubject));
    const bodySnippet = stripSnippetDash(visibleText(row?.querySelector(SELECTORS.listSnippet)));

    if (!sender && !subject) return null;

    return {
      sender,
      subject,
      bodySnippet,
      links: [],
      fingerprint: fingerprintOf([sender, subject, bodySnippet]),
      source: 'list',
    };
  }

  function extractFromThread(messageEl, subjectEl) {
    const sender = readSender(messageEl);
    const subject = visibleText(subjectEl);
    const body = messageEl?.querySelector(SELECTORS.threadBody);
    const bodySnippet = visibleText(body).slice(0, SNIPPET_LIMIT);

    if (!sender && !subject) return null;

    return {
      sender,
      subject,
      bodySnippet,
      links: readLinks(body),
      fingerprint: fingerprintOf([sender, subject, bodySnippet.slice(0, 120)]),
      source: 'thread',
    };
  }

  /* ---------------------------------------------------------------- *
   * Badge
   * ---------------------------------------------------------------- */

  function buildBadge(verdict) {
    const score = verdict?.score === 'red' || verdict?.score === 'yellow' ? verdict.score : 'green';
    const badge = verdict?.badge ?? {};

    const el = document.createElement('span');
    el.className = `${BADGE_CLASS} canary-${score}`;
    el.dataset[BADGE_FLAG] = score;
    el.textContent = badge.text ?? defaultBadgeText(score);
    el.setAttribute('aria-label', badge.ariaLabel ?? el.textContent);
    el.title = verdict?.threatLabel || el.textContent;

    if (score === 'green') {
      el.setAttribute('role', 'img');
      return el;
    }

    // Yellow and red open the explanation, by mouse or by keyboard.
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-haspopup', 'dialog');

    const open = (event) => {
      // Gmail's row handler would otherwise open the email underneath us.
      event.preventDefault();
      event.stopPropagation();
      showExplanation(el, verdict);
    };

    el.addEventListener('click', open);
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') open(event);
    });
    // Gmail opens conversations on mousedown, before click ever fires.
    el.addEventListener('mousedown', (event) => event.stopPropagation());

    return el;
  }

  function defaultBadgeText(score) {
    if (score === 'red') return '\uD83D\uDD34 Scam Alert';
    if (score === 'yellow') return '\uD83D\uDFE1 Caution';
    return '\uD83D\uDFE2 Safe';
  }

  /**
   * Place the badge so it flows with the subject text. Gmail rows are a table and
   * the thread header is a flex box, so an inline-block span is the only shape
   * that is safe in both without disturbing the layout.
   */
  function attachBadge(host, badge, mode) {
    if (!host) return false;

    if (mode === 'before' && host.parentElement) {
      host.parentElement.insertBefore(badge, host);
      return true;
    }

    host.appendChild(badge);
    return true;
  }

  function removeExistingBadge(scope) {
    scope?.querySelectorAll?.(`.${BADGE_CLASS}`)?.forEach((badge) => badge.remove());
    scope?.querySelectorAll?.(`.${INLINE_ALERT_CLASS}`)?.forEach((alert) => alert.remove());
  }

  /* ---------------------------------------------------------------- *
   * Explanation surface
   * ---------------------------------------------------------------- */

  function showExplanation(badgeEl, verdict) {
    // Preferred path: the shared UI layer from ui/banner.js.
    if (typeof window.renderWarningBanner === 'function') {
      try {
        window.renderWarningBanner(badgeEl, verdict);
        return;
      } catch (error) {
        console.warn('[Canary] warning banner failed, falling back inline.', error);
      }
    }

    renderInlineFallback(badgeEl, verdict);
  }

  /**
   * Fallback used when ui/banner.js has not loaded. Built with DOM calls only —
   * no innerHTML — so nothing from an email can become markup.
   */
  function renderInlineFallback(badgeEl, verdict) {
    const container = badgeEl.closest('tr, div.gs, div') ?? badgeEl.parentElement;
    const existing = container?.querySelector(`.${INLINE_ALERT_CLASS}`);
    if (existing) {
      existing.remove();
      badgeEl.setAttribute('aria-expanded', 'false');
      return;
    }

    const alert = document.createElement('div');
    alert.className = `${INLINE_ALERT_CLASS} canary-${verdict?.score ?? 'yellow'}`;
    alert.setAttribute('role', 'alert');

    const heading = document.createElement('strong');
    heading.textContent = verdict?.threatLabel || defaultBadgeText(verdict?.score);
    alert.appendChild(heading);

    const explanation = document.createElement('p');
    explanation.textContent =
      verdict?.simpleExplanation ?? 'Canary flagged this email but could not load the details.';
    alert.appendChild(explanation);

    if (verdict?.actionRecommendation) {
      const advice = document.createElement('p');
      advice.textContent = verdict.actionRecommendation;
      alert.appendChild(advice);
    }

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Close';
    dismiss.addEventListener('click', (event) => {
      event.stopPropagation();
      alert.remove();
      badgeEl.setAttribute('aria-expanded', 'false');
      badgeEl.focus();
    });
    alert.appendChild(dismiss);

    alert.addEventListener('click', (event) => event.stopPropagation());
    alert.addEventListener('mousedown', (event) => event.stopPropagation());

    badgeEl.setAttribute('aria-expanded', 'true');
    (container ?? document.body).appendChild(alert);

    console.warn(
      `[Canary] ${verdict?.score ?? 'unknown'}: ${verdict?.simpleExplanation ?? 'no explanation'}`,
    );
  }

  /* ---------------------------------------------------------------- *
   * Messaging
   * ---------------------------------------------------------------- */

  let extensionAlive = true;

  /** Stop quietly once this copy of the script has lost its extension (e.g. after a reload). */
  function standDown() {
    if (!extensionAlive) return;
    extensionAlive = false;
    observer?.disconnect();
  }

  /** @returns {Promise<object|null>} the verdict payload, or null on any failure */
  async function requestAnalysis(payload) {
    if (!extensionAlive) return null;

    // After the extension is reloaded, this old copy of the script is cut off.
    // Newer Chrome removes chrome.runtime entirely instead of throwing, so check first.
    if (!chrome.runtime?.id) {
      standDown();
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_EMAIL',
        requestId: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payload,
      });

      if (!response) return null; // worker was torn down mid-flight
      if (response.ok === false) {
        console.warn('[Canary] analysis rejected:', response.error?.message);
        return null;
      }
      return response.payload ?? null;
    } catch (error) {
      // The old content script keeps running after an extension reload; once the
      // channel is gone there is nothing useful left to do, so stand down.
      if (
        !chrome.runtime?.id ||
        /Extension context invalidated|receiving end does not exist|reading 'sendMessage'/i.test(error?.message ?? '')
      ) {
        standDown();
        return null;
      }
      console.warn('[Canary] could not reach the background worker.', error);
      return null;
    }
  }

  /* ---------------------------------------------------------------- *
   * Scanning
   * ---------------------------------------------------------------- */

  const inFlight = new Set();

  /* ---------------------------------------------------------------- *
   * One verdict per email
   *
   * An inbox row only shows the sender, subject and a one-line preview, so its
   * verdict can be milder than the verdict for the full opened email (which also
   * sees the whole body and every link). Once an email has been opened, its
   * full verdict is remembered by Gmail's thread id and used for the inbox row
   * too, so the bird can never be yellow outside and red inside.
   * ---------------------------------------------------------------- */

  const THREAD_STORE_KEY = 'canaryThreadVerdicts';
  const THREAD_STORE_LIMIT = 300;
  const threadVerdicts = new Map();

  const threadStoreReady = (async () => {
    try {
      const saved = await chrome.storage.local.get(THREAD_STORE_KEY);
      Object.entries(saved?.[THREAD_STORE_KEY] ?? {}).forEach(([id, verdict]) =>
        threadVerdicts.set(id, verdict),
      );
    } catch {
      /* storage unavailable: fall back to per-view verdicts */
    }
  })();

  function threadIdOf(el) {
    if (!el) return null;
    const holder = el.matches?.('[data-legacy-thread-id]')
      ? el
      : el.querySelector?.('[data-legacy-thread-id]');
    return holder?.getAttribute('data-legacy-thread-id') || null;
  }

  function slimVerdict(verdict) {
    const { score, badge, threatLabel, simpleExplanation, actionRecommendation, reasons } = verdict;
    return { score, badge, threatLabel, simpleExplanation, actionRecommendation, reasons };
  }

  function rememberThreadVerdict(threadId, verdict) {
    if (!threadId) return;
    threadVerdicts.delete(threadId); // re-insert so the newest stays at the end
    threadVerdicts.set(threadId, slimVerdict(verdict));
    while (threadVerdicts.size > THREAD_STORE_LIMIT) {
      threadVerdicts.delete(threadVerdicts.keys().next().value);
    }
    try {
      void chrome.storage.local.set({ [THREAD_STORE_KEY]: Object.fromEntries(threadVerdicts) });
    } catch {
      /* ignore */
    }
  }

  function badgeRow(row, verdict) {
    removeExistingBadge(row);
    const subjectBlock = row.querySelector(SELECTORS.listSubjectBlock);
    const host = subjectBlock ?? row.querySelector(SELECTORS.listSubject)?.parentElement;
    attachBadge(host ?? row.lastElementChild, buildBadge(verdict), subjectBlock ? 'before' : 'append');
  }

  /** Inbox rows whose bird disagrees with the remembered full-email verdict. */
  function rowIsStale(row) {
    const known = threadVerdicts.get(threadIdOf(row));
    if (!known) return false;
    return row.querySelector(`.${BADGE_CLASS}`)?.dataset?.[BADGE_FLAG] !== known.score;
  }

  /** Tell the toolbar popup which email is open (or that none is). */
  let popupShowsThread = null;
  function publishToPopup(verdict, subject) {
    const key = verdict ? `${subject}|${verdict.score}` : '';
    if (key === popupShowsThread) return;
    popupShowsThread = key;
    try {
      void chrome.storage.local.set({
        lastScan: verdict
          ? {
              score: verdict.score,
              subject,
              threatLabel: verdict.threatLabel,
              simpleExplanation: verdict.simpleExplanation,
              actionRecommendation: verdict.actionRecommendation,
            }
          : null,
      });
    } catch {
      /* ignore */
    }
  }

  async function scanRow(row) {
    const data = extractFromRow(row);
    if (!data) return;

    // Gmail recycles row elements for new messages, so a row is "already scanned"
    // only while its contents are unchanged.
    // Skip only if this exact email is scanned AND its badge is still on screen.
    // Gmail redraws rows (hover, read/unread, new mail) and can wipe the badge;
    // in that case we must draw it again (the worker's cache makes this instant).
    await threadStoreReady;
    if (
      row.dataset.canaryScanned === 'true' &&
      row.dataset.canaryFingerprint === data.fingerprint &&
      row.querySelector(`.${BADGE_CLASS}`) &&
      !rowIsStale(row)
    ) {
      return;
    }
    if (inFlight.has(data.fingerprint)) return;

    if (row.dataset.canaryFingerprint && row.dataset.canaryFingerprint !== data.fingerprint) {
      removeExistingBadge(row);
    }

    row.dataset.canaryScanned = 'true';
    row.dataset.canaryFingerprint = data.fingerprint;
    inFlight.add(data.fingerprint);

    try {
      // An email that has been opened already has a full verdict: use that one.
      const verdict = threadVerdicts.get(threadIdOf(row)) ?? (await requestAnalysis(data));
      if (!verdict) {
        delete row.dataset.canaryScanned; // let a later pass retry
        retrySoon();
        return;
      }
      if (verdict.paused) {
        removeExistingBadge(row);
        return;
      }
      // The row may have been recycled while we waited.
      if (row.dataset.canaryFingerprint !== data.fingerprint || !row.isConnected) return;

      badgeRow(row, verdict);
    } finally {
      inFlight.delete(data.fingerprint);
    }
  }

  async function scanOpenThread() {
    const main = document.querySelector(SELECTORS.threadContainer);
    const subjectEl = main?.querySelector(SELECTORS.threadSubject);
    if (!subjectEl) {
      publishToPopup(null); // back in the inbox: popup goes back to "Open an email"
      return;
    }

    const messages = main?.querySelectorAll(SELECTORS.threadMessage);
    // Expanded messages carry a sender; the newest one is what the reader sees.
    const messageEl =
      Array.from(messages ?? [])
        .reverse()
        .find((candidate) => candidate.querySelector(SELECTORS.threadSenderCell)) ?? main;

    const data = extractFromThread(messageEl, subjectEl);
    if (!data) return;

    if (subjectEl.dataset.canaryFingerprint === data.fingerprint) return;
    if (inFlight.has(data.fingerprint)) return;

    subjectEl.dataset.canaryScanned = 'true';
    subjectEl.dataset.canaryFingerprint = data.fingerprint;
    inFlight.add(data.fingerprint);

    try {
      const verdict = await requestAnalysis(data);
      if (!verdict) {
        delete subjectEl.dataset.canaryScanned;
        delete subjectEl.dataset.canaryFingerprint;
        retrySoon();
        return;
      }
      if (!subjectEl.isConnected || subjectEl.dataset.canaryFingerprint !== data.fingerprint) return;

      removeExistingBadge(subjectEl);
      if (verdict.paused) return;

      // Inside the <h2> so the pill sits on the subject's baseline.
      attachBadge(subjectEl, buildBadge(verdict), 'append');

      // Make the inbox row for this email match, now and on every later visit.
      const threadId = threadIdOf(subjectEl);
      rememberThreadVerdict(threadId, verdict);
      if (threadId) {
        document.querySelectorAll(SELECTORS.listRow).forEach((row) => {
          if (threadIdOf(row) === threadId) badgeRow(row, verdict);
        });
      }
      publishToPopup(verdict, data.subject);
    } finally {
      inFlight.delete(data.fingerprint);
    }
  }

  function scanNow() {
    if (!extensionAlive) return;

    const rows = document.querySelectorAll(SELECTORS.listRow);
    let scanned = 0;
    for (const row of rows) {
      if (scanned >= MAX_ROWS_PER_PASS) break;
      if (
        row.dataset.canaryScanned === 'true' &&
        row.querySelector(`.${BADGE_CLASS}`) &&
        !rowIsStale(row)
      ) {
        continue;
      }
      void scanRow(row);
      scanned += 1;
    }

    void scanOpenThread();
  }

  /* ---------------------------------------------------------------- *
   * Observation
   * ---------------------------------------------------------------- */

  let scanTimer = null;
  let idleHandle = null;

  function scheduleScan() {
    if (!extensionAlive) return;

    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      // Gmail is busy right after a mutation burst; wait for a quiet moment.
      if (typeof requestIdleCallback === 'function') {
        if (idleHandle) cancelIdleCallback(idleHandle);
        idleHandle = requestIdleCallback(() => {
          idleHandle = null;
          scanNow();
        }, { timeout: 1000 });
      } else {
        scanNow();
      }
    }, SCAN_DEBOUNCE_MS);
  }

  const observer = new MutationObserver((mutations) => {
    // Ignore the mutations we caused ourselves, or we would loop forever.
    const relevant = mutations.some((mutation) => {
      const touched = [...mutation.addedNodes, ...mutation.removedNodes];
      return touched.some(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE &&
          !node.classList?.contains(BADGE_CLASS) &&
          !node.classList?.contains(INLINE_ALERT_CLASS),
      );
    });

    if (relevant) scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Safety net: a failed request (e.g. the background worker was still waking up)
  // gets another try shortly, and every few seconds we sweep for rows that lost
  // their badge. Cached verdicts make this cheap.
  let retryTimer = null;
  function retrySoon() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      scheduleScan();
    }, 1500);
  }
  setInterval(() => {
    if (!extensionAlive || document.hidden) return;
    const missing = Array.from(document.querySelectorAll(SELECTORS.listRow)).some(
      (row) => !row.querySelector(`.${BADGE_CLASS}`),
    );
    if (missing) scheduleScan();
  }, 3000);

  // Gmail navigates by changing the hash; rows get reused with new contents.
  window.addEventListener('hashchange', scheduleScan);

  scheduleScan();
})();
