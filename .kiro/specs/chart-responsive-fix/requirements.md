# Requirements Document - 余额曲线图响应式修复

## Introduction

修复main页面钱包模块中余额曲线图在页面缩放时不响应的问题。当前曲线图的长度是固定的，在页面缩放时不会自动调整，导致显示效果不佳。

## Glossary

- **Balance Chart (余额曲线图)**: 显示用户钱包余额变化趋势的SVG曲线图
- **SVG viewBox**: SVG的视口坐标系统，定义了SVG内容的坐标空间
- **Responsive Design (响应式设计)**: 界面能够根据容器尺寸变化自动调整的设计方式
- **Window Resize Event**: 浏览器窗口尺寸改变时触发的事件

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望余额曲线图能够响应页面缩放，这样无论页面如何缩放，曲线图都能正确显示。

#### Acceptance Criteria

1. WHEN the browser window is resized THEN the balance chart SHALL recalculate its dimensions and redraw
2. WHEN the page zoom level changes THEN the balance chart SHALL maintain its aspect ratio and fill the container width
3. WHEN the chart is redrawn THEN the system SHALL preserve all data points and their values
4. WHEN multiple resize events occur rapidly THEN the system SHALL debounce the redraw to avoid performance issues
5. WHEN the chart container dimensions change THEN the SVG viewBox SHALL be updated to match the new dimensions

### Requirement 2

**User Story:** 作为用户，我希望曲线图的重绘过程是流畅的，不会造成页面卡顿或闪烁。

#### Acceptance Criteria

1. WHEN the chart is being redrawn THEN the system SHALL use requestAnimationFrame for smooth rendering
2. WHEN resize events are triggered THEN the system SHALL debounce with a delay of at least 100ms
3. WHEN the chart updates THEN the transition SHALL be smooth without visible flickering
4. WHEN the chart is redrawn THEN the tooltip positions SHALL be recalculated correctly

### Requirement 3

**User Story:** 作为开发者，我希望图表响应式逻辑与现有的网络图表保持一致，便于维护。

#### Acceptance Criteria

1. WHEN implementing resize handling THEN the system SHALL follow the same pattern as networkChart.js
2. WHEN the chart module is initialized THEN the system SHALL set up resize listeners only once
3. WHEN the page is unloaded THEN the system SHALL clean up event listeners to prevent memory leaks
4. WHEN the chart element is not present THEN the system SHALL handle gracefully without errors
