# Design Document - 余额曲线图响应式修复

## Overview

本设计文档描述如何修复余额曲线图在页面缩放时不响应的问题。核心解决方案是添加窗口resize事件监听器，在容器尺寸变化时重新计算SVG viewBox并重绘图表。

## Architecture

### Current Implementation

当前 `js/ui/charts.js` 中的 `updateWalletChart()` 函数：
1. 在初始化时计算容器尺寸
2. 基于容器尺寸设置SVG viewBox
3. 绘制曲线和数据点

**问题**: 没有监听窗口resize事件，导致页面缩放时图表不更新。

### Proposed Solution

参考 `js/ui/networkChart.js` 的实现模式：
1. 在 `initWalletChart()` 中添加window resize事件监听器
2. 使用防抖(debounce)机制避免频繁重绘
3. Resize时调用 `updateWalletChart()` 重新渲染

## Components and Interfaces

### Modified Functions

#### `initWalletChart()`

**Current:**
```javascript
export function initWalletChart() {
  const chartEl = document.getElementById('balanceChart');
  if (!chartEl) return;
  
  const u = loadUser();
  if (u) {
    updateWalletChart(u);
  }
  
  // Auto-update chart every minute
  if (!window._chartIntervalSet) {
    window._chartIntervalSet = true;
    setInterval(() => {
      const user = loadUser();
      if (user) {
        updateWalletChart(user);
      }
    }, 60 * 1000);
  }
}
```

**Proposed:**
```javascript
export function initWalletChart() {
  const chartEl = document.getElementById('balanceChart');
  if (!chartEl) return;
  
  const u = loadUser();
  if (u) {
    updateWalletChart(u);
  }
  
  // Auto-update chart every minute
  if (!window._chartIntervalSet) {
    window._chartIntervalSet = true;
    setInterval(() => {
      const user = loadUser();
      if (user) {
        updateWalletChart(user);
      }
    }, 60 * 1000);
  }
  
  // Add resize listener for responsive chart
  if (!window._chartResizeListenerSet) {
    window._chartResizeListenerSet = true;
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const user = loadUser();
        if (user) {
          updateWalletChart(user);
        }
      }, 100);
    });
  }
}
```

### No Changes Required

`updateWalletChart()` 函数已经正确实现了基于容器尺寸的动态计算：
- 使用 `getBoundingClientRect()` 获取实时容器尺寸
- 动态计算 viewBox 尺寸
- 重新生成所有路径和数据点

因此只需要在resize时调用它即可。

## Data Models

