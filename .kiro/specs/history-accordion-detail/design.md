# Design Document

## Overview

将历史交易记录页面的交易详情展示方式从侧滑面板改为手风琴式展开设计。用户点击交易项后，详情内容将在该项下方无缝展开，再次点击则收起。这种设计提供了更好的视觉连贯性和上下文保持。

## Architecture

### Component Structure

```
history-item (交易项)
├── history-item-header (头部：类型、状态)
├── history-item-body (主体：地址、金额、时间)
└── history-item-detail (详情：展开/收起)
    ├── detail-section (基本信息)
    ├── detail-section (地址信息)
    └── detail-section (区块链信息)
```

### State Management

- 使用 `expanded` class 标记展开状态
- 使用 `selectedTransaction` 变量跟踪当前展开的交易
- 使用 CSS `max-height` 和 `opacity` 实现平滑动画

## Components and Interfaces

### 1. Transaction Item Component

**HTML Structure:**
```html
<div class="history-item" data-tx-id="tx_001">
  <!-- Header -->
  <div class="history-item-header">
    <div class="history-item-type">...</div>
    <span class="history-item-status">...</span>
    <svg class="history-item-expand-icon">...</svg>
  </div>
  
  <!-- Body -->
  <div class="history-item-body">...</div>
  
  <!-- Detail (initially hidden) -->
  <div class="history-item-detail">
    <div class="history-detail-section">
      <h4>基本信息</h4>
      <div class="history-detail-card">...</div>
    </div>
    <!-- More sections... -->
  </div>
</div>
```

**CSS Classes:**
- `.history-item` - 交易项容器
- `.history-item.expanded` - 展开状态
- `.history-item-detail` - 详情容器
- `.history-item-expand-icon` - 展开/收起图标
- `.history-item-expand-icon.rotated` - 旋转状态的图标

### 2. Detail Section Component

**Layout:**
- 使用 grid 布局在桌面端显示多列
- 移动端自动切换为单列
- 使用卡片式设计保持视觉一致性

## Data Models

无需修改数据模型，继续使用现有的交易数据结构：

```javascript
{
  id: 'tx_001',
  type: 'send',
  status: 'success',
  amount: 150.50,
  currency: 'PGC',
  from: '...',
  to: '...',
  timestamp: Date.now(),
  txHash: '...',
  gas: 0.5,
  guarantorOrg: '12345678',
  blockNumber: 1234567,
  confirmations: 24
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Expansion
*For any* transaction list, at most one transaction detail should be expanded at any given time.
**Validates: Requirements 1.4**

### Property 2: Toggle Behavior
*For any* transaction item, clicking it when collapsed should expand it, and clicking it when expanded should collapse it.
**Validates: Requirements 1.1, 1.3**

### Property 3: State Consistency
*For any* transaction item with class "expanded", its detail section should be visible and its expand icon should be rotated.
**Validates: Requirements 3.1, 3.2**

### Property 4: Animation Completion
*For any* expand/collapse operation, the animation should complete before allowing another operation on the same item.
**Validates: Requirements 2.4**

## Error Handling

### Scenario 1: Rapid Clicking
- **Problem**: 用户快速连续点击可能导致动画冲突
- **Solution**: 使用防抖或在动画期间禁用点击

### Scenario 2: Missing Transaction Data
- **Problem**: 交易数据不完整可能导致详情显示错误
- **Solution**: 使用可选链和默认值处理缺失数据

### Scenario 3: Scroll Position
- **Problem**: 展开详情可能导致内容超出视口
- **Solution**: 展开后自动滚动确保详情可见

## Testing Strategy

### Unit Tests
1. 测试点击交易项触发展开/收起
2. 测试展开新交易时自动收起旧交易
3. 测试展开图标的旋转状态
4. 测试详情内容的正确渲染

### Integration Tests
1. 测试与筛选功能的配合（筛选后保持展开状态或重置）
2. 测试响应式布局在不同屏幕尺寸下的表现
3. 测试深色模式下的样式

### Visual Tests
1. 验证展开/收起动画流畅性
2. 验证不同状态下的视觉反馈
3. 验证移动端布局

## Implementation Notes

### CSS Transitions
使用 `max-height` 而非 `height` 实现动画，因为：
- `height: auto` 无法平滑过渡
- `max-height` 可以设置足够大的值实现平滑效果
- 配合 `overflow: hidden` 确保内容不溢出

### JavaScript Logic
```javascript
function toggleTransactionDetail(txId) {
  const item = document.querySelector(`[data-tx-id="${txId}"]`);
  const isExpanded = item.classList.contains('expanded');
  
  // Collapse all other items
  document.querySelectorAll('.history-item.expanded').forEach(el => {
    if (el !== item) {
      el.classList.remove('expanded');
    }
  });
  
  // Toggle current item
  item.classList.toggle('expanded');
  
  // Optional: Scroll into view if needed
  if (!isExpanded) {
    setTimeout(() => {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  }
}
```

### Responsive Design
- **Desktop (> 900px)**: 详情使用 2-3 列布局
- **Tablet (600-900px)**: 详情使用 2 列布局
- **Mobile (< 600px)**: 详情使用单列布局

## Migration Plan

### Phase 1: Add Accordion Functionality
1. 在交易项中添加详情容器
2. 实现展开/收起逻辑
3. 添加动画效果

### Phase 2: Remove Side Panel
1. 移除侧滑面板 HTML
2. 移除相关 CSS
3. 移除相关 JavaScript 代码

### Phase 3: Polish & Test
1. 优化动画性能
2. 测试各种场景
3. 调整样式细节

## Performance Considerations

1. **动画性能**: 使用 CSS transforms 和 opacity，避免触发 layout
2. **DOM 操作**: 最小化 DOM 查询，缓存元素引用
3. **事件委托**: 使用事件委托减少事件监听器数量
4. **内存管理**: 确保移除旧的侧滑面板不留内存泄漏
