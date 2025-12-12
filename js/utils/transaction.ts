/**
 * Transaction Operations Module
 * 
 * Provides transaction-like operations with rollback support for:
 * - localStorage operations
 * - DOM operations
 * - Multi-step processes
 */

// ========================================
// Type Definitions
// ========================================

/** Operation type */
export type OperationType = 'localStorage' | 'dom' | 'custom';

/** Operation definition */
export interface Operation {
  type: OperationType;
  key?: string;
  execute: () => void | Promise<void>;
  rollback?: () => void | Promise<void>;
  backup?: () => any;
}

/** Transaction options */
export interface TransactionOptions {
  onProgress?: (index: number, total: number) => void;
  onError?: (error: Error, operationIndex: number) => void;
  continueOnError?: boolean;
}

/** Transaction result */
export interface TransactionResult {
  success: boolean;
  executedCount: number;
  error?: Error;
  errorIndex?: number;
}

/** Backup entry */
interface BackupEntry {
  type: OperationType;
  key: string;
  data: any;
  rollback?: () => void | Promise<void>;
}

// ========================================
// Transaction Manager
// ========================================

/**
 * Execute a series of operations with rollback support
 */
export async function withTransaction(
  operations: Operation[],
  options: TransactionOptions = {}
): Promise<TransactionResult> {
  const { onProgress, onError, continueOnError = false } = options;
  const backups: BackupEntry[] = [];
  let executedCount = 0;
  
  try {
    // Execute operations
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      // Create backup if needed
      if (op.backup) {
        const backupData = op.backup();
        backups.push({
          type: op.type,
          key: op.key || `op-${i}`,
          data: backupData,
          rollback: op.rollback
        });
      } else if (op.type === 'localStorage' && op.key) {
        // Auto-backup for localStorage operations
        const data = localStorage.getItem(op.key);
        backups.push({
          type: 'localStorage',
          key: op.key,
          data,
          rollback: op.rollback
        });
      }
      
      try {
        // Execute operation
        await op.execute();
        executedCount++;
        
        if (onProgress) {
          onProgress(i + 1, operations.length);
        }
      } catch (error) {
        if (onError) {
          onError(error as Error, i);
        }
        
        if (!continueOnError) {
          throw error;
        }
      }
    }
    
    return {
      success: true,
      executedCount
    };
  } catch (error) {
    // Rollback on failure
    await rollbackOperations(backups);
    
    return {
      success: false,
      executedCount,
      error: error as Error,
      errorIndex: executedCount
    };
  }
}

/**
 * Rollback operations from backups
 */
async function rollbackOperations(backups: BackupEntry[]): Promise<void> {
  // Rollback in reverse order
  for (let i = backups.length - 1; i >= 0; i--) {
    const backup = backups[i];
    
    try {
      // Execute custom rollback if provided
      if (backup.rollback) {
        await backup.rollback();
        continue;
      }
      
      // Default rollback for localStorage
      if (backup.type === 'localStorage') {
        if (backup.data === null) {
          localStorage.removeItem(backup.key);
        } else {
          localStorage.setItem(backup.key, backup.data);
        }
      }
    } catch (e) {
      console.error(`Rollback failed for operation ${backup.key}:`, e);
    }
  }
}

// ========================================
// LocalStorage Transaction Helpers
// ========================================

/**
 * Create a localStorage operation
 */
export function createStorageOperation(
  key: string,
  value: any,
  options: { serialize?: boolean } = {}
): Operation {
  const { serialize = true } = options;
  
  return {
    type: 'localStorage',
    key,
    execute: () => {
      const data = serialize ? JSON.stringify(value) : value;
      localStorage.setItem(key, data);
    },
    backup: () => localStorage.getItem(key)
  };
}

/**
 * Create a localStorage remove operation
 */
export function createRemoveOperation(key: string): Operation {
  return {
    type: 'localStorage',
    key,
    execute: () => {
      localStorage.removeItem(key);
    },
    backup: () => localStorage.getItem(key)
  };
}

/**
 * Safe localStorage set with backup
 */
