/**
 * Form Validation Module
 * 
 * Provides unified form validation with:
 * - Declarative validation rules
 * - Consistent error display
 * - Real-time validation feedback
 * - Accessibility support
 */

import { t } from '../i18n/index.js';
import { setAriaDescribedBy, announce } from './accessibility';

// ========================================
// Type Definitions
// ========================================

/** Validation rule function */
export type ValidatorFn = (value: any, formData?: FormData | Record<string, any>) => string | null;

/** Built-in validator names */
export type BuiltInValidator = 
  | 'required'
  | 'address'
  | 'privateKey'
  | 'amount'
  | 'orgId'
  | 'email'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'numeric'
  | 'integer'
  | 'positive';

/** Validation rule definition */
export interface ValidationRule {
  validator: BuiltInValidator | ValidatorFn;
  message?: string;
  params?: Record<string, any>;
}

/** Field validation config */
export interface FieldConfig {
  rules: ValidationRule[];
  errorContainer?: HTMLElement | string;
  validateOnBlur?: boolean;
  validateOnInput?: boolean;
  debounceMs?: number;
}

/** Form validation config */
export interface FormConfig {
  fields: Record<string, FieldConfig>;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  validateOnSubmit?: boolean;
  preventSubmitOnInvalid?: boolean;
}

/** Validation result */
export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  values: Record<string, any>;
}

// ========================================
// Built-in Validators
// ========================================

/**
 * Built-in validators map
 */
export const validators: Record<BuiltInValidator, (params?: Record<string, any>) => ValidatorFn> = {
  /**
   * Required field validator
   */
  required: () => (value: any): string | null => {
    if (value === null || value === undefined || value === '' || 
        (Array.isArray(value) && value.length === 0)) {
      return t('validation.required') || '此字段为必填';
    }
    return null;
  },
  
  /**
   * Address format validator
   */
  address: () => (value: any): string | null => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      return null; // Let required validator handle empty
    }
    
    const normalized = value.trim().replace(/^0x/i, '').toLowerCase();
    
    if (normalized.length !== 40) {
      return t('validation.addressLength') || '地址长度必须为40位十六进制字符';
    }
    
    if (!/^[0-9a-f]+$/i.test(normalized)) {
      return t('validation.addressFormat') || '地址格式错误，必须为十六进制字符';
    }
    
    return null;
  },
  
  /**
   * Private key format validator
   */
  privateKey: () => (value: any): string | null => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      return null;
    }
    
    const normalized = value.trim().replace(/^0x/i, '');
    
    if (normalized.length !== 64) {
      return t('validation.privateKeyLength') || '私钥长度必须为64位十六进制字符';
    }
    
    if (!/^[0-9a-f]+$/i.test(normalized)) {
      return t('validation.privateKeyFormat') || '私钥格式错误，必须为十六进制字符';
    }
    
    return null;
  },
  
  /**
   * Amount validator
   */
  amount: (params = {}) => (value: any): string | null => {
    const { min = 0, max = Number.MAX_SAFE_INTEGER, decimals = 8 } = params;
    
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    
    const num = typeof value === 'number' ? value : parseFloat(String(value).trim());
    
    if (!Number.isFinite(num)) {
      return t('validation.amountInvalid') || '无效的金额';
    }
    
    if (num <= min) {
      if (min === 0 || min < 0.00000001) {
        return t('validation.amountPositive') || '金额必须大于0';
      }
      return (t('validation.amountMin') || '金额必须大于 {min}').replace('{min}', String(min));
    }
    
    if (num > max) {
      return t('validation.amountTooLarge') || '金额超出安全范围';
    }
    
    const strAmount = String(value);
    const decimalPart = strAmount.split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      return (t('validation.amountDecimals') || '最多支持 {decimals} 位小数').replace('{decimals}', String(decimals));
    }
    
    return null;
  },
  
  /**
   * Organization ID validator
   */
  orgId: () => (value: any): string | null => {
    if (!value || !String(value).trim()) {
      return null;
    }
    
    const trimmed = String(value).trim();
    
    if (!/^\d{8}$/.test(trimmed)) {
      return t('validation.orgIdFormat') || '担保组织ID必须为8位数字';
    }
    
    return null;
  },
  
  /**
   * Email validator
   */
  email: () => (value: any): string | null => {
    if (!value || typeof value !== 'string' || !value.trim()) {
      return null;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) {
      return t('validation.emailInvalid') || '请输入有效的电子邮件地址';
    }
    
    return null;
  },
  
  /**
   * Minimum length validator
   */
  minLength: (params = {}) => (value: any): string | null => {
    const { length = 1 } = params;
    
    if (!value || typeof value !== 'string') {
      return null;
    }
    
    if (value.length < length) {
      return (t('validation.minLength') || '最少需要 {length} 个字符').replace('{length}', String(length));
    }
    
    return null;
  },
  
  /**
   * Maximum length validator
   */
  maxLength: (params = {}) => (value: any): string | null => {
    const { length = 100 } = params;
    
    if (!value || typeof value !== 'string') {
      return null;
    }
    
    if (value.length > length) {
      return (t('validation.maxLength') || '最多允许 {length} 个字符').replace('{length}', String(length));
    }
    
    return null;
  },
  
  /**
   * Regex pattern validator
   */
  pattern: (params = {}) => (value: any): string | null => {
    const { regex, message = t('validation.patternMismatch') || '格式不正确' } = params;
    
    if (!value || typeof value !== 'string' || !regex) {
      return null;
    }
    
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    if (!pattern.test(value)) {
      return message;
    }
    
    return null;
  },
  
  /**
   * Numeric validator
   */
  numeric: () => (value: any): string | null => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    
    if (isNaN(Number(value))) {
      return t('validation.numeric') || '请输入数字';
    }
    
    return null;
  },
  
  /**
   * Integer validator
   */
  integer: () => (value: any): string | null => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    
    if (!Number.isInteger(Number(value))) {
      return t('validation.integer') || '请输入整数';
    }
    
    return null;
  },
  
  /**
   * Positive number validator
   */
  positive: () => (value: any): string | null => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return t('validation.positive') || '请输入正数';
    }
    
    return null;
  }
};

