/**
 * Reactive UI Binding System
 * 
 * 轻量级响应式绑定系统，让 View 成为 State 的纯函数。
 * 解决命令式 DOM 操作带来的维护问题：
 * - 状态与 UI 自动同步，无需手动更新每个 DOM 元素
 * - 批量更新优化，减少 DOM 操作次数
 * - 类型安全，编译时检查绑定配置
 * 
 * @module utils/reactive
 */

import { html as viewHtml, renderInto, unsafeHTML } from './view';

// ============================================================================
// Types
// ============================================================================

/**
 * 绑定类型
 */
export type BindingType = 
  | 'text'      // 设置 textContent
  | 'html'      // 设置 innerHTML (谨慎使用，需确保内容安全)
  | 'visible'   // 控制 hidden class
  | 'class'     // 切换指定 class
  | 'classes'   // 根据值设置多个 class
  | 'attr'      // 设置/移除属性
  | 'prop'      // 设置 DOM 属性 (如 disabled, checked)
  | 'style'     // 设置内联样式
  | 'value';    // 设置表单元素的 value

/**
 * 单个绑定配置
 */
export interface BindingConfig<T = unknown> {
  /** 目标元素选择器 */
  selector: string;
  /** 绑定类型 */
  type: BindingType;
  /** 属性/class/样式名称 (用于 class/attr/prop/style 类型) */
  name?: string;
  /** 值转换函数 */
  transform?: (value: T) => unknown;
  /** 是否反转布尔值 (用于 visible/class 类型) */
  negate?: boolean;
}

/**
 * 状态绑定映射
 */
export type BindingsMap<T> = {
  [K in keyof T]?: BindingConfig<T[K]>[];
};

/**
 * 响应式状态实例
 */
export interface ReactiveState<T extends object> {
  /** 获取当前状态 */
  get(): Readonly<T>;
  /** 获取单个状态值 */
  getValue<K extends keyof T>(key: K): T[K];
  /** 更新状态 (触发 UI 更新) */
  set(updates: Partial<T>): void;
  /** 重置为初始状态 */
  reset(): void;
  /** 订阅状态变化 */
  subscribe(listener: StateListener<T>): () => void;
  /** 销毁实例，清理资源 */
  destroy(): void;
}

/**
 * 状态变化监听器
 */
export type StateListener<T> = (state: T, changedKeys: (keyof T)[]) => void;

/**
 * 动画阶段配置
 */
export interface AnimationPhase {
  /** 要添加的 class */
  addClass?: string | string[];
  /** 要移除的 class */
  removeClass?: string | string[];
  /** 阶段持续时间 (ms) */
  duration: number;
}

/**
 * 动画序列配置
 */
export interface AnimationSequence {
  /** 目标元素选择器 */
  selector: string;
  /** 动画阶段列表 */
  phases: AnimationPhase[];
}

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * 创建页面级响应式状态
 * 
 * @param initialState - 初始状态
 * @param bindings - 状态到 DOM 的绑定映射
 * @returns 响应式状态实例
 * 
 * @example
 * ```typescript
 * const state = createReactiveState({
 *   isLoading: false,
 *   username: '',
 *   showResult: false
 * }, {
 *   isLoading: [
 *     { selector: '#loader', type: 'visible' },
 *     { selector: '#submitBtn', type: 'prop', name: 'disabled' }
 *   ],
 *   username: [
 *     { selector: '#usernameDisplay', type: 'text' }
 *   ],
 *   showResult: [
 *     { selector: '#result', type: 'visible' }
 *   ]
 * });
 * 
 * // 更新状态，UI 自动同步
 * state.set({ isLoading: true });
 * ```
 */
