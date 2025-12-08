# 黑夜模式 (Dark Mode) 设计方案

## 📋 项目概述

为 UTXO 钱包应用实现完整的黑夜模式切换功能，提供舒适的夜间使用体验，同时保持与现有 Glassmorphism 设计风格的一致性。

---

## 🎯 设计目标

1. **无缝切换**：日间/夜间模式平滑过渡，无闪烁
2. **持久化**：用户偏好保存到 localStorage
3. **全局覆盖**：所有页面、组件、模态框统一适配
4. **视觉舒适**：夜间模式降低亮度，减少眼睛疲劳
5. **品牌一致**：保持蓝紫渐变主题色，调整明度和饱和度

---

## 🏗️ 技术架构

### 1. CSS 变量系统

采用 CSS Custom Properties (CSS 变量) 实现主题切换，所有颜色值通过变量定义。

#### 核心变量结构

```css
:root {
  /* 基础色彩 */
  --color-bg-primary: #f0f9ff;
  --color-bg-secondary: #e0f2fe;
  --color-bg-tertiary: #f0f4ff;
  
  /* 文本颜色 */
  --color-text-primary: #1f2937;
  --color-text-secondary: #64748b;
  --color-text-tertiary: #94a3b8;
  
  /* 卡片背景 */
  --color-card-bg-start: rgba(255, 255, 255, 0.95);
  --color-card-bg-end: rgba(248, 250, 252, 0.9);
  --color-card-border: rgba(14, 165, 233, 0.1);
  
  /* 主题色 */
  --color-primary: #0ea5e9;
  --color-primary-light: #38bdf8;
  --color-secondary: #8b5cf6;
  --color-secondary-light: #a78bfa;
  
  /* 装饰光球 */
  --orb-opacity: 0.4;
  --orb-blur: 80px;
  
  /* 阴影 */
  --shadow-sm: 0 4px 16px rgba(14, 165, 233, 0.06);
  --shadow-md: 0 8px 24px rgba(14, 165, 233, 0.12);
  --shadow-lg: 0 16px 48px rgba(14, 165, 233, 0.15);
}

[data-theme="dark"] {
  /* 基础色彩 - 深色背景 */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;
  
  /* 文本颜色 - 浅色文字 */
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  --color-text-tertiary: #94a3b8;
  
  /* 卡片背景 - 半透明深色 */
  --color-card-bg-start: rgba(30, 41, 59, 0.95);
  --color-card-bg-end: rgba(51, 65, 85, 0.9);
  --color-card-border: rgba(14, 165, 233, 0.2);
  
  /* 主题色 - 增强亮度 */
  --color-primary: #38bdf8;
  --color-primary-light: #7dd3fc;
  --color-secondary: #a78bfa;
  --color-secondary-light: #c4b5fd;
  
  /* 装饰光球 - 增强对比 */
  --orb-opacity: 0.25;
  --orb-blur: 100px;
  
  /* 阴影 - 更深的阴影 */
  --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
}
```

### 2. JavaScript 控制逻辑

#### 核心函数

```javascript
// 主题管理系统
const THEME_STORAGE_KEY = 'appTheme';

// 获取当前主题
function getCurrentTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
}

// 设置主题
function setTheme(theme) {
  // 验证主题值
  if (theme !== 'light' && theme !== 'dark') {
    console.warn('Invalid theme:', theme);
    return;
  }
  
  // 更新 DOM
  document.documentElement.setAttribute('data-theme', theme);
  
  // 保存到 localStorage
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  
  // 触发自定义事件
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  
  // 显示 Toast 提示
  const message = theme === 'dark' 
    ? t('toast.theme.darkEnabled') 
    : t('toast.theme.lightEnabled');
  showSuccessToast(message);
}

// 切换主题
function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

// 初始化主题
function initTheme() {
  const savedTheme = getCurrentTheme();
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// 页面加载时初始化
initTheme();
```

### 3. UI 控制组件

#### 主题切换器位置

在个人信息页面 (Profile) 的语言选择器下方添加主题切换器。

#### 切换器样式

```html
<!-- 主题切换器 HTML -->
<div class="theme-selector">
  <div class="theme-selector-label">
    <svg><!-- 月亮/太阳图标 --></svg>
    <span data-i18n="profile.theme.title">主题模式</span>
  </div>
  <div class="theme-options">
    <button class="theme-option" data-theme="light">
      <svg><!-- 太阳图标 --></svg>
      <span data-i18n="profile.theme.light">浅色</span>
    </button>
    <button class="theme-option" data-theme="dark">
      <svg><!-- 月亮图标 --></svg>
      <span data-i18n="profile.theme.dark">深色</span>
    </button>
    <button class="theme-option" data-theme="auto">
      <svg><!-- 自动图标 --></svg>
      <span data-i18n="profile.theme.auto">跟随系统</span>
    </button>
  </div>
</div>
```