// ========================================
// Form Validator Class
// ========================================

/**
 * Form Validator - Manages validation for a form
 */
export class FormValidator {
  private form: HTMLFormElement;
  private config: FormConfig;
  private errors: Record<string, string> = {};
  private cleanupFns: (() => void)[] = [];
  private debounceTimers: Map<string, number> = new Map();
  
  constructor(form: HTMLFormElement | string, config: FormConfig) {
    const formEl = typeof form === 'string' ? document.querySelector<HTMLFormElement>(form) : form;
    
    if (!formEl) {
      throw new Error('Form element not found');
    }
    
    this.form = formEl;
    this.config = config;
    
    this.init();
  }
  
  /**
   * Initialize form validation
   */
  private init(): void {
    // Setup field validation listeners
    for (const [fieldName, fieldConfig] of Object.entries(this.config.fields)) {
      const field = this.getField(fieldName);
      if (!field) continue;
      
      // Blur validation
      if (fieldConfig.validateOnBlur !== false) {
        const blurHandler = () => this.validateField(fieldName);
        field.addEventListener('blur', blurHandler);
        this.cleanupFns.push(() => field.removeEventListener('blur', blurHandler));
      }
      
      // Input validation (debounced)
      if (fieldConfig.validateOnInput) {
        const debounceMs = fieldConfig.debounceMs ?? 300;
        
        const inputHandler = () => {
          const existingTimer = this.debounceTimers.get(fieldName);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          const timer = window.setTimeout(() => {
            this.validateField(fieldName);
            this.debounceTimers.delete(fieldName);
          }, debounceMs);
          
          this.debounceTimers.set(fieldName, timer);
        };
        
        field.addEventListener('input', inputHandler);
        this.cleanupFns.push(() => field.removeEventListener('input', inputHandler));
      }
    }
    
    // Form submit handling
    if (this.config.preventSubmitOnInvalid !== false) {
      const submitHandler = (e: Event) => {
        const result = this.validate();
        if (!result.valid) {
          e.preventDefault();
          
          // Focus first invalid field
          const firstErrorField = Object.keys(result.errors)[0];
          if (firstErrorField) {
            const field = this.getField(firstErrorField);
            if (field) {
              field.focus();
              announce(result.errors[firstErrorField], 'assertive');
            }
          }
        }
      };
      
      this.form.addEventListener('submit', submitHandler);
      this.cleanupFns.push(() => this.form.removeEventListener('submit', submitHandler));
    }
  }
  
