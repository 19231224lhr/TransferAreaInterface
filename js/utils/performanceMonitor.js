/**
 * Performance Monitor Utility
 * 
 * Helps detect memory leaks and performance issues during development
 */

class PerformanceMonitor {
  constructor() {
    this.intervalId = null;
    this.isMonitoring = false;
    this.memoryHistory = [];
    this.maxHistoryLength = 100;
  }

  /**
   * Start monitoring performance
   * @param {number} interval - Monitoring interval in milliseconds (default: 5000)
   */
  start(interval = 5000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, interval);
    
    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isMonitoring = false;
  }

  /**
   * Collect performance metrics
   */
  collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memory: this.getMemoryInfo(),
      dom: this.getDOMInfo(),
      listeners: this.getListenerInfo(),
      timers: this.getTimerInfo()
    };
    
    this.memoryHistory.push(metrics);
    
    // Keep history within limits
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }
    
    // Log warnings if needed
    this.checkForIssues(metrics);
  }

  /**
   * Get memory information
   */
  getMemoryInfo() {
    if (!performance.memory) {
      return { available: false };
    }
    
    return {
      available: true,
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
  }

  /**
   * Get DOM information
   */
  getDOMInfo() {
    return {
      elements: document.querySelectorAll('*').length,
      listeners: this.countEventListeners()
    };
  }

  /**
   * Count event listeners (approximation)
   */
  countEventListeners() {
    // This is an approximation - exact count is not easily available
    const elements = document.querySelectorAll('*');
    let count = 0;
    
    // Count elements with common event attributes
    elements.forEach(el => {
      if (el.onclick) count++;
      if (el.onchange) count++;
      if (el.onsubmit) count++;
      // Add more as needed
    });
    
    return count;
  }

  /**
   * Get listener information
   */
  getListenerInfo() {
    return {
      global: {
        scroll: !!window._headerScrollBind || !!window._footerScrollBind,
        hashchange: !!window._routerHashChangeBind || !!window._headerHashChangeBind,
        resize: !!window._chartResizeHandler || !!window._networkChartResizeHandler
      }
    };
  }

  /**
   * Get timer information
   */
  getTimerInfo() {
    return {
      intervals: {
        chart: !!window._chartIntervalSet,
        networkChart: !!window._networkChartObserver
      }
    };
  }

  /**
   * Check for potential issues
   */
  checkForIssues(metrics) {
    // Only emit warnings when explicitly enabled via window.__PERF_DEBUG
    const shouldWarn = typeof window !== 'undefined' && (window).__PERF_DEBUG === true;
    if (!shouldWarn) return;

    // Memory leak detection (warn on significant issues)
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const memoryTrend = this.calculateMemoryTrend(recent);
      
      // Only warn for severe memory leaks (>20MB increase)
      if (memoryTrend > 20) {
        console.warn('⚠️ Potential memory leak detected - memory increasing by', memoryTrend.toFixed(2), 'MB');
      }
    }
    
    // DOM element count (only warn for very high counts)
    if (metrics.dom.elements > 10000) {
      console.warn('⚠️ High DOM element count:', metrics.dom.elements);
    }
    
    // Memory usage (only warn for very high usage)
    if (metrics.memory.available && metrics.memory.used > 200) {
      console.warn('⚠️ High memory usage:', metrics.memory.used, 'MB');
    }
  }

  /**
   * Calculate memory trend
   */
  calculateMemoryTrend(samples) {
    if (samples.length < 2 || !samples[0].memory.available) return 0;
    
    const first = samples[0].memory.used;
    const last = samples[samples.length - 1].memory.used;
    
    return last - first;
  }

  /**
   * Get current status
   */
  getStatus() {
    if (this.memoryHistory.length === 0) {
      return { available: false };
    }
    
    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    return {
      available: true,
      isMonitoring: this.isMonitoring,
      latest,
      history: this.memoryHistory.slice(-10) // Last 10 samples
    };
  }

  /**
   * Generate report
   */
  generateReport() {
    const status = this.getStatus();
    
    if (!status.available) {
      console.log('📊 No performance data available');
      return;
    }
    
    // Only print report when explicitly enabled via window.__PERF_DEBUG
    const shouldLog = typeof window !== 'undefined' && (window).__PERF_DEBUG === true;
    if (!shouldLog) return;

    console.group('📊 Performance Report');
    console.log('Memory:', status.latest.memory);
    console.log('DOM Elements:', status.latest.dom.elements);
    console.log('Global Listeners:', status.latest.listeners.global);
    console.log('Active Timers:', status.latest.timers.intervals);
    
    if (this.memoryHistory.length >= 5) {
      const trend = this.calculateMemoryTrend(this.memoryHistory.slice(-5));
      console.log('Memory Trend (last 5 samples):', trend.toFixed(2), 'MB');
    }
    
    console.groupEnd();
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor();

// Export for use
export default performanceMonitor;

// Also make it available globally for debugging
window.performanceMonitor = performanceMonitor;