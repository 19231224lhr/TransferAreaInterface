# UI修复实现任务列表

## 实现说明
本任务列表包含三个主要UI修复：用户信息栏更新延迟、账户结构体白线优化、UTXO详情弹窗文字颜色修复。

---

## 任务列表

- [x] 1. 修复用户信息栏显示延迟问题







  - [ ] 1.1 在登录页面完成登录后立即调用 updateHeaderUser
    - 在 `js/pages/login.js` 的登录成功回调中确保调用 `updateHeaderUser(user)`
    - 确保在路由跳转之前更新header显示

    - _需求: 1.1, 1.4_
  
  - [ ] 1.2 在注册页面完成注册后立即调用 updateHeaderUser
    - 在 `js/pages/newUser.js` 的注册成功回调中确保调用 `updateHeaderUser(user)`

    - 确保在路由跳转之前更新header显示
    - _需求: 1.1, 1.4_
  
  - [x] 1.3 在导入页面完成导入后立即调用 updateHeaderUser

    - 在 `js/pages/import.js` 的导入成功回调中确保调用 `updateHeaderUser(user)`
    - 确保在路由跳转之前更新header显示
    - _需求: 1.2, 1.4_
  



  - [ ] 1.4 在应用初始化时立即更新header显示
    - 在 `js/app.js` 的 `init()` 函数中，在 `initRouter()` 之前调用 `updateHeaderUser(loadUser())`
    - 确保页面加载时就显示正确的用户信息




    - _需求: 1.3, 1.4_
  
  - [ ] 1.5 验证header更新时机
    - 测试登录流程，确认header立即更新

    - 测试注册流程，确认header立即更新
    - 测试导入流程，确认header立即更新
    - 测试页面刷新，确认header正确显示
    - _需求: 1.1, 1.2, 1.3, 1.5_


- [ ] 2. 优化账户结构体白线显示
  - [ ] 2.1 修复子地址详情卡片的边框线
    - 在 `wallet_struct_styles.css` 中修改 `.wb-row` 的 `border-bottom` 颜色

    - 将硬编码的 `#f8fafc` 改为 CSS 变量 `var(--neutral-100)`
    - 在深色模式下使用半透明边框：`rgba(100, 116, 139, 0.1)`
    - _需求: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.2 修复完整地址代码框的边框




    - 在 `wallet_struct_styles.css` 中修改 `.wb-code-box` 的边框颜色
    - 确保深色模式下使用 `rgba(100, 116, 139, 0.3)` 作为边框色
    - _需求: 2.1, 2.2, 2.4_
  
  - [x] 2.3 修复子标题分隔线

    - 在 `wallet_struct_styles.css` 中修改 `.wb-sub-section` 的 `border-top` 颜色
    - 在深色模式下使用 `rgba(100, 116, 139, 0.15)` 作为边框色
    - _需求: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.4 验证白线优化效果

    - 在深色模式下打开钱包结构体弹窗
    - 检查所有分隔线是否柔和美观
    - 确保视觉层次清晰
    - 确保浅色模式不受影响
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_


- [ ] 3. 修复UTXO详情弹窗文字颜色
  - [ ] 3.1 在components.css中添加detail-row相关的深色模式样式
    - 添加 `[data-theme="dark"] .detail-row` 样式
    - 添加 `[data-theme="dark"] .detail-label` 样式，使用 `var(--text-muted)`
    - 添加 `[data-theme="dark"] .detail-val` 样式，使用 `var(--text-primary)`
    - 添加 `[data-theme="dark"] .detail-sub` 样式，使用深色背景 `var(--neutral-100)`


    - _需求: 3.1, 3.2, 3.3, 3.4, 3.6_

  
  - [ ] 3.2 移除style.css中的硬编码颜色
    - 将 `.detail-val` 的 `color: #334155` 改为 `color: var(--text-primary)`
    - 将 `.detail-sub` 的 `background: #fff` 改为 `background: var(--neutral-50)`
    - 确保使用CSS变量而不是硬编码颜色
    - _需求: 3.3, 3.4, 4.1, 4.2, 4.3_

  
  - [ ] 3.3 优化detail-sub的样式
    - 添加圆角 `border-radius: 8px`
    - 添加内边距 `padding: 10px 12px`
    - 添加边框 `border: 1px solid var(--neutral-200)`
    - 在深色模式下使用 `border-color: rgba(100, 116, 139, 0.3)`

    - _需求: 3.4, 3.5, 3.6_
  
  - [ ] 3.4 验证UTXO详情弹窗显示效果
    - 在深色模式下打开UTXO详情弹窗
    - 检查所有文字是否清晰可读

    - 检查Source TX白框是否已修复为深色
    - 确保对比度符合WCAG标准（至少4.5:1）
    - 确保浅色模式不受影响
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. 最终验证和测试
  - [ ] 4.1 跨浏览器测试
    - 在Chrome中测试所有修复
    - 在Firefox中测试所有修复
    - 在Edge中测试所有修复
    - 在Safari中测试所有修复（如果可用）
    - _需求: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 4.2 性能测试
    - 测试header更新速度（应在100ms内完成）
    - 测试钱包结构体弹窗渲染速度
    - 测试UTXO详情弹窗打开速度（应在200ms内完成）
    - 检查控制台是否有错误或警告
    - _需求: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 4.3 回归测试
    - 测试浅色模式下所有修复的区域
    - 确保没有视觉回归
    - 确保所有交互功能正常
    - _需求: 5.5, 6.5_
  
  - [ ] 4.4 用户验收测试
    - 请用户确认用户信息栏显示问题已解决
    - 请用户确认账户结构体白线已优化
    - 请用户确认UTXO详情弹窗文字清晰可读
    - _需求: 1.5, 2.5, 3.2_

---

## 任务执行说明

1. 按顺序执行任务 1-3，每个任务包含多个子任务
2. 每完成一个子任务后，可以继续下一个子任务
3. 任务 4 进行全面验证和测试
4. 所有任务完成后请用户验收

---

**创建日期**: 2024年12月9日
**优先级**: 高 - 用户反馈的关键问题
**预计完成时间**: 1-2 小时
