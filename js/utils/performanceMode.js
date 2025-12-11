/**
 * Performance Mode Manager
 * 管理应用的性能模式（顶级模式 vs 节能模式）
 * 
 * Feature: performance-optimization
 * Requirements: 0.4, 0.5
 */

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