```css
/* 主题切换器样式 */
.theme-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--color-card-bg-start);
  border: 1px solid var(--color-card-border);
  border-radius: 16px;
  margin-top: 20px;
}

.theme-selector-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--color-card-bg-end);
  border: 2px solid var(--color-card-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.theme-option:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: white;
}

.theme-option.active {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.theme-option svg {
  width: 24px;
  height: 24px;
}

.theme-option span {
  font-size: 12px;
  font-weight: 600;
}
```

---

## 🎨 颜色映射表

### 背景色

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 页面主背景 | `linear-gradient(135deg, #f0f9ff, #e0f2fe, #f0f4ff)` | `linear-gradient(135deg, #0f172a, #1e293b, #0f172a)` |
| 卡片背景 | `rgba(255, 255, 255, 0.95)` | `rgba(30, 41, 59, 0.95)` |
| 输入框背景 | `rgba(255, 255, 255, 0.95)` | `rgba(51, 65, 85, 0.8)` |
| 模态框背景 | `rgba(255, 255, 255, 0.98)` | `rgba(30, 41, 59, 0.98)` |

### 文本色

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 主要文本 | `#1f2937` | `#f1f5f9` |
| 次要文本 | `#64748b` | `#cbd5e1` |
| 辅助文本 | `#94a3b8` | `#94a3b8` |
| 链接文本 | `#0ea5e9` | `#38bdf8` |

### 边框色

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 卡片边框 | `rgba(14, 165, 233, 0.1)` | `rgba(14, 165, 233, 0.2)` |
| 输入框边框 | `rgba(14, 165, 233, 0.12)` | `rgba(14, 165, 233, 0.25)` |
| 分隔线 | `rgba(14, 165, 233, 0.08)` | `rgba(14, 165, 233, 0.15)` |

### 主题色

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 主色调 | `#0ea5e9` | `#38bdf8` (增亮) |
| 次色调 | `#8b5cf6` | `#a78bfa` (增亮) |
| 成功色 | `#10b981` | `#34d399` (增亮) |
| 警告色 | `#f59e0b` | `#fbbf24` (增亮) |
| 错误色 | `#ef4444` | `#f87171` (增亮) |

### 装饰光球

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 光球 1 (蓝色) | `#0ea5e9, opacity: 0.4` | `#0ea5e9, opacity: 0.2` |
| 光球 2 (紫色) | `#8b5cf6, opacity: 0.35` | `#8b5cf6, opacity: 0.18` |
| 模糊半径 | `80px` | `100px` |

---

## 📄 需要修改的文件

### 1. CSS 文件改造

#### `css/base.css`
- 将所有硬编码颜色值替换为 CSS 变量
- 添加 `:root` 和 `[data-theme="dark"]` 变量定义
- 修改 `body::before` 和 `body::after` 光球样式使用变量

#### `css/components.css`
- 按钮组件颜色变量化
- 卡片组件背景和边框变量化
- 模态框样式适配
- 输入框和表单控件适配

#### `css/welcome.css`
- 欢迎页背景渐变适配
- 特性卡片样式适配
- 3D 卡片阴影和光泽效果适配

#### `css/wallet.css`
- 钱包卡片样式适配
- 地址列表样式适配
- 图表背景色适配

#### `css/header.css`
- 导航栏背景适配
- 用户菜单样式适配

#### `css/profile.css`
- 个人信息页面样式适配
- 添加主题切换器样式

#### 其他 CSS 文件
- `css/login.css`
- `css/new-user.css`
- `css/import-wallet.css`
- `css/join-group.css`
- `css/transaction.css`
- `css/toast.css`

### 2. JavaScript 文件

#### `app.js`
- 添加主题管理函数
- 在 i18n 系统旁边添加主题系统
- 在个人信息页面添加主题切换器事件监听
- 添加主题相关翻译键

### 3. HTML 文件

#### `index.html`
- 在个人信息页面添加主题切换器 HTML 结构

---

## 🔄 实现步骤

### Phase 1: 基础架构 (2-3小时)

1. **创建 CSS 变量系统**
   - 在 `css/base.css` 顶部定义所有颜色变量
   - 定义浅色模式 (`:root`)
   - 定义深色模式 (`[data-theme="dark"]`)

2. **JavaScript 主题管理**
   - 在 `app.js` 中添加主题管理函数
   - 实现 `getCurrentTheme()`, `setTheme()`, `toggleTheme()`, `initTheme()`
   - 页面加载时初始化主题

3. **添加翻译键**
   - 在 i18n 系统中添加主题相关翻译

### Phase 2: 核心组件适配 (3-4小时)

1. **base.css 改造**
   - 页面背景渐变
   - 装饰光球
   - 容器样式

2. **components.css 改造**
   - 按钮组件
   - 卡片组件
   - 模态框
   - 输入框
   - Toast 提示

3. **header.css 改造**
   - 导航栏背景
   - 用户菜单
   - 下拉菜单

### Phase 3: 页面样式适配 (4-5小时)

