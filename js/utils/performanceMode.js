/**
 * Performance Mode Manager
 * 管理应用的性能模式（顶级模式 vs 节能模式）
 * 
 * Feature: performance-optimization
 * Requirements: 0.4, 0.5
 */

/**
 * RAF-based batch update queue for DOM operations
 * Collects updates and applies them in the next animation frame
 */
class BatchUpdateQueue {
  constructor() {
    /** @type {Map<string, Function>} */
    this.updates = new Map();
    this.scheduled = false;
  }

  /**
   * Schedule a DOM update to run in next animation frame
   * @param {string} key - Unique key for this update (for deduplication)
   * @param {Function} updateFn - Function that performs the DOM update
   */
  schedule(key, updateFn) {
    this.updates.set(key, updateFn);
    
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Execute all scheduled updates
   */
  flush() {
    const updates = Array.from(this.updates.values());
    this.updates.clear();
    this.scheduled = false;
    
    for (const update of updates) {
      try {
        update();
      } catch (err) {
        console.error('[BatchUpdateQueue] Update failed:', err);
      }
    }
  }

  /**
   * Clear all scheduled updates without executing
   */
  clear() {
    this.updates.clear();
    this.scheduled = false;
  }
}

// Global batch update queue instance
const batchUpdateQueue = new BatchUpdateQueue();

/**
 * Schedule a DOM update to run in next animation frame
 * @param {string} key - Unique key for this update (for deduplication)
 * @param {Function} updateFn - Function that performs the DOM update
 */
export function scheduleBatchUpdate(key, updateFn) {
  batchUpdateQueue.schedule(key, updateFn);
}

/**
 * Force flush all pending batch updates
 */
export function flushBatchUpdates() {
  batchUpdateQueue.flush();
}

/**
 * Clear all pending batch updates
 */
export function clearBatchUpdates() {
  batchUpdateQueue.clear();
}

/**
 * Debounce function with requestAnimationFrame
 * @param {Function} fn - Function to debounce
 * @returns {Function} Debounced function
 */
export function rafDebounce(fn) {
  let rafId = null;
  
  return function (...args) {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

/**
 * Throttle function with requestAnimationFrame
 * @param {Function} fn - Function to throttle
 * @returns {Function} Throttled function
 */
export function rafThrottle(fn) {
  let rafId = null;
  let lastArgs = null;
  
  return function (...args) {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        fn.apply(this, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

class PerformanceModeManager {
  constructor() {
    this.mode = 'premium'; // 'premium' | 'energy-saving'
    this.storageKey = 'performance_mode';
  }

  /**
   * 获取当前性能模式
   * @returns {string} 'premium' 或 'energy-saving'
   */
  getMode() {
    return this.mode;
  }

  /**
   * 设置性能模式
   * @param {string} mode - 'premium' 或 'energy-saving'
   */
  setMode(mode) {
    if (mode !== 'premium' && mode !== 'energy-saving') {
      console.warn(`Invalid performance mode: ${mode}. Using 'premium' as default.`);
      mode = 'premium';
    }
    
    this.mode = mode;
    this.saveMode();
    this.applyMode();
  }

  /**
   * 应用当前模式的样式到页面
   * 通过添加/移除 body 的 CSS 类来控制样式
   */
  applyMode() {
    const body = document.body;
    
    if (this.mode === 'energy-saving') {
      body.classList.add('energy-saving-mode');
    } else {
      body.classList.remove('energy-saving-mode');
    }
  }

  /**
   * 从 localStorage 加载保存的性能模式
   */
  loadMode() {
    try {
      const savedMode = localStorage.getItem(this.storageKey);
      if (savedMode) {
        this.mode = savedMode;
      }
    } catch (error) {
      console.warn('Failed to load performance mode from localStorage:', error);
      // 使用内存中的默认值作为 fallback
    }
  }

  /**
   * 保存当前性能模式到 localStorage
   */
  saveMode() {
    try {
      localStorage.setItem(this.storageKey, this.mode);
    } catch (error) {
      console.warn('Failed to save performance mode to localStorage:', error);
      // 继续使用内存中的模式，不影响当前会话
    }
  }
}

// 创建全局单例实例
const performanceModeManager = new PerformanceModeManager();

// ES6 模块导出
export default performanceModeManager;
