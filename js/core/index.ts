/**
 * PanguPay Core Module
 * 
 * Central module that exports all core functionality:
 * - Namespace management
 * - Event delegation system
 * - Type definitions
 * 
 * @module core
 */

// Export namespace utilities
export { initNamespace, getNamespace, registerAPIs } from './namespace';

// Export event delegation system
export {
  initEventDelegate,
  registerAction,
  registerActions,
  unregisterAction,
  hasAction,
  getRegisteredActions,
  triggerAction,
  destroyEventDelegate,
} from './eventDelegate';
export type { ActionHandler } from './eventDelegate';

// Export types
export type {
  PanguPayNamespace,
  RouterNamespace,
  I18nNamespace,
  ThemeNamespace,
  AccountNamespace,
  StorageNamespace,
  WalletNamespace,
  UINamespace,
  ChartsNamespace,
  TransactionNamespace,
  CryptoNamespace,
  UtilsNamespace,
  PerformanceNamespace,
  EventsNamespace,
  StateNamespace,
  FormNamespace,
  ScreenLockNamespace,
  TemplateNamespace,
  NetworkNamespace,
  PagesNamespace,
} from './types';
