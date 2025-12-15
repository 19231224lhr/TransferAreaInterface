# index.html 模块化重构方案

## 📋 问题概述

### 当前状况
- **文件大小**: 3440 行，约 178KB
- **包含页面数量**: 14+ 个页面模板（`welcomeCard`, `entryCard`, `walletCard`, `loginCard` 等）
- **维护难度**: 高 - 所有 HTML 模板集中在单一文件中
- **首屏加载**: 需要下载整个文件，影响 FCP (First Contentful Paint)
- **代码复用**: 困难 - 相似组件在多处重复定义

### 目标
1. 将每个页面模板拆分为独立文件
2. 实现按需加载（懒加载）
3. 提取可复用组件
4. 优化首屏加载时间
5. 提高代码可维护性

---

## 🏗️ 架构设计

### 方案一：HTML 模板文件 + 动态加载（推荐）

```
项目结构:
├── index.html                    # 精简的骨架文件 (~50行)
├── templates/
│   ├── pages/
│   │   ├── welcome.html          # 欢迎页模板
│   │   ├── entry.html            # 钱包管理页模板
│   │   ├── wallet.html           # 主钱包页模板
│   │   ├── login.html            # 登录页模板
│   │   ├── new-user.html         # 新建账户页模板
│   │   ├── set-password.html     # 设置密码页模板
│   │   ├── import.html           # 导入钱包页模板
│   │   ├── join-group.html       # 加入担保组织页模板
│   │   ├── group-detail.html     # 担保组织详情页模板
│   │   ├── profile.html          # 个人信息页模板
│   │   ├── inquiry.html          # 问询页模板
│   │   └── history.html          # 历史记录页模板
│   └── components/
│       ├── header.html           # 头部组件
│       ├── footer.html           # 页脚组件
│       ├── modal.html            # 模态框组件
│       ├── toast.html            # 提示消息组件
│       └── loading.html          # 加载状态组件
└── js/
    └── utils/
        └── template-loader.ts    # 模板加载器
```

### 方案二：Web Components（现代化方案）

使用 Custom Elements 将页面封装为自定义组件：

```javascript
// 注册自定义元素
class WelcomePage extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `...`;
  }
}
customElements.define('page-welcome', WelcomePage);
```

### 方案三：JavaScript 模板字符串（渐进式方案）

在现有 JS 文件中使用模板字符串：

```javascript
// js/templates/welcome.js
export const welcomeTemplate = `
  <section class="welcome-hero" id="welcomeCard">
    ...
  </section>
`;
```

---

## 📝 推荐实施方案（方案一详解）

### 第一阶段：创建模板加载基础设施

#### 1.1 创建模板加载器

**文件**: `js/utils/template-loader.ts`

