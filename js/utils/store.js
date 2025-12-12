/**
 * State Management Store
 * 
 * A simple but effective state management solution for the PanguPay application.
 * Replaces scattered window.__ global variables with a centralized, reactive store.
 * 
 * Features:
 * - Centralized state management
 * - Subscription-based updates
 * - Immutable state updates
 * - DevTools-friendly debugging
 * 
 * @module utils/store
 */

/**
 * @typedef {Object} AppState
 * @property {import('../types.js').User|null} user - Current user data
 * @property {string} currentRoute - Current route path
 * @property {string} language - Current language code
 * @property {string} theme - Current theme ('light' | 'dark' | 'auto')
 * @property {boolean} isLoading - Global loading state
 * @property {Object} ui - UI-related state
 * @property {boolean} ui.modalOpen - Whether a modal is open
 * @property {string|null} ui.activePanel - Currently active panel
 * @property {Object} transfer - Transfer-related state
 * @property {string[]} transfer.selectedAddresses - Selected source addresses
 * @property {string} transfer.mode - Transfer mode ('normal' | 'cross' | 'pledge')
 */

/**
 * @typedef {(state: AppState, prevState: AppState) => void} StateListener
 */

/**
 * @typedef {(state: AppState) => any} StateSelector
 */

/**
 * Initial application state
 * @type {AppState}
 */
const initialState = {
  user: null,
  currentRoute: '/welcome',
  language: 'zh-CN',
  theme: 'auto',
  isLoading: false,
  ui: {
    modalOpen: false,
    activePanel: null
  },
  transfer: {
    selectedAddresses: [],
    mode: 'normal'
  }
};

/**
 * Simple State Store
 * Provides centralized state management with subscription support
 */