  /**
   * Get form field element
   */
  private getField(name: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
    return this.form.querySelector(`[name="${name}"]`) || 
           this.form.querySelector(`#${name}`);
  }
  
  /**
   * Get field value
   */
  private getFieldValue(name: string): any {
    const field = this.getField(name);
    if (!field) return undefined;
    
    if (field.type === 'checkbox') {
      return (field as HTMLInputElement).checked;
    }
    
    return field.value;
  }
  
  /**
   * Validate a single field
   */
  validateField(fieldName: string): string | null {
    const fieldConfig = this.config.fields[fieldName];
    if (!fieldConfig) return null;
    
    const value = this.getFieldValue(fieldName);
    const formData = this.getFormData();
    
    let error: string | null = null;
    
    for (const rule of fieldConfig.rules) {
      let validatorFn: ValidatorFn;
      
      if (typeof rule.validator === 'function') {
        validatorFn = rule.validator;
      } else {
        const builderFn = validators[rule.validator];
        if (!builderFn) continue;
        validatorFn = builderFn(rule.params);
      }
      
      const result = validatorFn(value, formData);
      if (result) {
        error = rule.message || result;
        break;
      }
    }
    
    // Update error state
    if (error) {
      this.errors[fieldName] = error;
    } else {
      delete this.errors[fieldName];
    }
    
    // Update UI
    this.showFieldError(fieldName, error);
    
    // Notify callback
    if (this.config.onValidationChange) {
      const isValid = Object.keys(this.errors).length === 0;
      this.config.onValidationChange(isValid, { ...this.errors });
    }
    
    return error;
  }
  
