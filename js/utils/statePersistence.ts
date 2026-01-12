/**
 * Store Persistence (Single Source of Truth)
 *
 * Persists selected Store slices to localStorage as a side effect.
 *
 * Design:
 * - Store is the single source of truth
 * - localStorage is only used for startup hydration + persistence
 */

import { store, selectUser } from './store.js';
import { persistUserToStorage, User } from './storage';
import { SESSION_IGNORE_USER_KEY } from '../config/constants';

type Unsubscribe = () => void;

/** Store state shape - matches store.js AppState */
interface StoreState {
  user: User | null;
  currentRoute: string;
  theme: string;
  language: string;
  isLoading: boolean;
  // Note: isModalOpen may not exist in all versions
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

let unsubscribe: Unsubscribe | null = null;
let lastUserJson: string | null = null;
let pendingUserJson: string | null = null;

function computeUserJson(): string | null {
  const user = selectUser(store.getState());
  if (!user) return null;
  try {
    return JSON.stringify(user);
  } catch {
    return null;
  }
}

function persistNow(): void {
  const user = selectUser(store.getState());

  // If user is null, remove from storage.
  // If user is null, remove from storage.
  if (!user) {
    // CRITICAL: If we are locally ignoring the user (e.g. "Use Another Account" in Welcome Modal),
    // we must NOT clear the global localStorage. The user still exists, just not for this tab.
    if (sessionStorage.getItem(SESSION_IGNORE_USER_KEY) === 'true') {
      return;
    }

    if (lastUserJson !== null) {
      persistUserToStorage(null);
      lastUserJson = null;
    }
    pendingUserJson = null;
    return;
  }

  const json = pendingUserJson ?? computeUserJson();
  pendingUserJson = null;

  if (!json) {
    // Best-effort: if serialization fails, skip persisting.
    return;
  }

  if (json === lastUserJson) {
    return;
  }

  // Persist the exact snapshot (avoid re-serializing with possible non-determinism).
  try {
    persistUserToStorage(JSON.parse(json));
    lastUserJson = json;
  } catch {
    // ignore
  }
}

const persistDebounced = debounce(persistNow, 200);

/**
 * Start persisting Store.user into localStorage.
 * Safe to call multiple times (idempotent).
 */
export function initUserPersistence(): void {
  if (unsubscribe) return;

  // Seed last json from current Store to avoid immediate redundant write.
  lastUserJson = computeUserJson();

  // Use any for state types to avoid strict type checking issues between
  // store.js (uses types.js User) and storage.ts (uses its own User interface)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsubscribe = store.subscribe((state: any, prev: any) => {
    const nextUser = state.user as User | null;
    const prevUser = prev.user as User | null;

    // Fast path: if reference didn't change, skip.
    if (nextUser === prevUser) return;

    pendingUserJson = null;
    try {
      pendingUserJson = nextUser ? JSON.stringify(nextUser) : null;
    } catch {
      pendingUserJson = null;
    }

    persistDebounced();
  });

  // Flush on lifecycle events.
  window.addEventListener('beforeunload', flushUserPersistence);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushUserPersistence();
    }
  });
}

export function flushUserPersistence(): void {
  persistNow();
}

export function stopUserPersistence(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  window.removeEventListener('beforeunload', flushUserPersistence);
}
