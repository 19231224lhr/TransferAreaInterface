/**
 * Accessibility (A11y) Utility Module
 * 
 * Provides accessibility-related utilities including:
 * - ARIA attribute management
 * - Keyboard navigation helpers
 * - Focus management
 * - Screen reader announcements
 * - Skip links
 */

import { t } from '../i18n/index.js';

// ========================================
// Type Definitions
// ========================================

/** Focus trap options */
export interface FocusTrapOptions {
  initialFocus?: HTMLElement | string;
  returnFocus?: boolean;
  escapeCallback?: () => void;
}

/** Live region priority */
export type LiveRegionPriority = 'polite' | 'assertive' | 'off';

/** Keyboard navigation options */
export interface KeyboardNavOptions {
  loop?: boolean;
  orientation?: 'horizontal' | 'vertical' | 'both';
  onSelect?: (element: HTMLElement, index: number) => void;
}

// ========================================
// ARIA Attribute Helpers
// ========================================

/**
 * Set ARIA label on an element
 */
export function setAriaLabel(element: HTMLElement | null, label: string): void {
  if (element) {
    element.setAttribute('aria-label', label);
  }
}

/**
 * Set ARIA described-by on an element
 */
export function setAriaDescribedBy(element: HTMLElement | null, id: string): void {
  if (element) {
    element.setAttribute('aria-describedby', id);
  }
}

/**
 * Set ARIA expanded state
 */
export function setAriaExpanded(element: HTMLElement | null, expanded: boolean): void {
  if (element) {
    element.setAttribute('aria-expanded', String(expanded));
  }
}

/**
 * Set ARIA hidden state
 */
export function setAriaHidden(element: HTMLElement | null, hidden: boolean): void {
  if (element) {
    element.setAttribute('aria-hidden', String(hidden));
  }
}

/**
 * Set ARIA selected state
 */
export function setAriaSelected(element: HTMLElement | null, selected: boolean): void {
  if (element) {
    element.setAttribute('aria-selected', String(selected));
  }
}

/**
 * Set ARIA disabled state
 */
export function setAriaDisabled(element: HTMLElement | null, disabled: boolean): void {
  if (element) {
    element.setAttribute('aria-disabled', String(disabled));
  }
}

/**
 * Set ARIA busy state (for loading)
 */
export function setAriaBusy(element: HTMLElement | null, busy: boolean): void {
  if (element) {
    element.setAttribute('aria-busy', String(busy));
  }
}

/**
 * Set ARIA live region
 */
export function setAriaLive(element: HTMLElement | null, priority: LiveRegionPriority): void {
  if (element) {
    element.setAttribute('aria-live', priority);
  }
}

/**
 * Set multiple ARIA attributes at once
 */
export function setAriaAttributes(element: HTMLElement | null, attributes: Record<string, string | boolean>): void {
  if (!element) return;
  
  for (const [key, value] of Object.entries(attributes)) {
    const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
    element.setAttribute(ariaKey, String(value));
  }
}

/**
 * Remove ARIA attribute
 */
export function removeAriaAttribute(element: HTMLElement | null, attribute: string): void {
  if (element) {
    const ariaAttr = attribute.startsWith('aria-') ? attribute : `aria-${attribute}`;
    element.removeAttribute(ariaAttr);
  }
}

// ========================================
// Focus Management
// ========================================

/** Selector for focusable elements */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => {
      // Additional check for visibility
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

/**
 * Get first focusable element in a container
 */
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  const focusables = getFocusableElements(container);
  return focusables[0] || null;
}

/**
 * Get last focusable element in a container
 */
export function getLastFocusable(container: HTMLElement): HTMLElement | null {
  const focusables = getFocusableElements(container);
  return focusables[focusables.length - 1] || null;
}

/**
 * Focus element with scroll prevention option
 */
export function focusElement(element: HTMLElement | null, preventScroll: boolean = false): void {
  if (element && typeof element.focus === 'function') {
    element.focus({ preventScroll });
  }
}

/**
 * Store the currently focused element for later restoration
 */
let previouslyFocusedElement: HTMLElement | null = null;

/**
 * Save current focus for later restoration
 */
export function saveFocus(): void {
  previouslyFocusedElement = document.activeElement as HTMLElement;
}

/**
 * Restore previously saved focus
 */
export function restoreFocus(): void {
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
  }
}

// ========================================
// Focus Trap
// ========================================

/** Active focus traps */
const activeFocusTraps: Map<HTMLElement, { cleanup: () => void }> = new Map();