1. **欢迎页 (welcome.css)**
   - 背景渐变和光球
   - 特性卡片
   - 3D 卡片
   - 浮动装饰元素

2. **钱包页 (wallet.css)**
   - 地址卡片
   - 余额显示
   - 图表背景

3. **其他页面**
   - 登录页
   - 注册页
   - 导入钱包页
   - 加入担保组织页
   - 个人信息页

### Phase 4: UI 控制器 (1-2小时)

1. **主题切换器组件**
   - 在个人信息页面添加 HTML 结构
   - 添加 CSS 样式
   - 绑定事件监听器
   - 实现切换动画

2. **快捷切换 (可选)**
   - 在头部导航栏添加快捷切换按钮
   - 键盘快捷键支持 (Ctrl/Cmd + Shift + D)

### Phase 5: 测试与优化 (2-3小时)

1. **全面测试**
   - 测试所有页面的主题切换
   - 测试模态框、Toast 等浮层组件
   - 测试动画过渡效果

2. **性能优化**
   - 确保切换无闪烁
   - 优化 CSS 变量数量
   - 减少重绘和重排

3. **细节打磨**
   - 调整深色模式下的对比度
   - 优化阴影效果
   - 确保文字可读性

---

## 🎯 关键技术点

### 1. 平滑过渡

所有颜色相关属性添加过渡动画：

```css
* {
  transition: 
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
}
```

### 2. 避免闪烁

在 `<head>` 中添加阻塞脚本，在页面渲染前设置主题：

```html
<script>
  (function() {
    const theme = localStorage.getItem('appTheme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### 3. 系统主题检测 (可选)

支持"跟随系统"选项：

```javascript
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? 'dark' 
    : 'light';
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    if (getCurrentTheme() === 'auto') {
      const systemTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
    }
  });
```

### 4. 图片和图标适配

对于需要适配的图片/图标：

```css
[data-theme="dark"] img {
  filter: brightness(0.9);
}

[data-theme="dark"] .logo {
  filter: invert(1) brightness(1.2);
}
```

---

## 📊 预期效果

### 浅色模式
- 清新明亮的蓝紫渐变背景
- 高对比度文字，易于阅读
- 柔和的阴影和光泽效果
- 适合白天使用

### 深色模式
- 深邃的深蓝灰色背景
- 柔和的浅色文字，减少眼睛疲劳
- 增强的主题色亮度
- 更深的阴影，增强层次感
- 适合夜间使用

---

## 🔍 注意事项

1. **对比度**：确保深色模式下文字与背景对比度符合 WCAG AA 标准 (至少 4.5:1)

2. **渐变处理**：深色模式下渐变方向可能需要反转，避免过暗

3. **透明度**：深色模式下半透明元素需要调整透明度，避免过于暗淡

4. **图表适配**：图表库 (如 Chart.js) 需要单独配置深色主题

5. **第三方组件**：确保所有第三方组件支持主题切换

6. **性能**：CSS 变量切换性能优于类名切换，但需要注意浏览器兼容性

---

## 📝 翻译键

需要添加的 i18n 翻译键：

```javascript
// 中文
'profile.theme.title': '主题模式',
'profile.theme.light': '浅色',
'profile.theme.dark': '深色',
'profile.theme.auto': '跟随系统',
'profile.theme.hint': '选择您偏好的界面主题',
'toast.theme.lightEnabled': '已切换到浅色模式',
'toast.theme.darkEnabled': '已切换到深色模式',

// 英文
'profile.theme.title': 'Theme',
'profile.theme.light': 'Light',
'profile.theme.dark': 'Dark',
'profile.theme.auto': 'Auto',
'profile.theme.hint': 'Select your preferred interface theme',
'toast.theme.lightEnabled': 'Switched to light mode',
'toast.theme.darkEnabled': 'Switched to dark mode',
```

---

## ✅ 验收标准

1. ✅ 所有页面支持主题切换
2. ✅ 主题偏好持久化到 localStorage
3. ✅ 切换过程平滑无闪烁
4. ✅ 深色模式下文字清晰可读
5. ✅ 所有组件 (按钮、卡片、模态框等) 正确适配
6. ✅ 装饰元素 (光球、渐变) 正确适配
7. ✅ Toast 提示正确显示
8. ✅ 支持中英文界面
9. ✅ 主题切换器 UI 美观易用
10. ✅ 无控制台错误或警告

---

## 🚀 未来扩展

1. **更多主题**：支持自定义主题色
2. **定时切换**：根据时间自动切换主题
3. **渐变动画**：主题切换时的渐变过渡动画
4. **主题预览**：切换前预览效果
5. **高对比度模式**：为视力障碍用户提供高对比度选项

---

## 📚 参考资源

- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [prefers-color-scheme (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [WCAG 对比度标准](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Material Design Dark Theme](https://material.io/design/color/dark-theme.html)

---

**设计完成日期**: 2024年12月
**预计实施时间**: 12-15 小时
**优先级**: 高