export function createReactiveState<T extends object>(
  initialState: T,
  bindings: BindingsMap<T>
): ReactiveState<T> {
  // 当前状态
  let state: T = { ...initialState };
  
  // 订阅者列表
  const listeners = new Set<StateListener<T>>();
  
  // 是否已销毁
  let destroyed = false;
  
  // 待处理的更新 (用于批量更新)
  let pendingUpdates: Partial<T> | null = null;
  let rafId: number | null = null;

  /**
   * 应用单个绑定到 DOM - 使用 lit-html 进行安全高效的渲染
   */
  function setHtmlContent(el: Element, raw: unknown): void {
    const htmlStr = String(raw ?? '');
    if (!htmlStr) {
      el.replaceChildren();
      return;
    }
    // Use lit-html with unsafeHTML for dynamic HTML content
    // Note: Caller is responsible for sanitizing user input
    const template = viewHtml`${unsafeHTML(htmlStr)}`;
    renderInto(el, template);
  }

  function applyBinding<K extends keyof T>(
    key: K,
    value: T[K],
    config: BindingConfig<T[K]>
  ): void {
    const el = document.querySelector(config.selector);
    if (!el) return;

    // 应用转换函数
    let finalValue: unknown = config.transform ? config.transform(value) : value;
    
    // 处理布尔值反转
    if (config.negate && typeof finalValue === 'boolean') {
      finalValue = !finalValue;
    }

    switch (config.type) {
      case 'text':
        el.textContent = String(finalValue ?? '');
        break;

      case 'html':
        // Warning: preserves legacy behavior (rendering HTML strings) without using `innerHTML`.
        setHtmlContent(el, finalValue);
        break;

      case 'visible':
        // true = 显示 (移除 hidden), false = 隐藏 (添加 hidden)
        el.classList.toggle('hidden', !finalValue);
        break;

      case 'class':
        if (config.name) {
          el.classList.toggle(config.name, Boolean(finalValue));
        }
        break;

      case 'classes':
        // finalValue 应该是 class 名称或 class 名称数组
        if (typeof finalValue === 'string') {
          // 单个 class
          if (config.name) {
            // 移除旧的，添加新的
            el.classList.remove(config.name);
          }
          if (finalValue) {
            el.classList.add(finalValue);
          }
        }
        break;

      case 'attr':
        if (config.name) {
          if (finalValue === null || finalValue === undefined || finalValue === false) {
            el.removeAttribute(config.name);
          } else {
            el.setAttribute(config.name, finalValue === true ? '' : String(finalValue));
          }
        }
        break;

      case 'prop':
        if (config.name) {
          (el as unknown as Record<string, unknown>)[config.name] = finalValue;
        }
        break;

      case 'style':
        if (config.name && el instanceof HTMLElement) {
          el.style.setProperty(config.name, finalValue ? String(finalValue) : '');
        }
        break;

      case 'value':
        if ('value' in el) {
          (el as HTMLInputElement).value = String(finalValue ?? '');
        }
        break;
    }
  }

  /**
   * 批量应用所有待处理的更新
   */
  function flushUpdates(): void {
    if (destroyed || !pendingUpdates) return;

    const updates = pendingUpdates;
    pendingUpdates = null;
    rafId = null;

    const changedKeys = Object.keys(updates) as (keyof T)[];

    // 更新状态
    state = { ...state, ...updates };

    // 应用 DOM 绑定
    changedKeys.forEach(key => {
      const configs = bindings[key];
      if (!configs) return;

      const value = state[key];
      configs.forEach(config => {
        applyBinding(key, value, config as BindingConfig<T[typeof key]>);
      });
    });

    // 通知订阅者
    listeners.forEach(listener => {
      try {
        listener(state, changedKeys);
      } catch (err) {
        console.error('[Reactive] Listener error:', err);
      }
    });
  }

  /**
   * 调度更新 (使用 RAF 批量处理)
   */
  function scheduleUpdate(updates: Partial<T>): void {
    if (destroyed) return;

    // 合并更新
    pendingUpdates = pendingUpdates ? { ...pendingUpdates, ...updates } : { ...updates };

    // 调度 RAF
    if (rafId === null) {
      rafId = requestAnimationFrame(flushUpdates);
    }
  }

  // 初始化：应用初始状态到 DOM
  requestAnimationFrame(() => {
    if (destroyed) return;
    
    (Object.keys(bindings) as (keyof T)[]).forEach(key => {
      const configs = bindings[key];
      if (!configs) return;

      const value = state[key];
      configs.forEach(config => {
        applyBinding(key, value, config as BindingConfig<T[typeof key]>);
      });
    });
  });

  return {
    get(): Readonly<T> {
      return { ...state };
    },

    getValue<K extends keyof T>(key: K): T[K] {
      return state[key];
    },

    set(updates: Partial<T>): void {
      scheduleUpdate(updates);
    },

    reset(): void {
      scheduleUpdate({ ...initialState });
    },

    subscribe(listener: StateListener<T>): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    destroy(): void {
      destroyed = true;
      listeners.clear();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingUpdates = null;
    }
  };
}