/**
 * Create a focus trap within a container
 * Keeps focus within the container until released
 */
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): () => void {
  const { initialFocus, returnFocus = true, escapeCallback } = options;
  
  // Save current focus if return is enabled
  if (returnFocus) {
    saveFocus();
  }
  
  // Set initial focus
  let firstFocusTarget: HTMLElement | null = null;
  
  if (initialFocus) {
    if (typeof initialFocus === 'string') {
      firstFocusTarget = container.querySelector(initialFocus);
    } else {
      firstFocusTarget = initialFocus;
    }
  }
  
  if (!firstFocusTarget) {
    firstFocusTarget = getFirstFocusable(container);
  }
  
  // Delay focus to allow for animations
  requestAnimationFrame(() => {
    focusElement(firstFocusTarget);
  });
  
  // Handle keyboard events for trapping
  const handleKeyDown = (event: KeyboardEvent): void => {
    // Handle Escape key
    if (event.key === 'Escape' && escapeCallback) {
      event.preventDefault();
      escapeCallback();
      return;
    }
    
    // Handle Tab key for trapping
    if (event.key !== 'Tab') return;
    
    const focusables = getFocusableElements(container);
    if (focusables.length === 0) return;
    
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    
    if (event.shiftKey) {
      // Shift+Tab: go to last element if at first
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: go to first element if at last
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  
  // Add event listener
  container.addEventListener('keydown', handleKeyDown);
  
  // Cleanup function
  const cleanup = (): void => {
    container.removeEventListener('keydown', handleKeyDown);
    activeFocusTraps.delete(container);
    
    if (returnFocus) {
      restoreFocus();
    }
  };
  
  // Store cleanup reference
  activeFocusTraps.set(container, { cleanup });
  
  return cleanup;
}

/**
 * Release focus trap on a container
 */
export function releaseFocusTrap(container: HTMLElement): void {
  const trap = activeFocusTraps.get(container);
  if (trap) {
    trap.cleanup();
  }
}

/**
 * Release all active focus traps
 */
export function releaseAllFocusTraps(): void {
  activeFocusTraps.forEach(trap => trap.cleanup());
  activeFocusTraps.clear();
}

// ========================================
// Keyboard Navigation
// ========================================

/**
 * Enable arrow key navigation within a group of elements
 */
export function enableKeyboardNavigation(
  container: HTMLElement,
  itemSelector: string,
  options: KeyboardNavOptions = {}
): () => void {
  const { loop = true, orientation = 'vertical', onSelect } = options;
  
  const getItems = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(itemSelector))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
  };
  
  const handleKeyDown = (event: KeyboardEvent): void => {
    const items = getItems();
    if (items.length === 0) return;
    
    const currentIndex = items.findIndex(item => item === document.activeElement || item.contains(document.activeElement as Node));
    let nextIndex = currentIndex;
    
    const isNext = (orientation === 'horizontal')
      ? event.key === 'ArrowRight'
      : (orientation === 'vertical')
        ? event.key === 'ArrowDown'
        : event.key === 'ArrowDown' || event.key === 'ArrowRight';
    
    const isPrev = (orientation === 'horizontal')
      ? event.key === 'ArrowLeft'
      : (orientation === 'vertical')
        ? event.key === 'ArrowUp'
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    
    if (isNext) {
      event.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        nextIndex = loop ? 0 : items.length - 1;
      }
    } else if (isPrev) {
      event.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = loop ? items.length - 1 : 0;
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = items.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Selection
      if (onSelect && currentIndex >= 0) {
        event.preventDefault();
        onSelect(items[currentIndex], currentIndex);
      }
      return;
    } else {
      return;
    }
    
    // Focus the next item
    if (nextIndex !== currentIndex && items[nextIndex]) {
      items[nextIndex].focus();
    }
  };
  
  container.addEventListener('keydown', handleKeyDown);
  
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

// ========================================
// Screen Reader Announcements
// ========================================

/** Live region element for announcements */
let liveRegion: HTMLElement | null = null;

/**
 * Initialize the live region for screen reader announcements
 */
export function initLiveRegion(): void {
  if (liveRegion) return;
  
  liveRegion = document.createElement('div');
  liveRegion.id = 'a11y-live-region';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  
  // Visually hidden but accessible to screen readers
  Object.assign(liveRegion.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0'
  });
  
  document.body.appendChild(liveRegion);
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: LiveRegionPriority = 'polite'): void {
  if (!liveRegion) {
    initLiveRegion();
  }
  
  if (!liveRegion) return;
  
  // Set priority
  liveRegion.setAttribute('aria-live', priority);
  
  // Clear and set message (triggers announcement)
  liveRegion.textContent = '';
  
  // Small delay to ensure the clear is processed
  requestAnimationFrame(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  });
}

/**
 * Announce an error to screen readers (assertive)
 */
export function announceError(message: string): void {
  announce(message, 'assertive');
}

/**
 * Announce a success to screen readers
 */
export function announceSuccess(message: string): void {
  announce(message, 'polite');
}

// ========================================
// Skip Links
// ========================================

/**
 * Create a skip link element
 */