  /**
   * Validate all fields
   */
  validate(): FormValidationResult {
    const errors: Record<string, string> = {};
    const values: Record<string, any> = {};
    
    for (const fieldName of Object.keys(this.config.fields)) {
      const error = this.validateField(fieldName);
      if (error) {
        errors[fieldName] = error;
      }
      values[fieldName] = this.getFieldValue(fieldName);
    }
    
    this.errors = errors;
    
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      values
    };
  }
  
  /**
   * Get form data as object
   */
  getFormData(): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (const fieldName of Object.keys(this.config.fields)) {
      data[fieldName] = this.getFieldValue(fieldName);
    }
    
    return data;
  }
  
  /**
   * Show field error
   */
  private showFieldError(fieldName: string, error: string | null): void {
    const field = this.getField(fieldName);
    const fieldConfig = this.config.fields[fieldName];
    if (!field) return;
    
    // Get or create error container
    let errorContainer: HTMLElement | null = null;
    
    if (fieldConfig.errorContainer) {
      errorContainer = typeof fieldConfig.errorContainer === 'string'
        ? document.querySelector(fieldConfig.errorContainer)
        : fieldConfig.errorContainer;
    }
    
    if (!errorContainer) {
      // Look for sibling error element
      errorContainer = field.parentElement?.querySelector('.field-error') || null;
      
      // Create one if not found
      if (!errorContainer && error) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'field-error';
        errorContainer.id = `${fieldName}-error`;
        field.parentElement?.appendChild(errorContainer);
      }
    }
    
    // Update field state
    if (error) {
      field.classList.add('is-invalid');
      field.classList.remove('is-valid');
      field.setAttribute('aria-invalid', 'true');
      
      if (errorContainer) {
        errorContainer.textContent = error;
        errorContainer.classList.remove('hidden');
        setAriaDescribedBy(field, errorContainer.id);
      }
    } else {
      field.classList.remove('is-invalid');
      field.classList.add('is-valid');
      field.setAttribute('aria-invalid', 'false');
      
      if (errorContainer) {
        errorContainer.textContent = '';
        errorContainer.classList.add('hidden');
      }
    }
  }
  
  /**
   * Clear all errors
   */
  clearErrors(): void {
    for (const fieldName of Object.keys(this.config.fields)) {
      this.showFieldError(fieldName, null);
    }
    this.errors = {};
  }
  
  /**
   * Reset form and validation state
   */
  reset(): void {
    this.form.reset();
    this.clearErrors();
  }
  
  /**
   * Set field error manually
   */
  setFieldError(fieldName: string, error: string): void {
    this.errors[fieldName] = error;
    this.showFieldError(fieldName, error);
  }
  
  /**
   * Get current errors
   */
  getErrors(): Record<string, string> {
    return { ...this.errors };
  }
  
  /**
   * Check if form is valid
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }
  
  /**
   * Cleanup event listeners
   */
  destroy(): void {
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

// ========================================
// Convenience Functions
// ========================================

/**
 * Create a form validator instance
 */
export function createFormValidator(
  form: HTMLFormElement | string,
  config: FormConfig
): FormValidator {
  return new FormValidator(form, config);
}

/**
 * Validate a single value against rules
 */
export function validateValue(
  value: any,
  rules: ValidationRule[],
  formData?: Record<string, any>
): string | null {
  for (const rule of rules) {
    let validatorFn: ValidatorFn;
    
    if (typeof rule.validator === 'function') {
      validatorFn = rule.validator;
    } else {
      const builderFn = validators[rule.validator];
      if (!builderFn) continue;
      validatorFn = builderFn(rule.params);
    }
    
    const result = validatorFn(value, formData);
    if (result) {
      return rule.message || result;
    }
  }
  
  return null;
}

/**
 * Quick validation helper
 */
export function quickValidate(
  value: any,
  validatorNames: BuiltInValidator[],
  params?: Record<string, any>
): string | null {
  const rules: ValidationRule[] = validatorNames.map(name => ({
    validator: name,
    params
  }));
  
  return validateValue(value, rules);
}

// ========================================
// Inline Validation Helpers
// ========================================

/**
 * Add inline validation to an input element
 */
export function addInlineValidation(
  input: HTMLInputElement | HTMLTextAreaElement | string,
  rules: ValidationRule[],
  options: { debounceMs?: number; showOnInput?: boolean } = {}
): () => void {
  const { debounceMs = 300, showOnInput = true } = options;
  
  const inputEl = typeof input === 'string' ? document.querySelector<HTMLInputElement>(input) : input;
  if (!inputEl) return () => {};
  
  let debounceTimer: number | undefined;
  
  const validate = (): void => {
    const error = validateValue(inputEl.value, rules);
    
    // Get or create error element
    let errorEl = inputEl.parentElement?.querySelector('.field-error') as HTMLElement | null;
    
    if (error) {
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        inputEl.parentElement?.appendChild(errorEl);
      }
      
      errorEl.textContent = error;
      errorEl.classList.remove('hidden');
      inputEl.classList.add('is-invalid');
      inputEl.setAttribute('aria-invalid', 'true');
    } else {
      if (errorEl) {
        errorEl.classList.add('hidden');
      }
      inputEl.classList.remove('is-invalid');
      inputEl.setAttribute('aria-invalid', 'false');
    }
  };
  
  const handleBlur = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    validate();
  };
  
  const handleInput = (): void => {
    if (!showOnInput) return;
    
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(validate, debounceMs);
  };
  
  inputEl.addEventListener('blur', handleBlur);
  inputEl.addEventListener('input', handleInput);
  
  return () => {
    inputEl.removeEventListener('blur', handleBlur);
    inputEl.removeEventListener('input', handleInput);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

// ========================================
// Export Default
// ========================================

export default FormValidator;
