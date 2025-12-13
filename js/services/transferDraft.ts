/**
 * Transfer Draft Persistence
 *
 * Persists and restores the transfer panel state (From selections, recipients, advanced options)
 * so refresh won't lose in-progress input.
 */

import { startAutoSave, restoreAutoSaved, clearAutoSaved, enableFormAutoSave, restoreFormFromDraft } from '../utils/transaction';

export interface RecipientDraft {
  to: string;
  val: string;
  mt: string;
  pub: string;
  gid: string;
  gas: string;
  expanded?: boolean;
}

export interface TransferDraft {
  version: 1;
  savedAt: number;
  srcAddr: string[];
  recipients: RecipientDraft[];
  advanced: {
    extraGasPGC: string;
    txGasInput: string;
    chAddrPGC: string;
    chAddrBTC: string;
    chAddrETH: string;
    useTXCerChk: boolean;
    tfMode: string;
    useTXCer: string;
    isPledge: string;
    optionsOpen: boolean;
  };
}

const AUTO_SAVE_KEY = 'auto-save-transfer-v1';
const FORM_DRAFT_ID = 'transfer-v1';

function getInputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el ? String(el.value ?? '') : '';
}

function setInputValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (el) el.value = value;
}

function getCheckedAddresses(): string[] {
  const list = document.getElementById('srcAddrList');
  if (!list) return [];
  return Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function setCheckedAddresses(addrs: string[]): void {
  const list = document.getElementById('srcAddrList');
  if (!list) return;

  const set = new Set(addrs);
  const inputs = Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  for (const cb of inputs) {
    cb.checked = set.has(cb.value);
  }

  // Update label selected state to match wallet.js behavior
  Array.from(list.querySelectorAll('label')).forEach(l => {
    const inp = l.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (inp) l.classList.toggle('selected', inp.checked);
  });

  // Trigger downstream recalculation (fillChange)
  list.dispatchEvent(new Event('change', { bubbles: true }));
}

function captureRecipients(): RecipientDraft[] {
  const billList = document.getElementById('billList');
  if (!billList) return [];

  const cards = Array.from(billList.querySelectorAll<HTMLElement>('.recipient-card'));
  return cards.map(card => {
    const to = (card.querySelector<HTMLInputElement>('[data-name="to"]')?.value ?? '').trim();
    const val = card.querySelector<HTMLInputElement>('[data-name="val"]')?.value ?? '';
    const mt = card.querySelector<HTMLElement>('[data-name="mt"]')?.getAttribute('data-val') ?? '0';
    const pub = card.querySelector<HTMLInputElement>('[data-name="pub"]')?.value ?? '';
    const gid = card.querySelector<HTMLInputElement>('[data-name="gid"]')?.value ?? '';
    const gas = card.querySelector<HTMLInputElement>('[data-name="gas"]')?.value ?? '';
    const expanded = card.classList.contains('expanded');

    return { to, val, mt, pub, gid, gas, expanded };
  });
}

function clearRecipients(): void {
  const billList = document.getElementById('billList');
  if (!billList) return;
  billList.innerHTML = '';
  delete (billList as any).dataset._recipientBind;
}

async function ensureRecipientCards(count: number): Promise<void> {
  const billList = document.getElementById('billList');
  if (!billList) return;

  const recipientModule = await import('./recipient.js');
  const computeCurrentOrgId = () => {
    if (typeof (window as any).computeCurrentOrgId === 'function') return (window as any).computeCurrentOrgId();
    return '';
  };

  while (billList.querySelectorAll('.recipient-card').length < count) {
    recipientModule.addRecipientCard(billList, computeCurrentOrgId);
  }
}

function setRecipientCurrency(card: HTMLElement, mt: string): void {
  const coinSelect = card.querySelector<HTMLElement>('[data-name="mt"]');
  if (coinSelect) {
    coinSelect.setAttribute('data-val', mt);
    const label = coinSelect.querySelector<HTMLElement>('.coin-label');
    if (label) {
      label.textContent = mt === '1' ? 'BTC' : mt === '2' ? 'ETH' : 'PGC';
    }
  }
  const hiddenMt = card.querySelector<HTMLInputElement>('[data-name="mt-hidden"]');
  if (hiddenMt) hiddenMt.value = mt;
}

function applyRecipients(recipients: RecipientDraft[]): Promise<void> {
  return (async () => {
    const billList = document.getElementById('billList');
    if (!billList) return;

    // Start from a clean slate
    clearRecipients();
    await ensureRecipientCards(Math.max(1, recipients.length));

    const cards = Array.from(billList.querySelectorAll<HTMLElement>('.recipient-card'));

    // If we have fewer drafts than cards, remove extras (keep at least 1)
    if (recipients.length > 0 && cards.length > recipients.length) {
      for (let i = cards.length - 1; i >= recipients.length && i >= 1; i--) {
        cards[i].remove();
      }
    }

    const finalCards = Array.from(billList.querySelectorAll<HTMLElement>('.recipient-card'));
    const toApply = recipients.length ? recipients : [{ to: '', val: '', mt: '0', pub: '', gid: '', gas: '' }];

    toApply.forEach((r, idx) => {
      const card = finalCards[idx];
      if (!card) return;

      const toEl = card.querySelector<HTMLInputElement>('[data-name="to"]');
      const valEl = card.querySelector<HTMLInputElement>('[data-name="val"]');
      const pubEl = card.querySelector<HTMLInputElement>('[data-name="pub"]');
      const gidEl = card.querySelector<HTMLInputElement>('[data-name="gid"]');
      const gasEl = card.querySelector<HTMLInputElement>('[data-name="gas"]');

      if (toEl) toEl.value = r.to ?? '';
      if (valEl) valEl.value = r.val ?? '';
      if (pubEl) pubEl.value = r.pub ?? '';
      if (gidEl) gidEl.value = r.gid ?? '';
      if (gasEl) gasEl.value = r.gas ?? '';
      setRecipientCurrency(card, r.mt ?? '0');

      if (r.expanded) {
        card.classList.add('expanded');
        const expandBtn = card.querySelector<HTMLElement>('[data-role="expand"]');
        const label = expandBtn?.querySelector<HTMLElement>('span');
        if (label) label.textContent = (window as any).t ? (window as any).t('transfer.collapseOptions') : '收起选项';
      } else {
        card.classList.remove('expanded');
      }
    });

    // Re-run initRecipientCards to ensure event bindings exist
    const walletModule = await import('./wallet.js');
    walletModule.initRecipientCards();
  })();
}

function setOptionsOpen(open: boolean): void {
  const optionsToggle = document.getElementById('optionsToggle');
  const optionsContent = document.getElementById('optionsContent');
  if (!optionsToggle || !optionsContent) return;

  optionsToggle.classList.toggle('active', open);
  optionsContent.classList.toggle('show', open);
}

function captureDraft(): TransferDraft {
  const optionsToggle = document.getElementById('optionsToggle');
  const isOpen = !!optionsToggle?.classList.contains('active');

  return {
    version: 1,
    savedAt: Date.now(),
    srcAddr: getCheckedAddresses(),
    recipients: captureRecipients(),
    advanced: {
      extraGasPGC: getInputValue('extraGasPGC'),
      txGasInput: getInputValue('txGasInput'),
      chAddrPGC: getInputValue('chAddrPGC'),
      chAddrBTC: getInputValue('chAddrBTC'),
      chAddrETH: getInputValue('chAddrETH'),
      useTXCerChk: !!(document.getElementById('useTXCerChk') as HTMLInputElement | null)?.checked,
      tfMode: getInputValue('tfMode'),
      useTXCer: getInputValue('useTXCer'),
      isPledge: getInputValue('isPledge'),
      optionsOpen: isOpen
    }
  };
}

async function applyDraft(draft: TransferDraft): Promise<void> {
  // Addresses first, so change-address menus can be preserved
  setCheckedAddresses(draft.srcAddr ?? []);

  // Advanced options values (set hidden selects before fillChange runs)
  setInputValue('extraGasPGC', draft.advanced?.extraGasPGC ?? '0');
  setInputValue('txGasInput', draft.advanced?.txGasInput ?? '1');
  setInputValue('chAddrPGC', draft.advanced?.chAddrPGC ?? '');
  setInputValue('chAddrBTC', draft.advanced?.chAddrBTC ?? '');
  setInputValue('chAddrETH', draft.advanced?.chAddrETH ?? '');

  const chk = document.getElementById('useTXCerChk') as HTMLInputElement | null;
  if (chk) chk.checked = !!draft.advanced?.useTXCerChk;

  setInputValue('tfMode', draft.advanced?.tfMode ?? 'quick');
  setInputValue('useTXCer', draft.advanced?.useTXCer ?? 'true');
  setInputValue('isPledge', draft.advanced?.isPledge ?? 'false');

  setOptionsOpen(!!draft.advanced?.optionsOpen);

  await applyRecipients(draft.recipients ?? []);
}

export function clearTransferDraft(): void {
  clearAutoSaved(AUTO_SAVE_KEY);
  try {
    localStorage.removeItem(`form-draft-${FORM_DRAFT_ID}`);
  } catch {
    // ignore
  }
}

/**
 * Restore transfer draft (structured auto-save first, then fallback form-draft).
 */
export async function restoreTransferDraft(): Promise<boolean> {
  const saved = restoreAutoSaved<TransferDraft>(AUTO_SAVE_KEY);
  if (saved && saved.version === 1) {
    try {
      await applyDraft(saved);
      return true;
    } catch {
      // fall through
    }
  }

  // Fallback to form-based draft
  const ok = restoreFormFromDraft('#transferForm', FORM_DRAFT_ID);
  return ok;
}

/**
 * Initialize transfer draft auto-save and best-effort restore.
 */
export function initTransferDraftPersistence(): () => void {
  // Form-draft: capture raw inputs too (helps if structured save fails)
  const stopForm = enableFormAutoSave('#transferForm', FORM_DRAFT_ID, {
    debounceMs: 800,
    includeUncheckedCheckboxes: true
  });

  // Structured auto-save: captures dynamic recipient cards and UI state
  const stopAuto = startAutoSave({
    key: AUTO_SAVE_KEY,
    getData: captureDraft,
    interval: 15000,
    debounceMs: 800
  });

  return () => {
    try { stopForm(); } catch { }
    try { stopAuto(); } catch { }
  };
}
