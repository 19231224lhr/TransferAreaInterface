/**
 * PanguPay Event Delegation System
 * 
 * A centralized event delegation system that eliminates the need for inline
 * onclick handlers in dynamically generated HTML. Instead, elements use
 * data-action attributes to specify which action to trigger.
 * 
 * Benefits:
 * - No inline onclick handlers (better CSP compliance)
 * - Automatic cleanup when elements are removed
 * - Centralized action registry for better maintainability
 * - Type-safe action handlers
 * - Support for passing parameters via data attributes
 * 
 * Usage:
 * HTML: <button data-action="showUtxoDetail" data-addr="xxx" data-key="yyy">详情</button>
 * JS:   registerAction('showUtxoDetail', (el, data) => { ... })
 * 
 * @module core/eventDelegate
 */

/**
 * Action handler function type.
 * @param element - The element that triggered the action
 * @param data - All data-* attributes from the element (excluding data-action)
 * @param event - The original DOM event
 */
export type ActionHandler = (
  element: HTMLElement,
  data: Record<string, string>,
  event: Event
) => void | Promise<void>;

/**
 * Action registry - maps action names to handler functions
 */
const actionRegistry = new Map<string, ActionHandler>();

/**
 * Whether the global delegate listener has been initialized
 */
let delegateInitialized = false;

/**
 * Extract all data-* attributes from an element (except data-action)
 */
function extractDataAttributes(element: HTMLElement): Record<string, string> {
  const data: Record<string, string> = {};
  const dataset = element.dataset;
  
  for (const key in dataset) {
    if (key !== 'action' && dataset[key] !== undefined) {
      data[key] = dataset[key] as string;
    }
  }
  
  return data;
}

/**
 * Find the closest element with a data-action attribute
 * Handles both HTML and SVG elements
 */
function findActionElement(target: EventTarget | null): HTMLElement | null {
  // Handle both HTMLElement and SVGElement (SVG elements have closest() but aren't HTMLElement)
  if (!(target instanceof Element)) return null;
  const actionEl = target.closest('[data-action]');
  // closest() returns Element, but we know data-action is only on HTMLElements
  return actionEl as HTMLElement | null;
}

/**
 * Global click handler for event delegation
 */
function handleGlobalClick(event: Event): void {
  const actionElement = findActionElement(event.target);
  if (!actionElement) return;
  
  const action = actionElement.dataset.action;
  if (!action) return;
  
  const handler = actionRegistry.get(action);
  if (!handler) {
    console.warn(`[EventDelegate] No handler registered for action: ${action}`);
    return;
  }
  
  // Prevent default for buttons and links with data-action
  if (actionElement.tagName === 'BUTTON' || actionElement.tagName === 'A') {
    event.preventDefault();
  }
  
  // Extract data attributes and call handler
  const data = extractDataAttributes(actionElement);
  
  try {
    const result = handler(actionElement, data, event);
    // Handle async handlers
    if (result instanceof Promise) {
      result.catch((err) => {
        console.error(`[EventDelegate] Error in async action handler "${action}":`, err);
      });
    }
  } catch (err) {
    console.error(`[EventDelegate] Error in action handler "${action}":`, err);
  }
}

/**
 * Initialize the global event delegation system.
 * Should be called once at application startup.
 */
export function initEventDelegate(): void {
  if (delegateInitialized) {
    console.warn('[EventDelegate] Already initialized, skipping.');
    return;
  }
  
  // Use capture phase to ensure we catch events before any stopPropagation
  document.addEventListener('click', handleGlobalClick, { capture: false });
  delegateInitialized = true;
  
  console.log('[EventDelegate] Global event delegation initialized.');
}

/**
 * Register an action handler.
 * 
 * @param actionName - The action name (used in data-action attribute)
 * @param handler - The handler function
 * @returns A cleanup function to unregister the action
 * 
 * @example
 * ```typescript
 * registerAction('showUtxoDetail', (el, data) => {
 *   const { addr, key } = data;
 *   showUtxoDetailModal(addr, key);
 * });
 * ```
 */
export function registerAction(actionName: string, handler: ActionHandler): () => void {
  if (actionRegistry.has(actionName)) {
    console.warn(`[EventDelegate] Overwriting existing handler for action: ${actionName}`);
  }
  
  actionRegistry.set(actionName, handler);
  
  // Return cleanup function
  return () => {
    actionRegistry.delete(actionName);
  };
}

/**
 * Unregister an action handler.
 * 
 * @param actionName - The action name to unregister
 */
export function unregisterAction(actionName: string): void {
  actionRegistry.delete(actionName);
}

/**
 * Check if an action is registered.
 * 
 * @param actionName - The action name to check
 */
export function hasAction(actionName: string): boolean {
  return actionRegistry.has(actionName);
}

/**
 * Get all registered action names.
 * Useful for debugging.
 */
export function getRegisteredActions(): string[] {
  return Array.from(actionRegistry.keys());
}

/**
 * Trigger an action programmatically.
 * 
 * @param actionName - The action to trigger
 * @param data - Data to pass to the handler
 * @param element - Optional element context (defaults to document.body)
 */
export function triggerAction(
  actionName: string,
  data: Record<string, string> = {},
  element: HTMLElement = document.body
): void {
  const handler = actionRegistry.get(actionName);
  if (!handler) {
    console.warn(`[EventDelegate] Cannot trigger unregistered action: ${actionName}`);
    return;
  }
  
  // Create a synthetic event
  const syntheticEvent = new CustomEvent('synthetic-action', {
    bubbles: false,
    cancelable: true,
  });
  
  handler(element, data, syntheticEvent);
}

/**
 * Register multiple actions at once.
 * 
 * @param actions - Object mapping action names to handlers
 * @returns A cleanup function to unregister all actions
 * 
 * @example
 * ```typescript
 * const cleanup = registerActions({
 *   showUtxoDetail: (el, data) => { ... },
 *   showTxCerDetail: (el, data) => { ... },
 *   copyAddress: (el, data) => { ... },
 * });
 * ```
 */
export function registerActions(
  actions: Record<string, ActionHandler>
): () => void {
  const cleanups: Array<() => void> = [];
  
  for (const [name, handler] of Object.entries(actions)) {
    cleanups.push(registerAction(name, handler));
  }
  
  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

/**
 * Destroy the event delegation system.
 * Removes the global listener and clears all registered actions.
 * Mainly useful for testing.
 */
export function destroyEventDelegate(): void {
  if (!delegateInitialized) return;
  
  document.removeEventListener('click', handleGlobalClick, { capture: false });
  actionRegistry.clear();
  delegateInitialized = false;
  
  console.log('[EventDelegate] Event delegation destroyed.');
}

// Default export
export default {
  init: initEventDelegate,
  register: registerAction,
  registerMany: registerActions,
  unregister: unregisterAction,
  has: hasAction,
  trigger: triggerAction,
  getAll: getRegisteredActions,
  destroy: destroyEventDelegate,
};
