# UI修复设计文档

## Overview

本文档描述了三个UI修复的技术设计方案，包括用户信息栏显示延迟、账户结构体白线优化和UTXO详情弹窗文字颜色修复。

## Problem Analysis

### 问题1：用户信息栏显示延迟

**现象**：用户登录后，右上角显示"未登录"，需要进入下一个页面才会更新。

**根本原因**：
- 当前实现中，`updateHeaderUser()` 在路由切换时调用（`router.js` 的 `router()` 函数末尾）
- 登录/注册/导入页面完成后，虽然调用了 `updateHeaderUser(user)`，但随后的路由跳转会再次调用 `router()`，导致时序问题
- 应用初始化时，`updateHeaderUser()` 在 `initRouter()` 之后调用，可能导致初始显示延迟

**解决方案**：
1. 确保登录/注册/导入成功后立即调用 `updateHeaderUser(user)`
2. 将应用初始化时的 `updateHeaderUser()` 调用移到 `initRouter()` 之前
3. 保持路由切换时的 `updateHeaderUser()` 调用作为兜底机制

### 问题2：账户结构体白线过于突兀

**现象**：在深色模式下，子地址详情卡片中的分隔线显示为白色，过于刺眼。

**根本原因**：
- `wallet_struct_styles.css` 中使用了硬编码的浅色边框颜色（如 `#f8fafc`）
- 深色模式下的边框颜色不够柔和，使用了不透明的颜色

**解决方案**：
1. 将所有硬编码的边框颜色替换为CSS变量
2. 在深色模式下使用半透明的边框颜色（opacity 0.1-0.2）
3. 保持视觉层次的同时降低对比度

### 问题3：UTXO详情弹窗文字看不清

**现象**：在深色模式下，UTXO详情弹窗中的文字颜色过暗，底部白框显示不正确。

**根本原因**：
- `style.css` 中 `.detail-val` 使用了硬编码的深色文字颜色 `#334155`
- `.detail-sub` 使用了硬编码的白色背景 `#fff`
- 缺少深色模式的样式覆盖

**解决方案**：
1. 将硬编码颜色替换为CSS变量
2. 在 `components.css` 中添加深色模式样式覆盖
3. 确保所有文字颜色使用主题变量

## Architecture

### 组件层次

```
Application
├── Header (js/ui/header.js)
│   └── updateHeaderUser() - 更新用户信息显示
├── Router (js/router.js)
│   └── router() - 路由切换逻辑
├── Pages
│   ├── Login (js/pages/login.js)
│   ├── NewUser (js/pages/newUser.js)
│   └── Import (js/pages/import.js)
└── Modals
    ├── Wallet Structure (wallet_struct_styles.css)
    └── UTXO Detail (components.css, style.css)
```

### 数据流

```
User Action (Login/Register/Import)
  ↓
Update localStorage
  ↓
Call updateHeaderUser(user) ← 立即更新
  ↓
Navigate to next page
  ↓
Router calls updateHeaderUser() ← 兜底更新
```

## Components and Interfaces

### 1. Header User Display

**文件**: `js/ui/header.js`

**函数**: `updateHeaderUser(user)`

**调用时机**：
- 应用初始化（`js/app.js` 的 `init()` 函数）
- 登录成功后（`js/pages/login.js`）
- 注册成功后（`js/pages/newUser.js`）
- 导入成功后（`js/pages/import.js`）
- 路由切换时（`js/router.js` 的 `router()` 函数）

**修改点**：
- 调整调用顺序，确保在路由跳转前更新
- 在 `init()` 中提前调用

### 2. Wallet Structure Styles

**文件**: `wallet_struct_styles.css`

**修改的样式类**：
- `.wb-row` - 信息行的底部边框
- `.wb-code-box` - 代码框的边框
- `.wb-sub-section` - 子标题的顶部边框

**CSS变量使用**：
```css
/* 浅色模式 */
--neutral-100: #f4f4f5;
--neutral-200: #e4e4e7;

/* 深色模式 */
--neutral-100: #334155;
--neutral-200: #475569;
```

**深色模式边框**：
```css
[data-theme="dark"] .wb-row {
  border-bottom-color: rgba(100, 116, 139, 0.1);
}
```

### 3. UTXO Detail Modal Styles

**文件**: `style.css`, `components.css`

**修改的样式类**：
- `.detail-val` - 详情值的文字颜色
- `.detail-sub` - Source TX信息框的背景
- `.detail-label` - 详情标签的文字颜色

**CSS变量使用**：
```css
/* 浅色模式 */
--text-primary: #18181b;
--text-muted: #a1a1aa;
--neutral-50: #fafafa;

/* 深色模式 */
--text-primary: #f1f5f9;
--text-muted: #94a3b8;
--neutral-100: #334155;
```

## Data Models

无需修改数据模型，所有修复都是UI层面的样式和调用时机调整。

## Error Handling

### Header Update Errors

```javascript
export function updateHeaderUser(user) {
  const labelEl = document.getElementById('userLabel');
  const avatarEl = document.getElementById('userAvatar');
  
  if (!labelEl || !avatarEl) return; // 元素不存在时安全返回
  
  // ... 更新逻辑
}
```

### CSS Fallback

```css
/* 使用CSS变量，如果变量未定义则使用fallback值 */
.detail-val {
  color: var(--text-primary, #18181b);
}
```

## Testing Strategy

### 单元测试

不需要单元测试，这些是UI修复。

### 手动测试

**测试场景1：用户信息栏更新**
1. 清除localStorage
2. 访问登录页面
3. 输入私钥登录
4. 观察右上角是否立即显示用户信息
5. 刷新页面，观察是否正确显示

**测试场景2：账户结构体白线**
1. 登录账户
2. 切换到深色模式
3. 打开钱包结构体弹窗
4. 展开子地址详情
5. 观察分隔线是否柔和美观

**测试场景3：UTXO详情弹窗**
1. 登录账户
2. 切换到深色模式
3. 打开钱包结构体弹窗
4. 点击UTXO详情按钮
5. 观察文字是否清晰可读
6. 观察Source TX框是否为深色背景

### 浏览器兼容性测试

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

### 性能测试

- Header更新时间 < 100ms
- 弹窗打开时间 < 200ms
- 无控制台错误

## Implementation Notes

### 修改优先级

1. **高优先级**：用户信息栏显示延迟（影响用户体验）
2. **中优先级**：UTXO详情弹窗文字颜色（影响可读性）
3. **低优先级**：账户结构体白线优化（视觉优化）

### 代码修改范围

**JavaScript文件**：
- `js/app.js` - 调整初始化顺序
- `js/pages/login.js` - 确认调用时机
- `js/pages/newUser.js` - 确认调用时机
- `js/pages/import.js` - 确认调用时机

**CSS文件**：
- `wallet_struct_styles.css` - 优化边框颜色
- `style.css` - 移除硬编码颜色
- `components.css` - 添加深色模式样式

### 向后兼容性

所有修改都保持向后兼容：
- CSS变量有fallback值
- JavaScript函数保持相同的签名
- 不影响现有功能

## Security Considerations

无安全影响，纯UI修复。

## Performance Considerations

- Header更新使用DOM操作，性能影响可忽略
- CSS样式修改不影响渲染性能
- 无额外的网络请求或计算

## Deployment Notes

1. 无需数据库迁移
2. 无需API更改
3. 可以直接部署到生产环境
4. 建议先在测试环境验证

## Future Enhancements

1. 考虑添加header更新动画效果
2. 考虑添加主题切换时的平滑过渡
3. 考虑优化其他弹窗的深色模式适配