```typescript
/**
 * 模板加载器 - 负责动态加载和缓存 HTML 模板
 */

interface TemplateCache {
  [key: string]: string;
}

interface LoadingState {
  [key: string]: Promise<string> | null;
}

class TemplateLoader {
  private cache: TemplateCache = {};
  private loading: LoadingState = {};
  private basePath: string;

  constructor(basePath: string = '/templates') {
    this.basePath = basePath;
  }

  /**
   * 加载模板文件
   * @param templatePath - 相对于 basePath 的模板路径
   * @returns Promise<string> - 模板 HTML 内容
   */
  async load(templatePath: string): Promise<string> {
    const fullPath = `${this.basePath}/${templatePath}`;
    
    // 检查缓存
    if (this.cache[fullPath]) {
      return this.cache[fullPath];
    }

    // 检查是否正在加载
    if (this.loading[fullPath]) {
      return this.loading[fullPath]!;
    }

    // 开始加载
    this.loading[fullPath] = this.fetchTemplate(fullPath);
    
    try {
      const content = await this.loading[fullPath]!;
      this.cache[fullPath] = content;
      return content;
    } finally {
      this.loading[fullPath] = null;
    }
  }

  /**
   * 预加载多个模板
   */
  async preload(templatePaths: string[]): Promise<void> {
    await Promise.all(templatePaths.map(path => this.load(path)));
  }

  /**
   * 加载并插入模板到指定容器
   */
  async loadInto(templatePath: string, container: HTMLElement): Promise<void> {
    const content = await this.load(templatePath);
    container.innerHTML = content;
    
    // 触发 i18n 更新
    if (typeof window.updatePageTranslations === 'function') {
      window.updatePageTranslations();
    }
  }

  /**
   * 加载并追加模板到指定容器
   */
  async appendTo(templatePath: string, container: HTMLElement): Promise<HTMLElement> {
    const content = await this.load(templatePath);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    const fragment = document.createDocumentFragment();
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
    
    container.appendChild(fragment);
    
    // 触发 i18n 更新
    if (typeof window.updatePageTranslations === 'function') {
      window.updatePageTranslations();
    }
    
    return container.lastElementChild as HTMLElement;
  }

  private async fetchTemplate(path: string): Promise<string> {
    try {
      const response = await fetch(path, {
        headers: {
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load template: ${path} (${response.status})`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Template loading error: ${path}`, error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * 从缓存中移除特定模板
   */
  invalidate(templatePath: string): void {
    const fullPath = `${this.basePath}/${templatePath}`;
    delete this.cache[fullPath];
  }
}

// 导出单例实例
export const templateLoader = new TemplateLoader();
export default TemplateLoader;
```

#### 1.2 创建页面容器管理器

**文件**: `js/utils/page-container.ts`

```typescript
/**
 * 页面容器管理器 - 管理动态加载的页面模板
 */

import { templateLoader } from './template-loader';

interface PageConfig {
  templatePath: string;
  containerId: string;
  preload?: boolean;
  onLoad?: (container: HTMLElement) => void;
  onShow?: (container: HTMLElement) => void;
  onHide?: (container: HTMLElement) => void;
}

interface PageRegistry {
  [pageId: string]: PageConfig;
}

class PageContainerManager {
  private registry: PageRegistry = {};
  private loadedPages: Set<string> = new Set();
  private mainContainer: HTMLElement | null = null;

  /**
   * 初始化页面管理器
   */
  init(mainContainerId: string = 'main'): void {
    this.mainContainer = document.getElementById(mainContainerId);
    if (!this.mainContainer) {
      console.error(`Main container #${mainContainerId} not found`);
    }
  }

  /**
   * 注册页面配置
   */
  register(pageId: string, config: PageConfig): void {
    this.registry[pageId] = config;
  }

  /**
   * 批量注册页面
   */
  registerAll(pages: PageRegistry): void {
    Object.keys(pages).forEach(pageId => {
      this.register(pageId, pages[pageId]);
    });
  }

  /**
   * 加载页面模板（如果尚未加载）
   */
  async ensureLoaded(pageId: string): Promise<HTMLElement | null> {
    const config = this.registry[pageId];
    if (!config) {
      console.error(`Page ${pageId} is not registered`);
      return null;
    }

    // 检查是否已加载
    let container = document.getElementById(config.containerId);
    if (container && this.loadedPages.has(pageId)) {
      return container;
    }

    // 加载模板
    try {
      container = await templateLoader.appendTo(
        config.templatePath,
        this.mainContainer!
      );
      
      this.loadedPages.add(pageId);
      
      // 调用加载回调
      if (config.onLoad && container) {
        config.onLoad(container);
      }
      
      return container;
    } catch (error) {
      console.error(`Failed to load page ${pageId}:`, error);
      return null;
    }
  }

  /**
   * 显示指定页面
   */
  async show(pageId: string): Promise<void> {
    // 隐藏所有页面
    this.hideAll();
    
    // 确保页面已加载
    const container = await this.ensureLoaded(pageId);
    if (!container) return;

    // 显示页面
    container.classList.remove('hidden');
    
    // 调用显示回调
    const config = this.registry[pageId];
    if (config.onShow) {
      config.onShow(container);
    }
  }

  /**
   * 隐藏所有页面
   */
  hideAll(): void {
    Object.keys(this.registry).forEach(pageId => {
      const config = this.registry[pageId];
      const container = document.getElementById(config.containerId);
      if (container) {
        container.classList.add('hidden');
        if (config.onHide) {
          config.onHide(container);
        }
      }
    });
  }

  /**
   * 预加载指定页面
   */
  async preloadPages(pageIds: string[]): Promise<void> {
    const templatePaths = pageIds
      .map(id => this.registry[id]?.templatePath)
      .filter(Boolean) as string[];
    
    await templateLoader.preload(templatePaths);
  }

  /**
   * 检查页面是否已加载
   */
  isLoaded(pageId: string): boolean {
    return this.loadedPages.has(pageId);
  }
}