export async function safeSetItem(key: string, value: any): Promise<boolean> {
  const result = await withTransaction([
    createStorageOperation(key, value)
  ]);
  return result.success;
}

/**
 * Safe localStorage remove with backup
 */
export async function safeRemoveItem(key: string): Promise<boolean> {
  const result = await withTransaction([
    createRemoveOperation(key)
  ]);
  return result.success;
}

// ========================================
// DOM Transaction Helpers
// ========================================

/** DOM state snapshot */
interface DOMSnapshot {
  element: HTMLElement;
  parent: HTMLElement | null;
  nextSibling: Node | null;
  innerHTML: string;
  className: string;
  attributes: Record<string, string>;
}

/**
 * Create a DOM snapshot for rollback
 */
export function createDOMSnapshot(element: HTMLElement): DOMSnapshot {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value;
  }
  
  return {
    element,
    parent: element.parentElement,
    nextSibling: element.nextSibling,
    innerHTML: element.innerHTML,
    className: element.className,
    attributes
  };
}

/**
 * Restore DOM from snapshot
 */
export function restoreFromSnapshot(snapshot: DOMSnapshot): void {
  const { element, parent, nextSibling, innerHTML, className, attributes } = snapshot;
  
  // Restore attributes
  // First, remove all current attributes
  while (element.attributes.length > 0) {
    element.removeAttribute(element.attributes[0].name);
  }
  
  // Then restore saved attributes
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  
  // Restore content
  element.innerHTML = innerHTML;
  element.className = className;
  
  // Restore position if removed
  if (!element.parentElement && parent) {
    if (nextSibling) {
      parent.insertBefore(element, nextSibling);
    } else {
      parent.appendChild(element);
    }
  }
}

/**
 * Create a DOM operation with automatic snapshot
 */
export function createDOMOperation(
  element: HTMLElement,
  mutate: (el: HTMLElement) => void
): Operation {
  let snapshot: DOMSnapshot | null = null;
  
  return {
    type: 'dom',
    key: element.id || 'dom-element',
    backup: () => {
      snapshot = createDOMSnapshot(element);
      return snapshot;
    },
    execute: () => {
      mutate(element);
    },
    rollback: () => {
      if (snapshot) {
        restoreFromSnapshot(snapshot);
      }
    }
  };
}

// ========================================
// State Persistence
// ========================================

/** Application state checkpoint */
interface StateCheckpoint {
  id: string;
  timestamp: number;
  data: Record<string, string | null>;
}

/** Checkpoint storage */
const checkpoints: Map<string, StateCheckpoint> = new Map();

/**
 * Create a checkpoint of localStorage state
 */
export function createCheckpoint(
  id: string,
  keys: string[]
): StateCheckpoint {
  const data: Record<string, string | null> = {};
  
  for (const key of keys) {
    data[key] = localStorage.getItem(key);
  }
  
  const checkpoint: StateCheckpoint = {
    id,
    timestamp: Date.now(),
    data
  };
  
  checkpoints.set(id, checkpoint);
  
  return checkpoint;
}

/**
 * Restore from a checkpoint
 */
export function restoreCheckpoint(id: string): boolean {
  const checkpoint = checkpoints.get(id);
  if (!checkpoint) return false;
  
  for (const [key, value] of Object.entries(checkpoint.data)) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
  
  return true;
}

/**
 * Delete a checkpoint
 */
export function deleteCheckpoint(id: string): boolean {
  return checkpoints.delete(id);
}

/**
 * Get all checkpoint IDs
 */
export function getCheckpointIds(): string[] {
  return Array.from(checkpoints.keys());
}

/**
 * Clear all checkpoints
 */
export function clearAllCheckpoints(): void {
  checkpoints.clear();
}

// ========================================
// Auto-Save Manager
// ========================================

/** Auto-save configuration */
interface AutoSaveConfig {
  key: string;
  getData: () => any;
  interval?: number;
  debounceMs?: number;
  onSave?: (data: any) => void;
  onRestore?: (data: any) => void;
}

