/**
 * Charts UI Module
 * 
 * Provides chart rendering functionality for wallet balance.
 */

import { loadUser } from '../utils/storage';
import { debounce, rafThrottle } from '../utils/eventUtils.js';
import { DOM_IDS } from '../config/domIds';

function normalizeTypeId(type) {
  if (type === 0 || type === 1 || type === 2) return type;
  if (typeof type === 'string') {
    const upper = type.trim().toUpperCase();
    if (upper === 'PGC') return 0;
    if (upper === 'BTC') return 1;
    if (upper === 'ETH') return 2;
  }
  const n = Number(type);
  return n === 0 || n === 1 || n === 2 ? n : 0;
}

function getWalletValueDivision(user) {
  const w = user && user.wallet;
  const vd = (w && (w.valueDivision || w.ValueDivision)) || null;
  if (vd && (vd[0] !== undefined || vd[1] !== undefined || vd[2] !== undefined || vd['0'] !== undefined || vd['1'] !== undefined || vd['2'] !== undefined)) {
    return {
      0: Number(vd[0] ?? vd['0'] ?? 0) || 0,
      1: Number(vd[1] ?? vd['1'] ?? 0) || 0,
      2: Number(vd[2] ?? vd['2'] ?? 0) || 0,
    };
  }

  // Fallback: derive from per-address totals if ValueDivision is missing/stale.
  const sum = { 0: 0, 1: 0, 2: 0 };
  const addrMsg = (w && w.addressMsg) || {};
  for (const k in addrMsg) {
    const meta = addrMsg[k] || {};
    const t = normalizeTypeId(meta.type);
    const v = Number((meta.value && (meta.value.totalValue ?? meta.value.TotalValue)) ?? 0) || 0;
    if (t === 0 || t === 1 || t === 2) sum[t] += v;
  }
  return sum;
}

// Chart history storage key
const CHART_HISTORY_KEY = 'wallet_balance_chart_history_v2';

/**
 * Load chart history from localStorage
 * @returns {Array} Chart history data
 */
