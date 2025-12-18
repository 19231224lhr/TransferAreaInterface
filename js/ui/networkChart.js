/**
 * Network Chart Module
 * 
 * Provides network speed chart rendering for the transfer panel.
 */

import { debounce } from '../utils/eventUtils.js';
import { DOM_IDS } from '../config/domIds';

const DATA_POINTS = 30; // 数据点数量
const UPDATE_INTERVAL = 2000; // 2秒更新一次

let speedData = [];
let intervalId = null;
let isVisible = false;
let resizeObserver = null;

// Initialize speed data with random values
for (let i = 0; i < DATA_POINTS; i++) {
  const base = 600 + Math.random() * 200;
  speedData.push(base);
}

/**
 * Format speed value
 * @param {number} kbps - Speed in KB/s
 * @returns {string} Formatted speed string
 */
function formatSpeed(kbps) {
  if (kbps >= 1024) {
    return `${(kbps / 1024).toFixed(1)} MB/s`;
  }
  return `${Math.round(kbps)} KB/s`;
}

/**
 * Update network statistics
 */
function updateNetworkStats() {
  let baseline = 0;
  let latency = 0;
  
  // Try to get real network info if available
  if (navigator.connection) {
    if (navigator.connection.downlink) {
      baseline = navigator.connection.downlink * 125;
    }
    if (navigator.connection.rtt) {
      latency = navigator.connection.rtt;
    }
  }
  
  // Generate simulated network speed
  const prev = speedData.length ? speedData[speedData.length - 1] : (baseline || 600);
  const drift = (Math.random() - 0.5) * 140;
  const spike = Math.random() < 0.12 ? (Math.random() - 0.5) * 700 : 0;
  let downloadSpeed = prev + drift + spike;
  downloadSpeed = Math.max(80, Math.min(1600, baseline ? (downloadSpeed * 0.7 + baseline * 0.3) : downloadSpeed));
  const uploadSpeed = downloadSpeed * (0.3 + Math.random() * 0.25);
  
  if (latency === 0) {
    latency = Math.max(8, Math.round(20 + (Math.random() - 0.5) * 30 + (spike ? Math.random() * 80 : 0)));
  }
  
  speedData.push(downloadSpeed);
  if (speedData.length > DATA_POINTS) speedData.shift();
  
  // Update UI elements
  const downloadEl = document.getElementById(DOM_IDS.downloadSpeed);
  const uploadEl = document.getElementById(DOM_IDS.uploadSpeed);
  const latencyEl = document.getElementById(DOM_IDS.latencyValue);
  
  if (downloadEl) downloadEl.textContent = formatSpeed(downloadSpeed);
  if (uploadEl) uploadEl.textContent = formatSpeed(uploadSpeed);
  if (latencyEl) latencyEl.textContent = `${latency} ms`;
}

/**
 * Catmull-Rom spline interpolation
 * @param {Array} points - Array of {x, y} points
 * @param {number} tension - Tension parameter
 * @returns {string} SVG path string
 */
function catmullRomSpline(points, tension = 0.5) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  }
  
  let path = `M${points[0].x},${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    
    const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
    
    path += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
  }
  
  return path;
}

/**
 * Render network chart
 */
function renderChart() {
  const svg = document.getElementById(DOM_IDS.networkChartSvg);
  const line = document.getElementById(DOM_IDS.networkChartLine);
  const fill = document.getElementById(DOM_IDS.networkChartFill);
  const dot = document.getElementById(DOM_IDS.networkChartDot);
  
  if (!svg || !line || !fill || !dot) return;
  
  const rect = svg.getBoundingClientRect();
  const width = rect.width || 300;
  const height = rect.height || 55;

  // If width is still 0, wait for the next layout pass (ResizeObserver will fire again)
  if (width === 0 || height === 0) return;
  
  // Calculate min/max for normalization
  const minSpeed = Math.min(...speedData);
  const maxSpeed = Math.max(...speedData);
  const range = Math.max(maxSpeed - minSpeed, 1);
  const padding = { top: 5, bottom: 5, left: 0, right: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Generate points
  const points = speedData.map((speed, i) => ({
    x: padding.left + (i / (DATA_POINTS - 1)) * chartWidth,
    y: padding.top + chartHeight - ((speed - minSpeed) / range) * chartHeight
  }));
  
  // Generate smooth curve
  const linePath = catmullRomSpline(points, 0.5);
  
  line.setAttribute('d', linePath);
  
  // Generate fill area
  if (points.length > 0) {
    const fillPath = linePath + 
      `L${points[points.length - 1].x},${height}` +
      `L${points[0].x},${height}Z`;
    fill.setAttribute('d', fillPath);
  }
  
  // Update current point position
  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    dot.setAttribute('cx', lastPoint.x);
    dot.setAttribute('cy', lastPoint.y);
  }
}

/**
 * Start monitoring network stats
 */
function startMonitoring() {
  if (intervalId) return;
  
  intervalId = setInterval(() => {
    updateNetworkStats();
    renderChart();
  }, UPDATE_INTERVAL);
}

/**
 * Stop monitoring network stats
 */
function stopMonitoring() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Initialize network chart
 * Performance optimization: Use IntersectionObserver for visibility detection (Requirements: 4.5)
 * Property 14: 不可见图表暂停更新
 */
export function initNetworkChart() {
  // Use IntersectionObserver to detect visibility
  if ('IntersectionObserver' in window) {
    // Observe transfer panel visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          startMonitoring();
        } else {
          stopMonitoring();
        }
      });
    }, { threshold: 0.1 });
    
    const transferPanel = document.querySelector('.transfer-panel');
    if (transferPanel) {
      observer.observe(transferPanel);
    }
    
    // Store observer for cleanup (Requirements: 6.1)
    window._networkChartObserver = observer;
  } else {
    // Fallback: always monitor if IntersectionObserver not supported
    startMonitoring();
  }
  
  // Initial render - delay to ensure DOM is laid out
  updateNetworkStats();
  // Use requestAnimationFrame to wait for layout, then render multiple times to ensure proper sizing
  requestAnimationFrame(() => {
    renderChart();
    // Render again after a short delay in case layout wasn't complete
    setTimeout(() => {
      renderChart();
    }, 100);
  });

  // Observe container size changes for immediate re-render when layout finishes
  const container = document.querySelector('.network-chart-container');
  if ('ResizeObserver' in window && container) {
    resizeObserver = new ResizeObserver(() => {
      renderChart();
    });
    resizeObserver.observe(container);
    window._networkChartResizeObserver = resizeObserver;
  }
  
  // Listen for window resize
  // Performance optimization: Use debounce utility (Requirements: 2.2)
  const debouncedRender = debounce(renderChart, 100); // 100ms debounce for network chart
  window.addEventListener('resize', debouncedRender);
  
  // Store resize handler for cleanup (Requirements: 6.2)
  window._networkChartResizeHandler = debouncedRender;
}

/**
 * Cleanup network chart resources
 * Performance optimization: Memory management (Requirements: 6.1)
 */
export function cleanupNetworkChart() {
  // Stop monitoring interval
  stopMonitoring();
  
  // Cleanup observer
  if (window._networkChartObserver) {
    window._networkChartObserver.disconnect();
    window._networkChartObserver = null;
  }
  
  // Cleanup resize listener
  if (window._networkChartResizeHandler) {
    window.removeEventListener('resize', window._networkChartResizeHandler);
    window._networkChartResizeHandler = null;
  }

  // Cleanup size observer
  if (window._networkChartResizeObserver) {
    window._networkChartResizeObserver.disconnect();
    window._networkChartResizeObserver = null;
  }
}
