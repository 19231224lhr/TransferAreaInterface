# 前端流畅度优化实施任务（精简版）

## 核心优化任务

- [x] 1. 性能模式系统


  - 创建性能模式切换功能，让用户选择顶级模式或节能模式
  - _Requirements: 0.1, 0.2, 0.3, 0.4, 0.5_

- [x] 1.1 创建性能模式管理器


  - 在 `js/utils/` 目录创建 `performanceMode.js`
  - 实现 `getMode()`, `setMode()`, `applyMode()`, `loadMode()`, `saveMode()` 方法
  - 使用 localStorage 键名 `performance_mode` 存储，默认为 `premium`
  - _Requirements: 0.4, 0.5_



- [ ] 1.2 创建节能模式CSS
  - 在 `css/` 目录创建 `energy-saving.css`


  - 定义 `.energy-saving-mode` 类：禁用 backdrop-filter、使用纯色背景、缩短动画、隐藏装饰元素
  - _Requirements: 0.3, 0.6, 0.7, 0.8, 0.9_



- [ ] 1.3 在Profile页面添加模式切换UI
  - 在Profile页面添加单选按钮组："顶级模式"和"节能模式"
  - 绑定切换事件，切换后显示toast提示
  - _Requirements: 0.1, 0.10_

- [ ] 1.4 集成模式系统到应用
  - 在 `js/app.js` 的 init 函数中加载和应用模式
  - 导出模式管理器到全局 window 对象
  - _Requirements: 0.4, 0.5_

- [ ] 2. 事件处理优化
  - 实现防抖节流工具，优化高频事件
  - _Requirements: 2.2, 2.3_

- [x] 2.1 创建事件优化工具


  - 在 `js/utils/` 目录创建 `eventUtils.js`
  - 实现 `debounce(func, wait)` 和 `rafThrottle(func)` 函数
  - _Requirements: 2.2, 2.3_

- [x] 2.2 优化图表事件处理


  - 在 `js/ui/charts.js` 中：resize事件使用 `debounce(200ms)`，mousemove使用 `rafThrottle()`
  - 在 `js/ui/networkChart.js` 中：resize事件使用 `debounce(100ms)`
  - 移除现有的手动时间戳检查逻辑
  - _Requirements: 2.2, 2.3_

- [x] 3. 图表渲染优化


  - 使用RAF调度和可见性检测优化图表性能
  - _Requirements: 4.1, 4.5_

- [x] 3.1 实现RAF调度图表渲染（已回退）


  - ~~在 `js/ui/charts.js` 的 `updateWalletChart()` 中使用 requestAnimationFrame 包装SVG更新~~
  - ~~在 `js/ui/networkChart.js` 的渲染函数中使用 requestAnimationFrame~~
  - **用户反馈**：RAF优化已回退，保留原有的直接SVG更新方式以保持"灵动效果"
  - _Requirements: 4.1_

- [x] 3.2 实现图表可见性检测


  - 在 `js/ui/charts.js` 和 `js/ui/networkChart.js` 中使用 IntersectionObserver
  - 图表不可见时暂停 setInterval 更新，可见时恢复
  - 添加 IntersectionObserver polyfill 检测和降级方案
  - _Requirements: 4.5_

- [x] 4. DOM操作优化
  - 优化列表渲染使用批量插入
  - _Requirements: 5.1_

- [x] 4.1 优化地址列表渲染
  - 在 `js/services/wallet.js` 的 `renderWallet()` 和 `rebuildAddrList()` 中使用 DocumentFragment
  - 先创建所有地址卡片，再一次性插入到列表
  - _Requirements: 5.1_

- [x] 4.2 优化交易历史渲染
  - 在 `js/pages/history.js` 的 `renderTransactionList()` 中使用 DocumentFragment
  - 批量创建交易项，一次性插入
  - _Requirements: 5.1_

- [x] 5. 动画性能审查
  - 确保关键动画使用GPU加速属性
  - _Requirements: 1.4, 3.1_

- [x] 5.1 审查地址卡片展开动画
  - 检查 `css/main-v2.css` 中的 `.addr-card` 样式
  - 已确认使用 GPU 加速：transform: translateY(0) translateZ(0) 和 will-change
  - 使用 grid-template-rows 实现平滑展开动画
  - _Requirements: 1.4, 3.1_

- [x] 5.2 添加节能模式动画简化
  - 在 `css/energy-saving.css` 中：装饰性动画设为 `animation: none`
  - 保留关键用户反馈动画（按钮、toast）和原有动画速率
  - 已按用户反馈保持动画时长不变
  - _Requirements: 3.5_

- [x] 6. 内存管理审查
  - 清理定时器和事件监听器避免内存泄漏
  - _Requirements: 7.1, 7.2_

- [x] 6.1 清理图表定时器
  - 在 `js/ui/charts.js` 和 `js/ui/networkChart.js` 中添加 cleanup 函数
  - 添加 `cleanupWalletChart()` 和 `cleanupNetworkChart()` 导出函数
  - 清理 interval、observer 和 resize 监听器
  - _Requirements: 7.1_

- [x] 6.2 审查事件监听器清理
  - 图表模块已添加完整的清理机制
  - 存储 observer 和 handler 引用以便清理
  - 对一次性事件使用 `{ once: true }` 选项
  - _Requirements: 7.2_

- [x] 7. 资源加载优化
  - 优化脚本和字体加载策略
  - _Requirements: 6.2, 6.5_

- [x] 7.1 优化脚本加载
  - 检查 `index.html` 中的 script 标签
  - 已使用 `type="module"` 实现延迟加载（module 默认 defer）
  - _Requirements: 6.2_

- [x] 7.2 优化字体加载
  - 检查 CSS 中的字体使用
  - 应用使用系统字体，无需额外加载优化
  - _Requirements: 6.5_

- [ ] 8. 最终验证
  - 确保优化不改变顶级模式的视觉效果
  - _Requirements: All_

- [ ] 8.1 视觉回归测试
  - 对比优化前后顶级模式的页面截图
  - 确保所有动画和效果完全一致
  - 测试节能模式的简化效果

- [ ] 8.2 功能和性能测试
  - 测试所有现有功能正常工作
  - 测试性能模式切换
  - 测试大列表滚动和页面切换流畅度
  - 使用Chrome DevTools Performance分析

## 说明

此精简版任务列表聚焦于：
1. **性能模式系统** - 核心功能，让用户选择体验
2. **事件优化** - 防抖节流，立竿见影的性能提升
3. **图表优化** - RAF和可见性检测，显著提升流畅度
4. **DOM批量操作** - 减少reflow，提升列表渲染速度
5. **动画审查** - 确保GPU加速，避免卡顿
6. **内存清理** - 防止长时间运行后性能下降
7. **资源加载** - 优化首屏加载速度

移除的优化项（可后续添加）：
- 虚拟滚动（实现复杂，当前列表数量不大）
- ResizeObserver（降级使用debounced resize也足够）
- 路径计算缓存（收益相对较小）
- 详细的属性测试（保留核心功能测试）