无需修改数据模型。图表数据继续使用现有的历史记录格式：
```javascript
{
  t: timestamp,  // 时间戳
  v: value       // 余额值
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework:

1.1 WHEN the browser window is resized THEN the balance chart SHALL recalculate its dimensions and redraw
Thoughts: This is a property that should hold for all resize events. We can test by triggering resize events and verifying that the chart's viewBox dimensions match the container dimensions.
Testable: yes - property

1.2 WHEN the page zoom level changes THEN the balance chart SHALL maintain its aspect ratio and fill the container width
Thoughts: This is about the visual behavior across different zoom levels. We can test by checking that the SVG width always matches the container width after zoom changes.
Testable: yes - property

1.3 WHEN the chart is redrawn THEN the system SHALL preserve all data points and their values
Thoughts: This is a round-trip property - the data before and after redraw should be identical.
Testable: yes - property

1.4 WHEN multiple resize events occur rapidly THEN the system SHALL debounce the redraw to avoid performance issues
Thoughts: This tests that rapid resize events don't cause excessive redraws. We can count the number of redraws within a time window.
Testable: yes - property

1.5 WHEN the chart container dimensions change THEN the SVG viewBox SHALL be updated to match the new dimensions
Thoughts: This is testing that the viewBox attribute reflects the container size. We can compare the viewBox values with container dimensions.
Testable: yes - property

2.1 WHEN the chart is being redrawn THEN the system SHALL use requestAnimationFrame for smooth rendering
Thoughts: This is about implementation details. The current code doesn't use RAF, and adding it might be over-engineering for this fix.
Testable: no

2.2 WHEN resize events are triggered THEN the system SHALL debounce with a delay of at least 100ms
Thoughts: This is testing the debounce timing. We can measure the time between resize trigger and actual redraw.
Testable: yes - example

2.3 WHEN the chart updates THEN the transition SHALL be smooth without visible flickering
Thoughts: This is about visual quality which is subjective and hard to test programmatically.
Testable: no

2.4 WHEN the chart is redrawn THEN the tooltip positions SHALL be recalculated correctly
Thoughts: This is testing that tooltip positioning logic works correctly after resize. We can verify tooltip coordinates match expected positions.
Testable: yes - property

3.1 WHEN implementing resize handling THEN the system SHALL follow the same pattern as networkChart.js
Thoughts: This is a code style requirement, not a functional requirement.
Testable: no

3.2 WHEN the chart module is initialized THEN the system SHALL set up resize listeners only once
Thoughts: This tests that we don't create duplicate event listeners. We can check that the flag prevents multiple listener registrations.
Testable: yes - example

3.3 WHEN the page is unloaded THEN the system SHALL clean up event listeners to prevent memory leaks
Thoughts: This is about resource cleanup. However, for a SPA that doesn't reload, this might not be critical. Also, the current implementation doesn't clean up.
Testable: no

3.4 WHEN the chart element is not present THEN the system SHALL handle gracefully without errors
Thoughts: This is an edge case - testing that missing DOM elements don't cause crashes.
Testable: yes - edge case

### Property Reflection

After reviewing all properties:

**Redundant properties:**
- Property 1.1 and 1.5 are testing the same thing (viewBox updates on resize)
- Property 1.2 is a subset of 1.1 (zoom is just a type of resize)

**Consolidated properties:**

Property 1: Chart dimensions update on resize
*For any* window resize event, the chart's SVG viewBox dimensions should match the container's current dimensions
**Validates: Requirements 1.1, 1.2, 1.5**

Property 2: Data preservation during redraw
*For any* chart redraw operation, all data points and their values should remain unchanged
**Validates: Requirements 1.3**

Property 3: Debounce prevents excessive redraws
*For any* sequence of rapid resize events within 100ms, only one chart redraw should occur after the last event
**Validates: Requirements 1.4**

Property 4: Tooltip positioning accuracy
*For any* data point, after a chart redraw, the tooltip position should correctly correspond to the point's visual location
**Validates: Requirements 2.4**

## Error Handling

### Missing Chart Element

```javascript
export function initWalletChart() {
  const chartEl = document.getElementById('balanceChart');
  if (!chartEl) {
    console.warn('Balance chart element not found, skipping initialization');
    return;
  }
  // ... rest of initialization
}
```

### Resize During Chart Update

The debounce mechanism ensures that if a resize occurs while the chart is being updated, the update will be queued and executed after the debounce delay.

## Testing Strategy

### Unit Tests

1. **Test resize listener registration**
   - Verify that resize listener is only registered once
   - Verify that the flag `_chartResizeListenerSet` prevents duplicate registration

2. **Test debounce mechanism**
   - Trigger multiple resize events rapidly
   - Verify that only one chart update occurs after 100ms

3. **Test graceful handling of missing elements**
   - Call `initWalletChart()` when chart element doesn't exist
   - Verify no errors are thrown

### Property-Based Tests

1. **Property 1: Chart dimensions update on resize**
   - Generate random container dimensions
   - Trigger resize event
   - Verify viewBox matches container dimensions

2. **Property 2: Data preservation during redraw**
   - Generate random chart data
   - Trigger chart redraw
   - Verify all data points are preserved

3. **Property 3: Debounce prevents excessive redraws**
   - Generate random number of rapid resize events (5-20)
   - Verify only one redraw occurs

4. **Property 4: Tooltip positioning accuracy**
   - Generate random data points
   - Trigger resize
   - Verify tooltip positions are recalculated correctly

### Integration Tests

1. **Visual regression test**
   - Capture screenshot of chart at different zoom levels
   - Verify chart fills container width at all zoom levels

2. **Performance test**
   - Trigger 100 resize events rapidly
   - Verify page remains responsive (no blocking)

## Implementation Notes

### Debounce Timing

使用100ms的防抖延迟，与 `networkChart.js` 保持一致。这个延迟足够短以保证响应性，又足够长以避免过度重绘。

### Memory Management

当前实现使用全局标志 `window._chartResizeListenerSet` 来防止重复注册。虽然不是最优雅的解决方案，但与现有代码风格保持一致。

### Browser Compatibility

`window.addEventListener('resize')` 和 `getBoundingClientRect()` 在所有现代浏览器中都有良好支持。

## Performance Considerations

1. **Debounce**: 100ms延迟确保在快速调整窗口大小时不会过度重绘
2. **Conditional Update**: 只在用户数据存在时才更新图表
3. **Single Listener**: 使用标志确保只注册一次resize监听器

## Alternative Approaches Considered

### ResizeObserver API

**Pros:**
- 更精确地监听特定元素的尺寸变化
- 不受窗口resize以外的因素影响

**Cons:**
- 需要额外的polyfill支持旧浏览器
- 当前项目没有使用ResizeObserver
- 增加代码复杂度

**Decision:** 使用window resize事件，与现有代码保持一致。

### CSS-only Solution

**Pros:**
- 无需JavaScript
- 性能更好

**Cons:**
- SVG viewBox无法通过纯CSS动态计算
- 曲线路径需要基于实际尺寸重新计算

**Decision:** 必须使用JavaScript解决方案。
