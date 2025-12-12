/**
 * Loading State Manager
 * 
 * Provides unified loading state management for the application.
 * Features:
 * - Reference counting for nested loading states
 * - Automatic overlay management
 * - Loading text customization
 * - Promise wrapping
 */

import { t } from '../i18n/index.js';
import { setAriaBusy, announce } from './accessibility';

// ========================================
// Type Definitions
// ========================================

/** Loading options */
export interface LoadingOptions {
  text?: string;
  target?: HTMLElement | string;
  announceToScreenReader?: boolean;
}

/** Loading state info */
export interface LoadingState {
  count: number;
  text: string;
  startTime: number;
}

// ========================================
// Loading Manager Class
// ========================================

/**
 * Loading Manager - Singleton class for managing loading states
 */
class LoadingManager {
  private loadingCount: number = 0;
  private overlay: HTMLElement | null = null;
  private textElement: HTMLElement | null = null;
  private loadingContent: HTMLElement | null = null;
  private states: Map<string, LoadingState> = new Map();
  
  constructor() {
    this.initElements();
  }
  
  /**
   * Initialize DOM element references
   */
  private initElements(): void {
    this.overlay = document.getElementById('actionOverlay');
    this.textElement = document.getElementById('actionOverlayText');
    this.loadingContent = document.getElementById('unifiedLoading');
  }
  
  /**
   * Ensure elements are initialized (for lazy init after DOM ready)
   */
  private ensureElements(): void {
    if (!this.overlay) {
      this.initElements();
    }
  }
  
  /**
   * Show loading overlay
   */
  show(options: LoadingOptions = {}): string {
    this.ensureElements();
    
    const { text = t('common.processing') || '处理中...', announceToScreenReader = true } = options;
    const id = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.loadingCount++;
    this.states.set(id, {
      count: 1,
      text,
      startTime: Date.now()
    });
    
    // Update UI only on first loading
    if (this.loadingCount === 1) {
      this.updateUI(text);
      
      if (announceToScreenReader) {
        announce(text);
      }
    }
    
    return id;
  }
  
  /**
   * Hide loading overlay
   */
  hide(id?: string): void {
    this.ensureElements();
    
    if (id && this.states.has(id)) {
      this.states.delete(id);
    }
    
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    
    if (this.loadingCount === 0) {
      this.hideUI();
    }
  }
  
  /**
   * Hide all loading states
   */
  hideAll(): void {
    this.loadingCount = 0;
    this.states.clear();
    this.hideUI();
  }
  
  /**
   * Update loading text
   */
  updateText(text: string): void {
    this.ensureElements();
    
    if (this.textElement) {
      this.textElement.textContent = text;
    }
  }
  
  /**
   * Check if currently loading
   */
  isLoading(): boolean {
    return this.loadingCount > 0;
  }
  
  /**
   * Get current loading count
   */
  getLoadingCount(): number {
    return this.loadingCount;
  }
  
  /**
   * Wrap a promise with loading state
   */
  async wrap<T>(promise: Promise<T>, options: LoadingOptions = {}): Promise<T> {
    const id = this.show(options);
    
    try {
      return await promise;
    } finally {
      this.hide(id);
    }
  }
  
  /**
   * Wrap an async function with loading state
   */
  wrapAsync<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    options: LoadingOptions = {}
  ): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
      return this.wrap(fn(...args), options);
    };
  }
  
  /**
   * Update UI to show loading
   */
  private updateUI(text: string): void {
    // Update text
    if (this.textElement) {
      this.textElement.textContent = text;
    }
    
    // Show loading content, hide success content
    if (this.loadingContent) {
      this.loadingContent.classList.remove('hidden');
    }
    
    const successContent = document.getElementById('unifiedSuccess');
    if (successContent) {
      successContent.classList.add('hidden');
    }
    
    // Show overlay
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
      setAriaBusy(this.overlay, true);
    }
    
    // Disable body scroll
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * Hide loading UI
   */
  private hideUI(): void {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
      setAriaBusy(this.overlay, false);
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
  }
}

// ========================================
// Singleton Instance
// ========================================

/** Global loading manager instance */
export const loadingManager = new LoadingManager();

// ========================================
// Convenience Functions
// ========================================

/**
 * Show loading overlay
 */
export function showLoading(text?: string): string {
  return loadingManager.show({ text });
}

/**
 * Hide loading overlay
 */
export function hideLoading(id?: string): void {
  loadingManager.hide(id);
}

/**
 * Hide all loading states
 */
export function hideAllLoading(): void {
  loadingManager.hideAll();
}

/**
 * Update loading text
 */
export function updateLoadingText(text: string): void {
  loadingManager.updateText(text);
}

/**
 * Check if currently loading
 */
export function isLoading(): boolean {
  return loadingManager.isLoading();
}

/**
 * Wrap a promise with loading state
 */
export function withLoading<T>(promise: Promise<T>, text?: string): Promise<T> {
  return loadingManager.wrap(promise, { text });
}

/**
 * Create a loading-wrapped async function
 */
export function createLoadingFunction<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  text?: string
): (...args: Args) => Promise<T> {
  return loadingManager.wrapAsync(fn, { text });
}

// ========================================
// Element-Specific Loading
// ========================================

/** Active element loading states */
const elementLoadingStates: WeakMap<HTMLElement, { originalContent: string; originalDisabled: boolean }> = new WeakMap();

/**
 * Show loading state on a specific element (e.g., button)
 */