/** Auto-saver entry type */
interface AutoSaverEntry {
  stop: () => void;
  trigger?: () => void;
}

/** Active auto-savers */
const autoSavers: Map<string, AutoSaverEntry> = new Map();

/**
 * Start auto-saving data
 */
export function startAutoSave(config: AutoSaveConfig): () => void {
  const { key, getData, interval = 30000, debounceMs = 1000, onSave } = config;
  
  // Stop existing auto-saver for this key
  stopAutoSave(key);
  
  let debounceTimer: number | undefined;
  let intervalTimer: number | undefined;
  
  const save = (): void => {
    try {
      const data = getData();
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      if (onSave) {
        onSave(data);
      }
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  };
  
  // Debounced save function for manual triggers
  const debouncedSave = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(save, debounceMs);
  };
  
  // Start interval saving
  intervalTimer = window.setInterval(save, interval);
  
  // Initial save
  save();
  
  const stop = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    autoSavers.delete(key);
  };
  
  autoSavers.set(key, { stop, trigger: debouncedSave });
  
  return stop;
}

/**
 * Stop auto-saving
 */
export function stopAutoSave(key: string): void {
  const saver = autoSavers.get(key);
  if (saver) {
    saver.stop();
  }
}

/**
 * Restore auto-saved data
 */
export function restoreAutoSaved<T>(
  key: string,
  maxAge?: number
): T | null {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    const { data, timestamp } = JSON.parse(saved);
    
    // Check if data is too old
    if (maxAge && Date.now() - timestamp > maxAge) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Clear auto-saved data
 */
export function clearAutoSaved(key: string): void {
  localStorage.removeItem(key);
  stopAutoSave(key);
}

// ========================================
// Form Draft Manager
// ========================================

/**
 * Save form draft
 */
export function saveFormDraft(
  formId: string,
  data: Record<string, any>
): void {
  const key = `form-draft-${formId}`;
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
}

/**
 * Get form draft
 */
export function getFormDraft<T extends Record<string, any>>(
  formId: string,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours default
): T | null {
  const key = `form-draft-${formId}`;
  
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    
    const { data, timestamp } = JSON.parse(saved);
    
    if (Date.now() - timestamp > maxAge) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Clear form draft
 */
export function clearFormDraft(formId: string): void {
  const key = `form-draft-${formId}`;
  localStorage.removeItem(key);
}

/**
 * Auto-save form on input changes
 */
export function enableFormAutoSave(
  form: HTMLFormElement | string,
  formId: string,
  options: { debounceMs?: number; excludeFields?: string[] } = {}
): () => void {
  const { debounceMs = 1000, excludeFields = [] } = options;
  
  const formEl = typeof form === 'string' 
    ? document.querySelector<HTMLFormElement>(form)
    : form;
    
  if (!formEl) return () => {};
  
  let debounceTimer: number | undefined;
  
  const save = (): void => {
    const data: Record<string, any> = {};
    const formData = new FormData(formEl);
    
    for (const [key, value] of formData.entries()) {
      if (!excludeFields.includes(key)) {
        data[key] = value;
      }
    }
    
    saveFormDraft(formId, data);
  };
  
  const handleInput = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(save, debounceMs);
  };
  
  formEl.addEventListener('input', handleInput);
  formEl.addEventListener('change', handleInput);
  
  return () => {
    formEl.removeEventListener('input', handleInput);
    formEl.removeEventListener('change', handleInput);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

/**
 * Restore form from draft
 */
export function restoreFormFromDraft(
  form: HTMLFormElement | string,
  formId: string
): boolean {
  const formEl = typeof form === 'string'
    ? document.querySelector<HTMLFormElement>(form)
    : form;
    
  if (!formEl) return false;
  
  const draft = getFormDraft(formId);
  if (!draft) return false;
  
  for (const [name, value] of Object.entries(draft)) {
    const field = formEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (field) {
      if (field.type === 'checkbox') {
        (field as HTMLInputElement).checked = !!value;
      } else {
        field.value = String(value);
      }
    }
  }
  
  return true;
}