export function createSkipLink(targetId: string, text?: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `#${targetId}`;
  link.className = 'skip-link';
  link.textContent = text || t('a11y.skipToMain') || '跳到主要内容';
  
  // Click handler for smooth focus
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  return link;
}

/**
 * Initialize skip links for the page
 */
export function initSkipLinks(): void {
  // Check if skip link already exists
  if (document.querySelector('.skip-link')) return;
  
  // Create skip link to main content
  const mainContent = document.querySelector('main') || document.getElementById('walletCard');
  if (mainContent) {
    const mainId = mainContent.id || 'main-content';
    if (!mainContent.id) {
      mainContent.id = mainId;
    }
    
    const skipLink = createSkipLink(mainId, t('a11y.skipToMain') || '跳到主要内容');
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
}

// ========================================
// Role Management
// ========================================

/**
 * Set element role
 */
export function setRole(element: HTMLElement | null, role: string): void {
  if (element) {
    element.setAttribute('role', role);
  }
}

/**
 * Make an element a button (for non-button elements acting as buttons)
 */
export function makeAccessibleButton(element: HTMLElement): void {
  setRole(element, 'button');
  element.setAttribute('tabindex', '0');
  
  // Add keyboard support
  if (!element.dataset._a11yButton) {
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        element.click();
      }
    });
    element.dataset._a11yButton = 'true';
  }
}

/**
 * Make a list accessible
 */
export function makeAccessibleList(container: HTMLElement, itemSelector: string): void {
  setRole(container, 'list');
  
  const items = container.querySelectorAll(itemSelector);
  items.forEach(item => {
    setRole(item as HTMLElement, 'listitem');
  });
}

/**
 * Make a tab list accessible
 */
export function makeAccessibleTabList(
  tabList: HTMLElement,
  tabSelector: string,
  panelSelector: string
): void {
  setRole(tabList, 'tablist');
  
  const tabs = tabList.querySelectorAll<HTMLElement>(tabSelector);
  const panels = document.querySelectorAll<HTMLElement>(panelSelector);
  
  tabs.forEach((tab, index) => {
    setRole(tab, 'tab');
    tab.id = tab.id || `tab-${index}`;
    tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
    
    if (panels[index]) {
      const panel = panels[index];
      panel.id = panel.id || `panel-${index}`;
      setRole(panel, 'tabpanel');
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', tab.id);
    }
  });
}

// ========================================
// Initialize Accessibility Features
// ========================================

/**
 * Initialize all accessibility features
 */
export function initAccessibility(): void {
  // Initialize live region
  initLiveRegion();
  
  // Initialize skip links
  initSkipLinks();
}

/**
 * Enhance existing elements with accessibility attributes
 * Call this after DOM is loaded or after dynamic content is added
 */
export function enhanceAccessibility(): void {
  // Enhance buttons without aria-labels
  const buttons = document.querySelectorAll<HTMLButtonElement>('button:not([aria-label])');
  buttons.forEach(btn => {
    // Use title or inner text as aria-label if needed
    if (!btn.textContent?.trim() && btn.title) {
      setAriaLabel(btn, btn.title);
    }
  });
  
  // Enhance inputs without labels
  const inputs = document.querySelectorAll<HTMLInputElement>('input:not([aria-label])');
  inputs.forEach(input => {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
    if (!label && input.placeholder) {
      setAriaLabel(input, input.placeholder);
    }
  });
  
  // Enhance links that open in new windows
  const externalLinks = document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
  externalLinks.forEach(link => {
    if (!link.getAttribute('aria-label')?.includes('新窗口') && 
        !link.getAttribute('aria-label')?.includes('new window')) {
      const currentLabel = link.getAttribute('aria-label') || link.textContent || '';
      link.setAttribute('aria-label', `${currentLabel} (${t('a11y.opensNewWindow') || '在新窗口打开'})`);
    }
  });
  
  // Ensure images have alt text
  const images = document.querySelectorAll<HTMLImageElement>('img:not([alt])');
  images.forEach(img => {
    img.setAttribute('alt', '');
  });
}

// ========================================
// Color Contrast Helpers
// ========================================

/**
 * Calculate relative luminance of a color
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  // Parse hex colors
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ];
  };
  
  try {
    const [r1, g1, b1] = parseHex(color1);
    const [r2, g2, b2] = parseHex(color2);
    
    const l1 = getLuminance(r1, g1, b1);
    const l2 = getLuminance(r2, g2, b2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 1;
  }
}

/**
 * Check if contrast meets WCAG AA standard (4.5:1 for normal text, 3:1 for large text)
 */
export function meetsContrastAA(color1: string, color2: string, isLargeText: boolean = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standard (7:1 for normal text, 4.5:1 for large text)
 */
export function meetsContrastAAA(color1: string, color2: string, isLargeText: boolean = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}