// ============================================================================
// Animation Utilities
// ============================================================================

/**
 * 执行动画序列
 * 
 * @param sequence - 动画序列配置
 * @returns Promise，动画完成后 resolve
 * 
 * @example
 * ```typescript
 * await runAnimationSequence({
 *   selector: '.card',
 *   phases: [
 *     { addClass: 'collapsing', duration: 250 },
 *     { removeClass: 'collapsing', addClass: 'collapsed', duration: 0 }
 *   ]
 * });
 * ```
 */
export async function runAnimationSequence(sequence: AnimationSequence): Promise<void> {
  const el = document.querySelector(sequence.selector);
  if (!el) return;

  for (const phase of sequence.phases) {
    // 添加 class
    if (phase.addClass) {
      const classes = Array.isArray(phase.addClass) ? phase.addClass : [phase.addClass];
      el.classList.add(...classes);
    }

    // 移除 class
    if (phase.removeClass) {
      const classes = Array.isArray(phase.removeClass) ? phase.removeClass : [phase.removeClass];
      el.classList.remove(...classes);
    }

    // 等待阶段完成
    if (phase.duration > 0) {
      await new Promise(resolve => setTimeout(resolve, phase.duration));
    }
  }
}

/**
 * 批量执行多个动画序列 (并行)
 */
export async function runParallelAnimations(sequences: AnimationSequence[]): Promise<void> {
  await Promise.all(sequences.map(seq => runAnimationSequence(seq)));
}

// ============================================================================
// DOM Utilities
// ============================================================================

/**
 * 安全地设置元素文本
 */
export function setText(selector: string, text: string): void {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

/**
 * 安全地切换元素可见性
 */
export function setVisible(selector: string, visible: boolean): void {
  const el = document.querySelector(selector);
  if (el) el.classList.toggle('hidden', !visible);
}

/**
 * 安全地切换 class
 */
export function toggleClass(selector: string, className: string, force?: boolean): void {
  const el = document.querySelector(selector);
  if (el) el.classList.toggle(className, force);
}

/**
 * 批量设置多个元素的可见性
 */
export function setMultipleVisible(configs: Array<{ selector: string; visible: boolean }>): void {
  requestAnimationFrame(() => {
    configs.forEach(({ selector, visible }) => {
      const el = document.querySelector(selector);
      if (el) el.classList.toggle('hidden', !visible);
    });
  });
}

/**
 * 批量设置多个元素的文本
 */
export function setMultipleText(configs: Array<{ selector: string; text: string }>): void {
  requestAnimationFrame(() => {
    configs.forEach(({ selector, text }) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    });
  });
}

// ============================================================================
// Input Binding Utilities
// ============================================================================

/**
 * 创建双向绑定的输入处理器
 * 
 * @param state - 响应式状态实例
 * @param key - 状态键
 * @param selector - 输入元素选择器
 * @returns 清理函数
 */
export function bindInput<T extends object, K extends keyof T>(
  state: ReactiveState<T>,
  key: K,
  selector: string
): () => void {
  const el = document.querySelector(selector) as HTMLInputElement | null;
  if (!el) return () => {};

  const handler = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    state.set({ [key]: value } as Partial<T>);
  };

  el.addEventListener('input', handler);

  return () => {
    el.removeEventListener('input', handler);
  };
}

// ============================================================================
// Computed Values
// ============================================================================

/**
 * 创建计算值
 * 当依赖的状态变化时自动重新计算
 * 
 * @param state - 响应式状态实例
 * @param compute - 计算函数
 * @param deps - 依赖的状态键
 * @returns 获取计算值的函数
 */
export function computed<T extends object, R>(
  state: ReactiveState<T>,
  compute: (state: T) => R,
  deps: (keyof T)[]
): () => R {
  let cachedValue: R = compute(state.get());
  
  state.subscribe((newState, changedKeys) => {
    // 检查是否有依赖变化
    const hasDepChange = changedKeys.some(key => deps.includes(key));
    if (hasDepChange) {
      cachedValue = compute(newState);
    }
  });

  return () => cachedValue;
}

// ============================================================================
// Export
// ============================================================================

export default {
  createReactiveState,
  runAnimationSequence,
  runParallelAnimations,
  setText,
  setVisible,
  toggleClass,
  setMultipleVisible,
  setMultipleText,
  bindInput,
  computed
};