class Store {
  /**
   * Create a new Store instance
   * @param {Partial<AppState>} [initialState] - Initial state
   */
  constructor(initialState = /** @type {Partial<AppState>} */ ({})) {
    /** @type {AppState} */
    this._state = /** @type {AppState} */ ({ ...initialState });
    
    /** @type {Set<StateListener>} */
    this._listeners = new Set();
    
    /** @type {Map<StateSelector, Set<StateListener>>} */
    this._selectorListeners = new Map();
    
    /** @type {boolean} */
    this._devMode = typeof window !== 'undefined' && 
                    (window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1');
  }

  /**
   * Get current state (immutable copy)
   * @returns {AppState}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Get a specific part of state using a selector
   * @template T
   * @param {(state: AppState) => T} selector - State selector function
   * @returns {T}
   */
  select(selector) {
    return selector(this._state);
  }

  /**
   * Update state with new values
   * @param {Partial<AppState>} updates - Partial state updates
   */
  setState(updates) {
    const prevState = this._state;
    
    // Create new state with updates (shallow merge)
    this._state = {
      ...this._state,
      ...updates
    };

    // Deep merge for nested objects
    if (updates.ui) {
      this._state.ui = { ...prevState.ui, ...updates.ui };
    }
    if (updates.transfer) {
      this._state.transfer = { ...prevState.transfer, ...updates.transfer };
    }

    // Log state changes in dev mode
    if (this._devMode) {
      console.log('[Store] State updated:', {
        updates,
        newState: this._state
      });
    }

    // Notify all listeners
    this._notifyListeners(prevState);
  }

  /**
   * Update a specific nested path in state
   * @param {string} path - Dot-separated path (e.g., 'ui.modalOpen')
   * @param {any} value - New value
   */
  setPath(path, value) {
    const parts = path.split('.');
    const updates = {};
    let current = updates;

    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = { ...this._state[parts[i]] };
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
    this.setState(updates);
  }

  /**
   * Subscribe to all state changes
   * @param {StateListener} listener - Listener function
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Subscribe to specific state changes using a selector
   * @template T
   * @param {(state: AppState) => T} selector - State selector
   * @param {(value: T, prevValue: T) => void} listener - Listener function
   * @returns {() => void} Unsubscribe function
   */
  subscribeToSelector(selector, listener) {
    if (!this._selectorListeners.has(selector)) {
      this._selectorListeners.set(selector, new Set());
    }
    
    const wrappedListener = (state, prevState) => {
      const value = selector(state);
      const prevValue = selector(prevState);
      
      // Only call listener if selected value changed
      if (value !== prevValue) {
        listener(value, prevValue);
      }
    };

    this._selectorListeners.get(selector).add(wrappedListener);
    this._listeners.add(wrappedListener);

    return () => {
      this._listeners.delete(wrappedListener);
      const selectorSet = this._selectorListeners.get(selector);
      if (selectorSet) {
        selectorSet.delete(wrappedListener);
        if (selectorSet.size === 0) {
          this._selectorListeners.delete(selector);
        }
      }
    };
  }

  /**
   * Notify all listeners of state change
   * @private
   * @param {AppState} prevState - Previous state
   */
  _notifyListeners(prevState) {
    this._listeners.forEach(listener => {
      try {
        listener(this._state, prevState);
      } catch (err) {
        console.error('[Store] Listener error:', err);
      }
    });
  }

  /**
   * Reset store to initial state
   */
  reset() {
    const prevState = this._state;
    this._state = { ...initialState };
    this._notifyListeners(prevState);
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions() {
    this._listeners.clear();
    this._selectorListeners.clear();
  }
}

// Create and export the global store instance
export const store = new Store(initialState);

// ========================================
// Selector Helpers
// ========================================

/**
 * Select user from state
 * @param {AppState} state
 * @returns {import('../types.js').User|null}
 */
export const selectUser = (state) => state.user;

/**
 * Select current route from state
 * @param {AppState} state
 * @returns {string}
 */
export const selectRoute = (state) => state.currentRoute;

/**
 * Select theme from state
 * @param {AppState} state
 * @returns {string}
 */
export const selectTheme = (state) => state.theme;

/**
 * Select language from state
 * @param {AppState} state
 * @returns {string}
 */
export const selectLanguage = (state) => state.language;

/**
 * Select loading state
 * @param {AppState} state
 * @returns {boolean}
 */
export const selectIsLoading = (state) => state.isLoading;

/**
 * Select transfer mode
 * @param {AppState} state
 * @returns {string}
 */
export const selectTransferMode = (state) => state.transfer.mode;

/**
 * Select selected addresses for transfer
 * @param {AppState} state
 * @returns {string[]}
 */
export const selectSelectedAddresses = (state) => state.transfer.selectedAddresses;

// ========================================
// Action Helpers
// ========================================

/**
 * Set current user
 * @param {import('../types.js').User|null} user
 */
export function setUser(user) {
  store.setState({ user });
}

/**
 * Set current route
 * @param {string} route
 */
export function setRoute(route) {
  store.setState({ currentRoute: route });
}

/**
 * Set theme
 * @param {string} theme
 */
export function setThemeState(theme) {
  store.setState({ theme });
}

/**
 * Set language
 * @param {string} language
 */
export function setLanguageState(language) {
  store.setState({ language });
}

/**
 * Set loading state
 * @param {boolean} isLoading
 */
export function setLoading(isLoading) {
  store.setState({ isLoading });
}

/**
 * Set transfer mode
 * @param {string} mode
 */
export function setTransferMode(mode) {
  store.setState({ 
    transfer: { ...store.getState().transfer, mode } 
  });
}

/**
 * Set selected addresses for transfer
 * @param {string[]} addresses
 */
export function setSelectedAddresses(addresses) {
  store.setState({ 
    transfer: { ...store.getState().transfer, selectedAddresses: addresses } 
  });
}

/**
 * Open/close modal
 * @param {boolean} open
 */
export function setModalOpen(open) {
  store.setPath('ui.modalOpen', open);
}

// Export Store class for testing
export { Store };

// Export default store
export default store;