const loadChartHistory = () => {
  try {
    const data = localStorage.getItem(CHART_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Save chart history to localStorage
 * @param {Array} history - Chart history data
 */
const saveChartHistory = (history) => {
  try {
    // Keep more than display window so frequent balance changes don't immediately overwrite history.
    // Display still uses the last 10 points.
    const trimmed = history.slice(-120);
    localStorage.setItem(CHART_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {}
};

/**
 * Update wallet balance chart
 * @param {object} user - User data with wallet info
 */
export function updateWalletChart(user) {
  if (!user) {
    user = loadUser();
  }
  const chartEl = document.getElementById(DOM_IDS.balanceChart);
  if (!chartEl) return;

  const chartInner = chartEl.querySelector('.balance-chart-inner');
  const svg = chartEl.querySelector('.balance-chart-svg');
  const lineEl = document.getElementById(DOM_IDS.chartLine);
  const fillEl = document.getElementById(DOM_IDS.chartFill);
  const dotsEl = document.getElementById(DOM_IDS.chartDots);
  const tooltip = document.getElementById(DOM_IDS.chartTooltip);
  const timeLabelsEl = document.getElementById(DOM_IDS.chartTimeLabels);

  if (!svg || !lineEl || !fillEl || !dotsEl) return;

  // Get current balance
  const vd = getWalletValueDivision(user);
  const currentVal = Math.round(Number(vd[0] || 0) * 1 + Number(vd[1] || 0) * 100 + Number(vd[2] || 0) * 10);
  const now = Date.now();
  const minuteMs = 60 * 1000;
  const minPointIntervalMs = 3000;
  
  // Load persistent history data
  let history = loadChartHistory();
  
  // Initialize or update history data
  if (history.length === 0) {
    // Create initial history: past 10 minutes
    for (let i = 9; i >= 0; i--) {
      const t = now - i * minuteMs;
      history.push({ t, v: currentVal });
    }
    saveChartHistory(history);
  } else {
    const lastPoint = history[history.length - 1];
    const timeSinceLastPoint = now - lastPoint.t;

    const valueChanged = lastPoint.v !== currentVal;

    if (valueChanged) {
      // Balance changed: update chart immediately.
      // If changes are very frequent, update the last point instead of pushing too many points.
      if (timeSinceLastPoint < minPointIntervalMs) {
        lastPoint.v = currentVal;
        lastPoint.t = now;
      } else {
        history.push({ t: now, v: currentVal });
      }
      saveChartHistory(history);
    } else if (timeSinceLastPoint >= minuteMs) {
      // Keep time moving even if balance is stable (one point per minute).
      history.push({ t: now, v: currentVal });
      saveChartHistory(history);
    }
  }

  // Take last 10 points for display
  // 确保最后一个点的值是当前值（防止缓存问题）
  const displayHistory = history.slice(-10);
  if (displayHistory.length > 0) {
    displayHistory[displayHistory.length - 1].v = currentVal;
  }
  
  // Calculate value range - key fix: when all values are same (including all 0), show horizontal line
  const values = displayHistory.map(h => h.v);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;
  
  // SVG dimensions (adaptive to container ratio, full width)
  const innerRect = chartInner?.getBoundingClientRect();
  const containerW = innerRect?.width || chartEl.clientWidth || 320;
  const containerH = innerRect?.height || chartEl.clientHeight || 56;
  const viewBoxHeight = Math.round(containerH || 70);
  const width = Math.max(320, Math.round(viewBoxHeight * (containerW / Math.max(1, containerH))));
  const height = viewBoxHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const padX = 2;  // Reduce left/right padding for full width
  const padY = 6;
  const chartHeight = height - padY * 2;

  const bottomGapPx = 10;
  const topGapPx = 8;
  const chartTop = padY + topGapPx;
  const chartBottom = height - padY - bottomGapPx;
  const chartRange = chartBottom - chartTop;
  
  const toY = (v) => {
    if (range === 0) {
      // All values same (including all 0), show horizontal line in middle
      return chartTop + chartRange * 0.5;
    }
    // When there's variation, map to chart area
    const normalized = (v - minVal) / range; // 0 to 1
    return chartBottom - normalized * chartRange;
  };

  // X coordinate calculation
  const toX = (i) => {
    if (displayHistory.length <= 1) return width / 2;
    return padX + (i / (displayHistory.length - 1)) * (width - padX * 2);
  };

  // Generate point coordinates
  const points = displayHistory.map((h, i) => ({ 
    x: toX(i), 
    y: toY(h.v), 
    v: h.v, 
    t: h.t 
  }));
  
  if (points.length < 2) return;
  
  // Generate smooth curve path (Catmull-Rom spline)
  let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  
  // Use Monotone Cubic Spline algorithm to eliminate "hooks" and ensure monotonicity
  // Calculate slopes
  const slopes = [];
  const dxs = [];
  const dys = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dy / dx);
  }
  // Pad last slope to prevent array overflow
  if (slopes.length > 0) {
    slopes.push(slopes[slopes.length - 1]);
    dxs.push(dxs[dxs.length - 1]);
    dys.push(dys[dys.length - 1]);
  } else {
    // Single point case
    slopes.push(0); dxs.push(0); dys.push(0);
  }

  // Calculate tangent slopes m
  const ms = [];
  ms.push(slopes[0]); // Start tangent
  for (let i = 0; i < slopes.length - 1; i++) {
    // If slopes have opposite signs, it's an extremum, set tangent to 0 to prevent overshoot
    if (slopes[i] * slopes[i+1] <= 0) {
      ms.push(0);
    } else {
      ms.push((slopes[i] + slopes[i + 1]) / 2);
    }
  }
  ms.push(slopes[slopes.length - 1]); // End tangent

  // Generate Bezier control points and draw
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = points[i + 1].x - points[i].x;
    
    // Control points X at 1/3 and 2/3 of segment
    // Y calculated from tangent slopes
    const cp1x = p1.x + dx / 3;
    const cp1y = p1.y + ms[i] * dx / 3;
    const cp2x = p2.x - dx / 3;
    const cp2y = p2.y - ms[i + 1] * dx / 3;

    pathD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  // Fill area path
  const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;

  // Update paths
  lineEl.setAttribute('d', pathD);
  fillEl.setAttribute('d', fillD);

  // Generate data points - use fixed size circles (won't deform with SVG stretch)
  dotsEl.replaceChildren(
    ...points.map((p, i) => {
      const isLast = i === points.length - 1;
      const baseR = isLast ? 4 : 3;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x.toFixed(1));
      c.setAttribute('cy', p.y.toFixed(1));
      c.setAttribute('r', String(baseR));
      c.setAttribute('class', isLast ? 'chart-dot-current' : 'chart-dot');
      c.setAttribute('data-value', String(p.v));
      c.setAttribute('data-time', String(p.t));
      return c;
    })
  );

  // Update time labels
  if (timeLabelsEl && displayHistory.length > 0) {
    const firstTime = new Date(displayHistory[0].t);
    const lastTime = new Date(displayHistory[displayHistory.length - 1].t);
    const midIdx = Math.floor(displayHistory.length / 2);
    const midTime = new Date(displayHistory[midIdx].t);
    
    const formatTime = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    
    const mk = (txt) => {
      const s = document.createElement('span');
      s.className = 'chart-time-label';
      s.textContent = txt;
      return s;
    };
    timeLabelsEl.replaceChildren(
      mk(formatTime(firstTime)),
      mk(formatTime(midTime)),
      mk(formatTime(lastTime))
    );
  }

  // Save points globally for tooltip
  svg._chartPoints = points;
  svg._chartWidth = width;
  svg._chartViewBoxWidth = width;
  
  // Bind hover tooltip events (only once)
  // Performance optimization: Use rafThrottle utility (Requirements: 2.3)
  if (!svg.dataset._bindChart) {
    const handleMouseMoveCore = (e) => {
      const pts = svg._chartPoints || [];
      const svgWidth = svg._chartWidth || 320;
      if (pts.length === 0) return;
      
      const rect = svg.getBoundingClientRect();
      // Fix: use viewBox width instead of svgWidth to calculate mouse position
      const viewBoxWidth = svg._chartViewBoxWidth || 320;
      const x = (e.clientX - rect.left) * (viewBoxWidth / rect.width);
      
      let closest = pts[0];
      let minDist = Infinity;
      pts.forEach(p => {
        const dist = Math.abs(p.x - x);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      });

      if (tooltip && minDist < 40) {
        const date = new Date(closest.t);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        tooltip.textContent = `${closest.v.toLocaleString()} USDT · ${timeStr}`;
        tooltip.classList.add('visible');
        
        // Calculate tooltip position (relative to container)
        const chartInner = chartEl.querySelector('.balance-chart-inner');
        if (chartInner) {
          const innerRect = chartInner.getBoundingClientRect();
          // Fix: use viewBox width instead of svgWidth to calculate ratio
          const viewBoxWidth = svg._chartViewBoxWidth || 320;
          const tooltipX = (closest.x / viewBoxWidth) * innerRect.width;
          const tooltipY = (closest.y / 70) * innerRect.height;
          tooltip.style.left = `${tooltipX}px`;
          tooltip.style.top = `${Math.max(0, tooltipY - 28)}px`;
        }
      } else if (tooltip) {
        tooltip.classList.remove('visible');
      }
    };
    
    // Use rafThrottle to limit updates to ~60fps (every 16ms)
    const handleMouseMove = rafThrottle(handleMouseMoveCore);

    const handleMouseLeave = () => {
      if (tooltip) tooltip.classList.remove('visible');
    };

    svg.addEventListener('mousemove', handleMouseMove, { passive: true });
    svg.addEventListener('mouseleave', handleMouseLeave);
    chartEl.addEventListener('mouseleave', handleMouseLeave);

    svg.dataset._bindChart = 'true';
  }
}

/**
 * Initialize wallet chart
 */
export function initWalletChart() {
  // Check if chart element exists
  const chartEl = document.getElementById(DOM_IDS.balanceChart);
  if (!chartEl) {
    console.warn('Balance chart element not found, skipping initialization');
    return;
  }
  
  const u = loadUser();
  if (u) {
    updateWalletChart(u);
  }
  
  // Auto-update chart every minute (only set interval once)
  // Performance optimization: Pause updates when chart is not visible (Requirements: 4.5)
  // Property 14: 不可见图表暂停更新
  if (!window._chartIntervalSet) {
    window._chartIntervalSet = true;
    let chartIntervalId = null;
    let isChartVisible = true;
    
    // Start interval
    const startChartInterval = () => {
      if (chartIntervalId) return;
      chartIntervalId = setInterval(() => {
        const user = loadUser();
        if (user && isChartVisible) {
          updateWalletChart(user);
        }
      }, 60 * 1000);
    };
    
    // Stop interval
    const stopChartInterval = () => {
      if (chartIntervalId) {
        clearInterval(chartIntervalId);
        chartIntervalId = null;
      }
    };
    
    // Store cleanup function for memory management (Requirements: 6.1)
    window._cleanupChartInterval = stopChartInterval;
    
    // Use IntersectionObserver to detect visibility
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isChartVisible = entry.isIntersecting;
          if (entry.isIntersecting) {
            // Chart became visible, resume updates
            startChartInterval();
            const user = loadUser();
            if (user) {
              updateWalletChart(user);
            }
          } else {
            // Chart not visible, pause updates
            stopChartInterval();
          }
        });
      }, {
        threshold: 0.1 // Trigger when at least 10% visible
      });
      
      observer.observe(chartEl);
      
      // Store observer for cleanup (Requirements: 6.1)
      window._chartObserver = observer;
    } else {
      // Fallback: always update if IntersectionObserver not supported
      startChartInterval();
    }
  }
  
  // Add resize listener for responsive chart (only set once)
  // This ensures the chart adapts to window/zoom changes by recalculating
  // SVG viewBox dimensions and redrawing the chart
  // Performance optimization: Use debounce utility (Requirements: 2.2)
  if (!window._chartResizeListenerSet) {
    window._chartResizeListenerSet = true;
    
    const debouncedUpdate = debounce(() => {
      const user = loadUser();
      if (user) {
        updateWalletChart(user);
      }
    }, 200); // 200ms debounce as per requirements
    
    window.addEventListener('resize', debouncedUpdate);
    
    // Store resize handler for cleanup (Requirements: 6.2)
    window._chartResizeHandler = debouncedUpdate;
  }
}

/**
 * Cleanup wallet chart resources
 * Performance optimization: Memory management (Requirements: 6.1)
 */
export function cleanupWalletChart() {
  // Cleanup interval
  if (window._cleanupChartInterval) {
    window._cleanupChartInterval();
    window._cleanupChartInterval = null;
  }
  
  // Cleanup observer
  if (window._chartObserver) {
    window._chartObserver.disconnect();
    window._chartObserver = null;
  }
  
  // Cleanup resize listener
  if (window._chartResizeHandler) {
    window.removeEventListener('resize', window._chartResizeHandler);
    window._chartResizeHandler = null;
  }
  
  // Reset flags
  window._chartIntervalSet = false;
  window._chartResizeListenerSet = false;
}
