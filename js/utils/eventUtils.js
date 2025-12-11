/**
 * Event Optimization Utilities
 * 事件优化工具集
 * 
 * Feature: performance-optimization
 * Requirements: 2.2, 2.3
 */

/**
 * 防抖函数 - 延迟执行函数直到停止触发
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 * 
 * Property 7: 防抖延迟执行
 * For any 使用防抖的函数，在快速连续触发时应该只在最后一次触发后指定延迟时间执行一次
 */
export function debounce(func, wait) {
  let timeoutId = null;
  
  return function debounced(...args) {
    const context = this;
    
    // 清除之前的定时器
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    // 设置新的定时器
    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * 节流函数 - 限制函数执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 * 
 * Property 8: 节流执行频率限制
 * For any 使用节流的函数，在连续触发时执行频率应该不超过指定的时间间隔
 */
export function throttle(func, limit) {
  let inThrottle = false;
  let lastResult;
  
  return function throttled(...args) {
    const context = this;
    
    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
}

/**
 * RAF节流 - 使用requestAnimationFrame限制函数执行频率
 * @param {Function} func - 要节流的函数
 * @returns {Function} RAF节流后的函数
 * 
 * 确保函数在每个动画帧最多执行一次（约16ms一次，60fps）
 */
export function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;
  
  return function rafThrottled(...args) {
    const context = this;
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(context, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * 事件委托 - 利用事件冒泡机制处理子元素事件
 * @param {Element} container - 容器元素
 * @param {string} selector - 子元素选择器
 * @param {string} eventType - 事件类型
 * @param {Function} handler - 事件处理函数
 * @returns {Function} 移除监听器的函数
 * 
 * Property 6: 事件委托单一监听器
 * For any 使用事件委托的列表容器，容器上应该有事件监听器而子项上不应该有独立监听器
 */
export function delegate(container, selector, eventType, handler) {
  const delegatedHandler = (event) => {
    // 查找匹配选择器的目标元素
    const target = event.target.closest(selector);
    
    if (target && container.contains(target)) {
      // 调用处理函数，this指向匹配的元素
      handler.call(target, event);
    }
  };
  
  container.addEventListener(eventType, delegatedHandler);
  
  // 返回移除监听器的函数
  return () => {
    container.removeEventListener(eventType, delegatedHandler);
  };
}

/**
 * 创建可取消的防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Object} 包含debounced函数和cancel方法的对象
 */
export function debounceCancelable(func, wait) {
  let timeoutId = null;
  
  const debounced = function(...args) {
    const context = this;
    
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, wait);
  };
  
  debounced.cancel = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * 创建可取消的节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Object} 包含throttled函数和cancel方法的对象
 */
export function throttleCancelable(func, limit) {
  let inThrottle = false;
  let timeoutId = null;
  let lastResult;
  
  const throttled = function(...args) {
    const context = this;
    
    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;
      
      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
    
    return lastResult;
  };
  
  throttled.cancel = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
  };
  
  return throttled;
}

/**
 * 创建可取消的RAF节流函数
 * @param {Function} func - 要节流的函数
 * @returns {Object} 包含throttled函数和cancel方法的对象
 */
export function rafThrottleCancelable(func) {
  let rafId = null;
  let lastArgs = null;
  
  const throttled = function(...args) {
    const context = this;
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(context, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
  
  throttled.cancel = function() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };
  
  return throttled;
}

// 默认导出所有工具函数
export default {
  debounce,
  throttle,
  rafThrottle,
  delegate,
  debounceCancelable,
  throttleCancelable,
  rafThrottleCancelable
};
