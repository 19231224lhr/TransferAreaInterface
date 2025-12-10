# Implementation Plan

- [x] 1. 更新 HTML 结构


  - 将详情内容从侧滑面板移到交易项内部
  - 为每个交易项添加详情容器
  - 添加展开/收起图标
  - _Requirements: 1.1, 5.1_



- [ ] 2. 实现 CSS 样式
- [ ] 2.1 创建手风琴展开/收起样式
  - 定义 `.history-item-detail` 基础样式
  - 实现 `max-height` 过渡动画

  - 添加 `.expanded` 状态样式
  - _Requirements: 1.2, 2.1, 2.2_

- [ ] 2.2 设计详情内容布局
  - 创建详情卡片样式

  - 实现响应式布局（桌面/平板/移动）
  - 确保与现有设计风格一致
  - _Requirements: 3.4, 4.1, 4.2, 4.3_

- [x] 2.3 添加展开图标动画

  - 创建图标旋转动画
  - 添加悬停效果
  - 实现状态指示
  - _Requirements: 3.2, 3.3_

- [x] 2.4 移除侧滑面板样式


  - 删除 `.history-detail` 固定定位样式
  - 删除侧滑动画相关 CSS
  - 清理不再使用的样式类
  - _Requirements: 5.2, 5.3_


- [ ] 3. 实现 JavaScript 逻辑
- [ ] 3.1 修改交易项渲染函数
  - 在 `renderTransactionList` 中为每个交易项添加详情 HTML
  - 添加展开/收起图标

  - 确保详情内容正确嵌入
  - _Requirements: 1.1, 1.5_

- [ ] 3.2 实现展开/收起功能
  - 创建 `toggleTransactionDetail` 函数

  - 实现单一展开逻辑（展开新项时收起旧项）
  - 添加点击事件监听
  - _Requirements: 1.1, 1.3, 1.4_

- [ ] 3.3 添加动画控制
  - 实现防抖或动画锁定

  - 添加滚动到可见区域功能
  - 确保动画流畅
  - _Requirements: 2.3, 2.4_

- [ ] 3.4 移除侧滑面板代码
  - 删除 `showTransactionDetail` 函数

  - 删除 `hideTransactionDetail` 函数
  - 删除详情关闭按钮事件监听
  - 更新 `initHistoryPage` 函数
  - _Requirements: 5.1, 5.2_


- [ ] 4. 更新深色模式样式
  - 为详情展开区域添加深色模式样式
  - 确保动画在深色模式下正常工作
  - 测试视觉一致性
  - _Requirements: 3.4_


- [ ] 5. 测试和优化
- [ ] 5.1 功能测试
  - 测试展开/收起交互
  - 测试单一展开逻辑


  - 测试筛选后的行为
  - _Requirements: 1.1, 1.3, 1.4_

- [ ] 5.2 响应式测试
  - 测试桌面端布局
  - 测试平板端布局
  - 测试移动端布局
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 5.3 性能优化
  - 优化动画性能
  - 减少不必要的 DOM 操作
  - 确保无内存泄漏
  - _Requirements: 2.1, 2.2_

- [ ] 6. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.
