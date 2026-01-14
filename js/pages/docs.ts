/**
 * Docs Page Module
 *
 * Renders the in-app documentation with sidebar navigation.
 * Content is maintained as bilingual Markdown files (zh-CN / en).
 */

import { marked } from 'marked';
import { store, selectLanguage } from '../utils/store.js';
import { globalEventManager } from '../utils/eventUtils.js';

type SupportedLang = 'zh-CN' | 'en';

type LocalizedText = Record<SupportedLang, string>;

interface DocGroup {
  id: string;
  title: LocalizedText;
}

interface DocItem {
  id: string;
  groupId: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  sourceUrl: LocalizedText;
}

const STORAGE_ACTIVE_DOC_KEY = 'pp.docs.activeDoc.v1';

const DOC_GROUPS: DocGroup[] = [
  {
    id: 'start',
    title: { 'zh-CN': '开始使用', en: 'Start Here' }
  },
  {
    id: 'transactions',
    title: { 'zh-CN': '交易与组织', en: 'Transactions' }
  },
  {
    id: 'security',
    title: { 'zh-CN': '安全与隐私', en: 'Security' }
  },
  {
    id: 'help',
    title: { 'zh-CN': '帮助与排查', en: 'Help' }
  },
  {
    id: 'developer',
    title: { 'zh-CN': '开发者', en: 'Developer' }
  }
];