export function showElementLoading(
  element: HTMLElement | null,
  loadingText?: string
): void {
  if (!element) return;
  
  // Save original state
  const isButton = element.tagName === 'BUTTON' || element.tagName === 'INPUT';
  elementLoadingStates.set(element, {
    originalContent: element.innerHTML,
    originalDisabled: isButton ? (element as HTMLButtonElement).disabled : false
  });
  
  // Apply loading state
  element.classList.add('is-loading');
  setAriaBusy(element, true);
  
  if (isButton) {
    (element as HTMLButtonElement).disabled = true;
  }
  
  if (loadingText) {
    element.innerHTML = `
      <span class="loading-spinner"></span>
      <span class="loading-text">${loadingText}</span>
    `;
  } else {
    // Just add spinner
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    element.insertBefore(spinner, element.firstChild);
  }
}

/**
 * Hide loading state on a specific element
 */
export function hideElementLoading(element: HTMLElement | null): void {
  if (!element) return;
  
  const state = elementLoadingStates.get(element);
  if (!state) return;
  
  // Restore original state
  element.classList.remove('is-loading');
  setAriaBusy(element, false);
  element.innerHTML = state.originalContent;
  
  const isButton = element.tagName === 'BUTTON' || element.tagName === 'INPUT';
  if (isButton) {
    (element as HTMLButtonElement).disabled = state.originalDisabled;
  }
  
  elementLoadingStates.delete(element);
}

/**
 * Wrap an async operation with element loading state
 */
export async function withElementLoading<T>(
  element: HTMLElement | null,
  promise: Promise<T>,
  loadingText?: string
): Promise<T> {
  showElementLoading(element, loadingText);
  
  try {
    return await promise;
  } finally {
    hideElementLoading(element);
  }
}

// ========================================
// Skeleton Loading
// ========================================

/**
 * Create a skeleton loading placeholder
 */
export function createSkeleton(
  type: 'text' | 'circle' | 'rect' = 'text',
  options: { width?: string; height?: string; lines?: number } = {}
): HTMLElement {
  const { width, height, lines = 1 } = options;
  
  const container = document.createElement('div');
  container.className = 'skeleton-container';
  
  for (let i = 0; i < lines; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton--${type}`;
    
    if (width) skeleton.style.width = width;
    if (height) skeleton.style.height = height;
    
    // Vary width for text lines to look more natural
    if (type === 'text' && lines > 1 && i === lines - 1) {
      skeleton.style.width = '60%';
    }
    
    container.appendChild(skeleton);
  }
  
  return container;
}

/**
 * Replace element content with skeleton loading
 */
export function showSkeletonLoading(
  element: HTMLElement | null,
  options: { type?: 'text' | 'circle' | 'rect'; lines?: number } = {}
): void {
  if (!element) return;
  
  const { type = 'text', lines = 3 } = options;
  
  // Save original content
  if (!element.dataset._originalContent) {
    element.dataset._originalContent = element.innerHTML;
  }
  
  // Create skeleton
  const skeleton = createSkeleton(type, { lines });
  element.innerHTML = '';
  element.appendChild(skeleton);
  element.classList.add('skeleton-loading');
}

/**
 * Remove skeleton loading and restore content
 */
export function hideSkeletonLoading(element: HTMLElement | null): void {
  if (!element) return;
  
  const originalContent = element.dataset._originalContent;
  if (originalContent !== undefined) {
    element.innerHTML = originalContent;
    delete element.dataset._originalContent;
  }
  
  element.classList.remove('skeleton-loading');
}

// ========================================
// Progress Loading
// ========================================

/** Progress loading state */
interface ProgressState {
  element: HTMLElement;
  progressBar: HTMLElement;
  textElement: HTMLElement | null;
  current: number;
  total: number;
}

const progressStates: Map<string, ProgressState> = new Map();

/**
 * Create a progress loading indicator
 */
export function createProgressLoading(
  container: HTMLElement | null,
  options: { id: string; total?: number; text?: string } = { id: 'default' }
): void {
  if (!container) return;
  
  const { id, total = 100, text } = options;
  
  // Create progress container
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-loading';
  progressContainer.setAttribute('role', 'progressbar');
  progressContainer.setAttribute('aria-valuenow', '0');
  progressContainer.setAttribute('aria-valuemin', '0');
  progressContainer.setAttribute('aria-valuemax', String(total));
  
  // Progress bar
  const progressTrack = document.createElement('div');
  progressTrack.className = 'progress-track';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.style.width = '0%';
  
  progressTrack.appendChild(progressBar);
  progressContainer.appendChild(progressTrack);
  
  // Text element
  let textElement: HTMLElement | null = null;
  if (text !== undefined) {
    textElement = document.createElement('div');
    textElement.className = 'progress-text';
    textElement.textContent = text || '0%';
    progressContainer.appendChild(textElement);
  }
  
  container.appendChild(progressContainer);
  
  // Store state
  progressStates.set(id, {
    element: progressContainer,
    progressBar,
    textElement,
    current: 0,
    total
  });
}

/**
 * Update progress loading
 */
export function updateProgress(
  id: string,
  current: number,
  text?: string
): void {
  const state = progressStates.get(id);
  if (!state) return;
  
  state.current = current;
  const percent = Math.min(100, (current / state.total) * 100);
  
  state.progressBar.style.width = `${percent}%`;
  state.element.setAttribute('aria-valuenow', String(current));
  
  if (state.textElement) {
    state.textElement.textContent = text ?? `${Math.round(percent)}%`;
  }
}

/**
 * Remove progress loading
 */
export function removeProgress(id: string): void {
  const state = progressStates.get(id);
  if (!state) return;
  
  state.element.remove();
  progressStates.delete(id);
}

// ========================================
// Export Default
// ========================================

export default loadingManager;