export const pageManager = new PageContainerManager();
export default PageContainerManager;
```

---

### 第二阶段：重构 index.html

#### 2.1 精简后的 index.html 结构

```html
<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <!-- Favicon / App Icons -->
  <link rel="icon" type="image/png" href="/assets/logo.png" />
  <link rel="shortcut icon" type="image/png" href="/assets/logo.png" />
  <link rel="apple-touch-icon" href="/assets/logo.png" />
  <title>PanguPay</title>
  
  <!-- 主题初始化 - 避免闪烁 -->
  <script>
    (function() {
      var theme = localStorage.getItem('appTheme') || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>

  <!-- CSS -->
  <link rel="stylesheet" href="/css/base.css" />
  <link rel="stylesheet" href="/css/components.css" />
  <!-- 其他必要的 CSS 文件 -->
  
  <!-- 关键 CSS 内联（首屏样式） -->
  <style>
    /* 首屏加载骨架屏样式 */
    .app-skeleton {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--color-bg-primary);
    }
    
    .skeleton-loader {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>

<body>
  <!-- 头部组件占位 -->
  <header id="headerContainer"></header>
  
  <!-- 主内容区域 -->
  <main id="main" class="main-container">
    <!-- 初始加载骨架屏 -->
    <div class="app-skeleton" id="appSkeleton">
      <div class="skeleton-loader"></div>
    </div>
    
    <!-- 页面将动态加载到这里 -->
  </main>
  
  <!-- 模态框容器 -->
  <div id="modalContainer"></div>
  
  <!-- Toast 容器 -->
  <div id="toastContainer"></div>
  
  <!-- 锁屏遮罩 -->
  <div id="screenLockOverlay" class="screen-lock-overlay hidden"></div>
  
  <!-- 页脚占位 -->
  <footer id="footerContainer"></footer>
  
  <!-- 外部库 -->
  <script src="https://cdn.jsdelivr.net/npm/elliptic@6.5.4/dist/elliptic.min.js"></script>
  
  <!-- 应用入口 -->
  <script type="module" src="/js/app.js"></script>
</body>

</html>
```

#### 2.2 示例：提取的页面模板文件

**文件**: `templates/pages/welcome.html`

```html
<!-- 欢迎页面模板 -->
<section class="welcome-hero hidden" id="welcomeCard">
  <div class="welcome-bg">
    <div class="welcome-gradient"></div>
    <div class="welcome-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>
    <div class="welcome-pattern"></div>
  </div>

  <!-- 浮动粒子 -->
  <div class="welcome-particles">
    <!-- particles will be generated by JS -->
  </div>

  <div class="welcome-content">
    <div class="welcome-badge" data-i18n="welcome.badge">
      安全 · 快速 · 去中心化
    </div>

    <h1 class="welcome-title">
      <span class="title-line" data-i18n="welcome.titleLine1">开启您的</span>
      <span class="title-line title-gradient" data-i18n="welcome.titleLine2">数字资产之旅</span>
    </h1>

    <p class="welcome-subtitle" data-i18n="welcome.subtitle">
      基于 UTXO 模型的新一代区块链钱包，为您提供安全可靠的资产管理体验
    </p>

    <!-- 特性展示 -->
    <div class="welcome-features">
      <div class="feature-item">
        <div class="feature-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div class="feature-text">
          <h4 data-i18n="welcome.feature1.title">安全保障</h4>
          <p data-i18n="welcome.feature1.desc">本地加密存储，私钥永不上传</p>
        </div>
      </div>
      <!-- 更多特性项... -->
    </div>

    <!-- 操作按钮 -->
    <div class="welcome-actions">
      <button id="welcomeRegisterBtn" class="btn-primary" data-i18n="welcome.getStarted">
        立即开始
      </button>
      <button id="welcomeLoginBtn" class="btn-secondary" data-i18n="welcome.hasAccount">
        已有账户？登录
      </button>
      <button id="welcomeToMainBtn" class="btn-ghost hidden" data-i18n="welcome.goToMain">
        进入主页
      </button>
    </div>
  </div>

  <!-- 右侧视觉区域 -->
  <div class="welcome-visual">
    <!-- 3D 卡片或动画 -->
  </div>
</section>
```

**文件**: `templates/pages/entry.html`

```html
<!-- 钱包管理页面模板 -->
<section class="hidden" id="entryCard">
  <div class="entry-page">
    <!-- 左侧：品牌展示区 -->
    <aside class="entry-sidebar">
      <div class="entry-sidebar-content">
        <!-- Logo 区域 -->
        <div class="entry-brand">
          <div class="entry-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
          </div>
          <h1 class="entry-brand-title" data-i18n="entry.title">钱包管理</h1>
          <p class="entry-brand-desc" data-i18n="entry.description">
            安全管理您的数字资产，支持多地址统一管理
          </p>
        </div>

        <!-- 特性列表 -->
        <div class="entry-benefits">
          <!-- 特性项... -->
        </div>

        <!-- 底部统计 -->
        <div class="entry-sidebar-footer">
          <div class="entry-stats">
            <div class="entry-stat">
              <span class="entry-stat-value" id="sidebarWalletCount">0</span>
              <span class="entry-stat-label" data-i18n="entry.walletsAdded">已添加钱包</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 右侧：主操作区 -->
    <main class="entry-main">
      <!-- 页面内容... -->
    </main>
  </div>
</section>
```

**文件**: `templates/components/header.html`

```html
<!-- 头部组件模板 -->
<header class="header">
  <div class="header-inner">
    <!-- Logo 区域 -->
    <div class="header-logo">
      <div class="logo-icon">
        <img src="/assets/logo.png" alt="PanguPay Logo" class="logo-image" />
        <div class="logo-glow"></div>
      </div>
      <span class="logo-text">PanguPay</span>
    </div>

    <!-- 用户区域 -->
    <div id="userBar" class="user-bar">
      <button id="userButton" class="user-button" aria-label="用户信息" data-i18n-aria="header.userInfo">
        <div class="user-avatar" id="userAvatar">
          <svg class="avatar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <img class="avatar-img hidden" src="" alt="用户头像">
        </div>
        <span id="userLabel" class="user-label" data-i18n="common.notLoggedIn">未登录</span>
        <svg class="user-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div id="userMenu" class="user-menu hidden">
        <!-- 用户菜单内容 -->
      </div>
    </div>
  </div>
</header>
```

---

### 第三阶段：修改路由器和应用初始化

#### 3.1 修改路由器以支持动态加载

**文件**: `js/router.js`（修改）

```javascript
import { pageManager } from './utils/page-container';

// 页面配置注册
const PAGE_CONFIGS = {
  welcome: {
    templatePath: 'pages/welcome.html',
    containerId: 'welcomeCard',
    preload: true, // 首屏预加载
    onLoad: (container) => {
      // 初始化欢迎页脚本
      import('./pages/welcome.js').then(m => m.initWelcomePage?.());
    }
  },
  entry: {
    templatePath: 'pages/entry.html',
    containerId: 'entryCard',
    onLoad: (container) => {
      import('./pages/entry.js').then(m => m.initEntryPage?.());
    }
  },
  wallet: {
    templatePath: 'pages/wallet.html',
    containerId: 'walletCard',
    onLoad: (container) => {
      import('./pages/main.js').then(m => m.initMainPage?.());
    }
  },
  login: {
    templatePath: 'pages/login.html',
    containerId: 'loginCard',
    onLoad: (container) => {
      import('./pages/login.js').then(m => m.initLoginPage?.());
    }
  },
  // ... 其他页面配置
};

// 注册所有页面
pageManager.registerAll(PAGE_CONFIGS);

// 修改后的路由函数
export async function router() {
  const hash = window.location.hash.slice(1) || 'welcome';
  
  // 执行路由守卫
  if (!await executeRouteGuards(hash)) {
    return;
  }
  
  // 显示对应页面（自动加载如果尚未加载）
  await pageManager.show(hash);
  
  // 更新页面标题
  updatePageTitle(hash);
}

// 预加载关键页面
export async function preloadCriticalPages() {
  const criticalPages = ['welcome', 'login', 'entry'];
  await pageManager.preloadPages(criticalPages);
}
```

#### 3.2 修改 app.js 初始化流程

```javascript
import { templateLoader } from './utils/template-loader';
import { pageManager } from './utils/page-container';
import { preloadCriticalPages, router } from './router';

async function init() {
  // 初始化页面管理器
  pageManager.init('main');
  
  // 加载共享组件
  await Promise.all([
    templateLoader.loadInto('components/header.html', document.getElementById('headerContainer')),
    templateLoader.loadInto('components/footer.html', document.getElementById('footerContainer')),
  ]);
  
  // 预加载关键页面
  await preloadCriticalPages();
  
  // 隐藏骨架屏
  const skeleton = document.getElementById('appSkeleton');
  if (skeleton) {
    skeleton.classList.add('hidden');
  }
  
  // 初始化路由
  window.addEventListener('hashchange', router);
  await router();
  
  // 初始化其他功能...
}

// 启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

### 第四阶段：提取可复用组件

#### 4.1 识别可复用组件

从现有代码中识别以下可复用组件：

| 组件名 | 用途 | 使用页面 |
|-------|------|---------|
| `page-sidebar` | 左侧边栏布局 | entry, new-user, import, login 等 |
| `benefit-list` | 特性/好处列表 | 多个页面 |
| `stats-bar` | 统计数据展示 | entry, welcome, wallet |
| `action-card` | 操作卡片按钮 | entry, join-group |
| `form-input` | 表单输入框 | 所有表单页面 |
| `password-input` | 密码输入框 | login, set-password, new-user |
| `address-card` | 地址信息卡片 | wallet, entry |
| `loading-spinner` | 加载指示器 | 全局使用 |
| `modal-dialog` | 模态对话框 | 全局使用 |

#### 4.2 组件模板示例

**文件**: `templates/components/benefit-list.html`

```html
<!-- 特性列表组件 -->
<!-- 使用方式: data-benefits='[{"icon":"shield","titleKey":"...","descKey":"..."}]' -->
<template id="benefitListTemplate">
  <div class="benefit-list">
    <!-- 动态生成的特性项 -->
  </div>
</template>

<template id="benefitItemTemplate">
  <div class="benefit-item">
    <div class="benefit-icon">
      <!-- SVG 图标插槽 -->
    </div>
    <div class="benefit-text">
      <h4 class="benefit-title"></h4>
      <p class="benefit-desc"></p>
    </div>
  </div>
</template>
```

**文件**: `js/components/BenefitList.ts`

```typescript
import { t } from '../i18n';

interface BenefitItem {
  icon: string;
  titleKey: string;
  descKey: string;
}

const ICON_PATHS: Record<string, string> = {
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />',
  download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />',
  // ... 更多图标
};

export function createBenefitList(benefits: BenefitItem[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'benefit-list';
  
  benefits.forEach(benefit => {
    const item = document.createElement('div');
    item.className = 'benefit-item';
    item.innerHTML = `
      <div class="benefit-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${ICON_PATHS[benefit.icon] || ''}
        </svg>
      </div>
      <div class="benefit-text">
        <h4 data-i18n="${benefit.titleKey}">${t(benefit.titleKey)}</h4>
        <p data-i18n="${benefit.descKey}">${t(benefit.descKey)}</p>
      </div>
    `;
    container.appendChild(item);
  });
  
  return container;
}
```

---

## 📊 实施优先级

### 阶段一：基础设施（1-2天）
- [ ] 创建 `template-loader.ts`
- [ ] 创建 `page-container.ts`
- [ ] 测试模板加载机制

### 阶段二：核心页面拆分（3-5天）
- [ ] 提取 `welcome.html`
- [ ] 提取 `entry.html`
- [ ] 提取 `login.html`
- [ ] 提取 `wallet.html`（主页面）
- [ ] 提取 `header.html` 和 `footer.html`

### 阶段三：其他页面拆分（3-4天）
- [ ] 提取 `new-user.html`
- [ ] 提取 `set-password.html`
- [ ] 提取 `import.html`
- [ ] 提取 `join-group.html`
- [ ] 提取 `group-detail.html`
- [ ] 提取 `profile.html`
- [ ] 提取 `history.html`

### 阶段四：组件提取与优化（2-3天）
- [ ] 提取共用组件
- [ ] 优化加载策略
- [ ] 添加加载状态和错误处理

---

## 🎯 预期效果

### 性能改善
| 指标 | 优化前 | 优化后 | 改善 |
|-----|-------|-------|-----|
| index.html 大小 | ~178KB | ~5KB | -97% |
| 首屏 HTML 传输 | 178KB | 5KB + 20KB (首屏模板) | -86% |
| FCP (First Contentful Paint) | ~1.5s | ~0.5s | -67% |
| 代码可维护性 | 低 | 高 | 显著提升 |

### 开发体验改善
- **模块化**: 每个页面独立文件，易于维护
- **代码复用**: 共用组件可在多处使用
- **团队协作**: 多人可并行开发不同页面
- **代码审查**: 更容易进行增量代码审查

---

## ⚠️ 注意事项

### 兼容性
1. 确保模板文件正确设置 MIME 类型 (`text/html`)
2. 处理模板加载失败的情况
3. 保持 i18n 属性在模板中正常工作

### 缓存策略
1. 使用版本号或哈希进行缓存控制
2. Service Worker 应该缓存模板文件
3. 预加载策略根据用户行为优化

### 测试
1. 验证所有页面正常加载和显示
2. 测试路由切换的过渡效果
3. 检查 i18n 翻译是否正常更新
4. 验证组件状态保持和事件绑定

---

## 📁 附录：完整文件清单

```
templates/
├── pages/
│   ├── welcome.html         # 欢迎页 (~80行)
│   ├── entry.html           # 钱包管理页 (~150行)
│   ├── wallet.html          # 主钱包页 (~500行)
│   ├── login.html           # 登录页 (~200行)
│   ├── new-user.html        # 新建账户页 (~180行)
│   ├── set-password.html    # 设置密码页 (~150行)
│   ├── import.html          # 导入钱包页 (~180行)
│   ├── join-group.html      # 加入担保组织页 (~250行)
│   ├── group-detail.html    # 担保组织详情页 (~150行)
│   ├── profile.html         # 个人信息页 (~200行)
│   ├── inquiry.html         # 问询页 (~100行)
│   └── history.html         # 历史记录页 (~200行)
└── components/
    ├── header.html          # 头部 (~100行)
    ├── footer.html          # 页脚 (~50行)
    ├── modal.html           # 模态框 (~30行)
    ├── toast.html           # 提示 (~20行)
    ├── loading.html         # 加载状态 (~20行)
    ├── benefit-list.html    # 特性列表 (~30行)
    ├── address-card.html    # 地址卡片 (~50行)
    └── password-input.html  # 密码输入 (~40行)
```

---

*文档版本: 1.0*  
*创建日期: 2025-12-15*  
*作者: AI Assistant*