const DOCS: DocItem[] = [
  {
    id: 'quick-start',
    groupId: 'start',
    title: { 'zh-CN': '快速开始', en: 'Quick Start' },
    subtitle: { 'zh-CN': '3 分钟完成第一次转账', en: 'Send your first transfer in 3 minutes' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/quick-start.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/quick-start.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'user-guide',
    groupId: 'start',
    title: { 'zh-CN': '用户指南', en: 'User Guide' },
    subtitle: { 'zh-CN': '从入门到熟练的一份温柔说明', en: 'A gentle walkthrough from zero to confident' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/user-guide.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/user-guide.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'transfer-guide',
    groupId: 'transactions',
    title: { 'zh-CN': '转账与交易指南', en: 'Transfers & Transactions' },
    subtitle: { 'zh-CN': '普通/跨链/质押模式的完整说明', en: 'Normal / Cross-chain / Pledge workflows explained' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/transfer-guide.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/transfer-guide.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'organization',
    groupId: 'transactions',
    title: { 'zh-CN': '组织与权限', en: 'Organization & Permissions' },
    subtitle: { 'zh-CN': '加入担保组织后会发生什么？', en: 'What changes after joining a guarantor org?' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/organization.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/organization.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'security',
    groupId: 'security',
    title: { 'zh-CN': '安全与备份', en: 'Security & Backup' },
    subtitle: { 'zh-CN': '保护私钥与密码的实用建议', en: 'Practical tips to protect keys and passwords' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/security.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/security.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'faq',
    groupId: 'help',
    title: { 'zh-CN': '常见问题（FAQ）', en: 'FAQ' },
    subtitle: { 'zh-CN': '你可能会问的，我们都提前回答', en: 'Quick answers to common questions' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/faq.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/faq.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'troubleshooting',
    groupId: 'help',
    title: { 'zh-CN': '故障排查', en: 'Troubleshooting' },
    subtitle: { 'zh-CN': '遇到报错时，按这份清单逐项检查', en: 'A calm checklist when something goes wrong' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/troubleshooting.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/troubleshooting.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'glossary',
    groupId: 'help',
    title: { 'zh-CN': '术语表', en: 'Glossary' },
    subtitle: { 'zh-CN': '把难懂的词翻译成好懂的话', en: 'Translate “blockchain words” into plain language' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/glossary.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/glossary.en.md', import.meta.url).toString()
    }
  },
  {
    id: 'dev-quickstart',
    groupId: 'developer',
    title: { 'zh-CN': '开发者快速开始', en: 'Developer Quickstart' },
    subtitle: { 'zh-CN': '本地联调、日志与常用排查路径', en: 'Local setup, logs, and debugging tips' },
    sourceUrl: {
      'zh-CN': new URL('../../docs/site/dev-quickstart.zh-CN.md', import.meta.url).toString(),
      en: new URL('../../docs/site/dev-quickstart.en.md', import.meta.url).toString()
    }
  }
];

const markdownCache = new Map<string, string>();
let renderToken = 0;

async function loadMarkdown(url: string): Promise<string> {
  const cached = markdownCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { method: 'GET', credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load doc (${res.status})`);
  const text = await res.text();
  markdownCache.set(url, text);
  return text;
}

function normalizeLang(lang: string | undefined | null): SupportedLang {
  return lang === 'en' ? 'en' : 'zh-CN';
}

function getActiveDocId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_ACTIVE_DOC_KEY);
    if (saved && DOCS.some(d => d.id === saved)) return saved;
  } catch { }
  return 'quick-start';
}

function setActiveDocId(id: string): void {
  try { localStorage.setItem(STORAGE_ACTIVE_DOC_KEY, id); } catch { }
}

function getDocById(id: string): DocItem | undefined {
  return DOCS.find(d => d.id === id);
}

function postProcessLinks(container: HTMLElement): void {
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
  links.forEach(a => {
    const href = (a.getAttribute('href') || '').trim();
    if (!href) return;
    const isExternal = /^https?:\/\//i.test(href);
    if (!isExternal) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

function renderSidebar(navEl: HTMLElement, lang: SupportedLang, activeDocId: string): void {
  const frag = document.createDocumentFragment();

  DOC_GROUPS.forEach(group => {
    const groupDocs = DOCS.filter(d => d.groupId === group.id);
    if (groupDocs.length === 0) return;

    const groupWrap = document.createElement('div');
    groupWrap.className = 'docs-nav-group';

    const title = document.createElement('div');
    title.className = 'docs-nav-title';
    title.textContent = group.title[lang];
    groupWrap.appendChild(title);

    groupDocs.forEach(doc => {
      const a = document.createElement('a');
      a.className = 'docs-nav-link' + (doc.id === activeDocId ? ' active' : '');
      a.href = 'javascript:void(0)';
      a.setAttribute('data-doc', doc.id);
      a.textContent = doc.title[lang];
      groupWrap.appendChild(a);
    });

    frag.appendChild(groupWrap);
  });

  navEl.replaceChildren(frag);
}

function renderDoc(
  titleEl: HTMLElement,
  subtitleEl: HTMLElement,
  contentEl: HTMLElement,
  lang: SupportedLang,
  docId: string
): void {
  const doc = getDocById(docId) || DOCS[0];
  if (!doc) return;

  titleEl.textContent = doc.title[lang];
  subtitleEl.textContent = doc.subtitle[lang];
  contentEl.innerHTML = `<p>${lang === 'en' ? 'Loading…' : '正在加载…'}</p>`;

  const token = ++renderToken;
  const url = doc.sourceUrl[lang] || doc.sourceUrl['zh-CN'];
  void loadMarkdown(url)
    .then((md) => {
      if (token !== renderToken) return;
      const html = marked.parse(md) as string;
      contentEl.innerHTML = html;
      postProcessLinks(contentEl);

      requestAnimationFrame(() => {
        const main = contentEl.closest('.docs-main');
        if (main) (main as HTMLElement).scrollTop = 0;
      });
    })
    .catch(() => {
      if (token !== renderToken) return;
      contentEl.innerHTML = `<div class="docs-alert warning">${lang === 'en'
        ? 'Failed to load this document. Please refresh and try again.'
        : '文档加载失败，请刷新页面后重试。'
        }</div>`;
    });
}

function renderAll(docId: string): void {
  const card = document.getElementById('docsCard');
  if (!card) return;

  const navEl = card.querySelector<HTMLElement>('#docsNav');
  const titleEl = card.querySelector<HTMLElement>('#docsTitle');
  const subtitleEl = card.querySelector<HTMLElement>('#docsSubtitle');
  const contentEl = card.querySelector<HTMLElement>('#docsContent');
  if (!navEl || !titleEl || !subtitleEl || !contentEl) return;

  const lang = normalizeLang(store.select(selectLanguage));
  const safeDocId = DOCS.some(d => d.id === docId) ? docId : DOCS[0]?.id || 'quick-start';

  renderSidebar(navEl, lang, safeDocId);
  renderDoc(titleEl, subtitleEl, contentEl, lang, safeDocId);
}

/**
 * Initialize docs page
 */
export function initDocsPage(): void {
  const card = document.getElementById('docsCard');
  if (!card) return;

  // Idempotent init
  if (!card.dataset._bind) {
    const navEl = card.querySelector<HTMLElement>('#docsNav');
    if (navEl) {
      globalEventManager.add(navEl, 'click', (ev: Event) => {
        const target = ev.target as Element | null;
        const link = target?.closest?.('[data-doc]') as HTMLElement | null;
        const id = link?.getAttribute('data-doc') || '';
        if (!id) return;
        ev.preventDefault();
        setActiveDocId(id);
        renderAll(id);
      });
    }

    // Re-render docs when language changes
    const w = window as unknown as Record<string, unknown>;
    if (!w.__docsLangUnsub) {
      (w as any).__docsLangUnsub = store.subscribeToSelector(selectLanguage, () => {
        renderAll(getActiveDocId());
      });
    }

    card.dataset._bind = '1';
  }

  renderAll(getActiveDocId());
}
