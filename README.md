# PanguPay

盘古系统转账区 - 基于 UTXO 模型的区块链支付钱包

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.18+-00ADD8?style=flat-square&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 项目简介

PanguPay 是一个完整的区块链钱包解决方案，采用 UTXO 模型实现资产管理和转账功能。

**核心特性：**
- 🔐 **安全可靠**：AES-256-GCM 私钥加密，Web Crypto API 密钥生成
- 🌐 **国际化**：完整的中英文双语支持（260+ 翻译键）
- 📱 **现代化 UI**：Glassmorphism 设计风格，支持深色模式
- ♿ **无障碍**：WCAG 2.1 AA 标准，完整的 ARIA 支持
- 🚀 **高性能**：HTML 模块化按需加载，Service Worker 离线支持
- 🎨 **组件化**：TypeScript + 模块化 CSS，易于维护和扩展

**项目文档：** [飞书文档](https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc)

---

## 🚀 快速开始

### 环境要求

- **Node.js 18+** (前端开发环境)
- **Go 1.18+** (后端参考实现，可选)
- 现代浏览器 (Chrome/Firefox/Edge/Safari)

### 启动开发服务器

```bash
# 1. 克隆项目
git clone https://github.com/19231224lhr/TransferAreaInterface.git
cd TransferAreaInterface

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 浏览器打开: http://localhost:3000/
```

### 常用命令

```bash
npm run dev       # 启动 Vite 开发服务器（热更新）
npm run build     # 构建生产版本到 dist/
npm run preview   # 预览生产构建
npm run typecheck # TypeScript 类型检查
```

### 生产部署

```bash
# 构建生产版本
npm run build

# 部署 dist/ 目录到静态服务器
# 支持: Nginx, Apache, Vercel, Netlify 等
```

---

## 🏗️ 项目架构

### 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | Vanilla JS + TypeScript | - | 无框架，原生开发，渐进式 TS 迁移 |
| 构建工具 | Vite | 5.4.21 | 快速热更新，ES Module 支持 |
| 类型系统 | TypeScript | 5.9.3 | 严格类型检查，JS/TS 混合 |
| 样式 | CSS3 | - | 模块化 CSS（JS 导入），Glassmorphism 设计 |
| 后端 | Go | 1.18+ | UTXO 交易逻辑（参考实现） |
| 国际化 | 自研 i18n | - | 支持中英文，260+ 翻译键 |
| 离线支持 | Service Worker | - | PWA 支持，离线缓存 |

### 📁 目录结构

```
TransferAreaInterface/
├── 📄 index.html                    # SPA 应用入口（精简骨架）
├── 📄 sw.js                         # Service Worker（离线支持）
├── 📄 vite.config.js                # Vite 构建配置
├── 📄 tsconfig.json                 # TypeScript 配置
├── 📄 package.json                  # npm 项目配置
│
├── 🎨 css/                          # 模块化样式文件（通过 JS 导入）
│   ├── index.css                    # CSS 入口文件（统一管理所有导入）
│   ├── base.css                     # 基础样式、CSS 变量
│   ├── components.css               # 通用组件样式
│   ├── animations.css               # 动画效果
│   ├── welcome.css                  # 欢迎页样式
│   ├── login.css / new-user.css     # 登录/注册页样式
│   ├── wallet.css                   # 钱包主页样式
│   ├── transaction.css              # 转账表单样式
│   ├── history.css                  # 交易历史样式
│   ├── ...                          # 其他页面样式
│   └── main-v2/                     # 主页面 V2 模块化（21 个文件）
│       ├── index.css                # main-v2 入口文件
│       ├── variables.css            # 设计变量（颜色、阴影等）
│       ├── wallet-panel.css         # 钱包面板
│       ├── transfer-panel.css       # 转账面板
│       ├── recipients.css           # 收款方模块
│       ├── dark-mode.css            # 深色模式
│       └── ...                      # 其他模块
│
├── 📦 assets/                       # 静态资源
│   ├── logo.png                     # 项目 Logo
│   ├── avatar.png                   # 默认头像
│   └── templates/                   # HTML 模板文件（模块化）
│       └── pages/                   # 页面模板（12 个独立文件）
│           ├── welcome.html         # 欢迎页模板
│           ├── login.html           # 登录页模板
│           ├── new-user.html        # 注册页模板
│           ├── wallet.html          # 钱包主页模板
│           ├── history.html         # 历史记录模板
│           └── ...                  # 其他页面模板
│
├── 📜 js/                           # JavaScript/TypeScript 代码
│   ├── app.js                       # 应用入口
│   ├── router.js                    # 路由管理
│   │
│   ├── 📁 config/                   # 配置模块
│   │   ├── constants.ts             # 常量配置（TS）
│   │   └── pageTemplates.ts         # 页面模板配置（TS）
│   │
│   ├── 📁 i18n/                     # 国际化
│   │   ├── index.js                 # i18n 核心
│   │   ├── zh-CN.js                 # 中文翻译
│   │   └── en.js                    # 英文翻译
│   │
│   ├── 📁 pages/                    # 页面逻辑（JS）
│   │   ├── welcome.js               # 欢迎页
│   │   ├── login.js                 # 登录页
│   │   ├── newUser.js               # 注册页
│   │   ├── main.js                  # 钱包主页
│   │   ├── history.js               # 历史记录
│   │   └── ...                      # 其他页面
│   │
│   ├── 📁 services/                 # 业务逻辑（TS + JS）
│   │   ├── account.ts               # 账户服务（TS）
│   │   ├── transaction.ts           # 交易服务（TS）
│   │   ├── transfer.ts              # 转账服务（TS）
│   │   ├── wallet.js                # 钱包服务（JS）
│   │   └── ...                      # 其他服务
│   │
│   ├── 📁 ui/                       # UI 组件（JS）
│   │   ├── header.js                # 头部导航
│   │   ├── footer.js                # 底部导航
│   │   ├── modal.js                 # 模态框
│   │   ├── toast.js                 # Toast 提示
│   │   └── ...                      # 其他组件
│   │
│   └── 📁 utils/                    # 工具模块（TS）
│       ├── templateLoader.ts        # 模板加载器（动态加载）
│       ├── pageManager.ts           # 页面管理器（生命周期）
│       ├── crypto.ts                # 加密工具
│       ├── keyEncryption.ts         # 密钥加密
│       ├── security.ts              # 安全验证
│       ├── storage.ts               # 本地存储
│       └── ...                      # 其他工具
│
├── 🔧 backend/                      # Go 后端（参考实现）
│   ├── Account.go                   # 账户结构
│   ├── Transaction.go               # 交易结构
│   ├── SendTX.go                    # 交易构建
│   ├── core.go                      # 核心功能
│   └── ...                          # 其他模块
│
├── 🚀 dist/                         # 构建输出（npm run build）
│   ├── index.html                   # 打包后的 HTML
│   ├── assets/                      # 打包后的资源
│   └── ...                          # 其他构建产物
│
└── 📚 docs/                         # 项目文档
    ├── IMPROVEMENT_REPORT.md        # 优化报告
    └── INDEX_HTML_MODULARIZATION_PLAN.md  # 模块化方案

---

## 💻 核心模块

### 前端架构

#### 🎨 HTML 模块化系统

项目采用**动态模板加载**架构，实现按需加载和高性能：

- **模板加载器** (`templateLoader.ts`)：动态加载 HTML 模板，智能缓存
- **页面管理器** (`pageManager.ts`)：管理页面生命周期（idle → loading → loaded → error）
- **页面配置** (`pageTemplates.ts`)：集中管理 12 个页面的路由和模板映射

**性能提升：**
- index.html 从 3440 行减少到 ~500 行（**减少 83%**）
- 首屏加载时间减少 **80%**
- 支持预加载关键页面（welcome、login、entry）

#### 🌐 核心页面

| 路由 | 页面 | 功能 |
|------|------|------|
| `#/` | 欢迎页 | 应用首页，功能入口 |
| `#/login` | 登录页 | 私钥登录 |
| `#/new-user` | 注册页 | 创建新账户 |
| `#/entry` | 钱包管理 | 地址管理与导入 |
| `#/main` | 钱包主页 | 资产概览与转账 |
| `#/history` | 交易历史 | 历史记录查询 |
| `#/profile` | 个人信息 | 设置与偏好 |
| `#/join-group` | 担保组织 | 加入担保组织 |

#### 🔐 安全特性

- **私钥加密**：AES-256-GCM + PBKDF2（100,000 次迭代）
- **密钥生成**：Web Crypto API，ECDSA P-256 曲线
- **XSS/CSRF 防护**：输入转义、安全请求封装
- **账户 ID**：CRC32 校验和映射为 8 位数字
- **地址生成**：SHA-256 哈希，取前 20 字节

#### 🌍 国际化 (i18n)

- 支持简体中文（zh-CN）和英语（en）
- 260+ 翻译键，覆盖所有页面和组件
- 自动更新机制，路由切换时同步翻译
- 语言偏好持久化到 localStorage

#### ♿ 可访问性 (A11y)

- WCAG 2.1 AA 标准
- 完整的 ARIA 标签和角色
- 键盘导航支持
- 屏幕阅读器实时播报

### 后端架构（Go）

> **注意**：后端 Go 代码仅作为 UTXO 交易构建逻辑的参考实现，前端已实现完整功能。

#### 核心数据结构

- **Account**：账户信息（账户 ID、钱包、担保组织、密钥对）
- **Wallet**：钱包数据（子地址映射、交易凭证、余额统计）
- **Transaction**：交易结构（UTXO 输入、交易输出、签名、手续费）
- **BuildTXInfo**：交易构建参数（转账金额、账单、找零地址）

#### 核心模块

| 模块 | 功能 |
|------|------|
| `NewAccount.go` | 创建账户，生成密钥对 |
| `GetAddressMsg.go` | 查询地址信息（RPC） |
| `JoinGroup.go` | 加入担保组织（RPC） |
| `SendTX.go` | 构建和发送交易 |
| `Transaction.go` | 交易结构定义 |
| `core.go` | 签名、序列化工具 |

#### 交易类型

| TXType | 说明 |
|--------|------|
| 0 | 普通交易（担保组织内部） |
| 6 | 跨链交易（跨组织/跨链） |
| 8 | 散户转账（未加入担保组织） |
| -1 | 质押交易 |

---

## 📱 业务流程

```
欢迎页 → 创建/登录账户 → 加入担保组织 → 钱包主页（资产管理/转账）
```

1. **创建账户**：生成 ECDSA P-256 密钥对，计算账户 ID 和地址
2. **加入担保组织**：搜索并申请加入担保组织（可选）
3. **查询余额**：通过 RPC 查询地址 UTXO 和余额
4. **发起转账**：构建交易，选择 UTXO 输入，设置找零地址
5. **签名发送**：使用私钥签名交易，广播到网络

---

## 🧪 测试数据

用于开发测试的地址和密钥信息：

**测试地址 1**
```
地址: 299954ff8bbd78eda3a686abcf86732cd18533af
担保组织: 10000000
公钥: 2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566
     &c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80
```

**测试地址 2**
```
地址: d76ec4020140d58c35e999a730bea07bf74a7763
担保组织: None
公钥: 11970dd5a7c3f6a131e24e8f066416941d79a177579c63d889ef9ce90ffd9ca8
     &037d81e8fb19883cc9e5ed8ebcc2b75e1696880c75a864099bec10a5821f69e0
```

**测试私钥**
```
私钥: 963f75db05b159d60bb1b554bed2c204dd66e0033dc95fe19d77c4745980ff03
对应地址: b0b43b638f4bcc0fb941fca7e7b26d15612eb64d
```

---

## 📝 更新日志

### 2025年1月 - CSS 架构现代化

- ✅ **CSS 导入迁移**：从 HTML `<link>` 标签迁移到 JS 导入，由 Vite 统一打包
- ✅ **main-v2.css 模块化**：4500 行拆分为 21 个独立模块文件
- ✅ **统一入口**：`css/index.css` 作为 CSS 入口，`js/app.js` 导入
- ✅ **自动优化**：Vite 自动合并、压缩、tree-shaking、HMR 热更新

### 2025年1月 - HTML 模块化重构

- ✅ **模板系统**：12 个页面拆分为独立 HTML 文件，动态按需加载
- ✅ **性能提升**：index.html 减少 83%，首屏加载时间减少 80%
- ✅ **模板加载器**：智能缓存、预加载、生命周期管理
- ✅ **页面管理器**：状态管理（idle/loading/loaded/error）

### 2025年1月 - TypeScript 迁移与工程化

- ✅ **TypeScript 支持**：引入 TypeScript 5.9，JS/TS 混合开发
- ✅ **Vite 构建工具**：快速热更新，esbuild 压缩
- ✅ **类型安全**：核心模块转换为 TypeScript，完整类型定义
- ✅ **开发体验**：类型检查、代码补全、错误提示

### 2025年1月 - 安全与性能优化

- ✅ **国际化系统**：中英文双语，260+ 翻译键
- ✅ **私钥加密**：AES-256-GCM + PBKDF2（100,000 次迭代）
- ✅ **安全防护**：XSS/CSRF 防护、输入验证
- ✅ **可访问性**：WCAG 2.1 AA 标准，ARIA 支持
- ✅ **性能优化**：RAF 批量更新、Service Worker 离线缓存
- ✅ **UI 重构**：Glassmorphism 设计，深色模式

---

## � 相关文档n

- [优化报告](IMPROVEMENT_REPORT.md) - 详细的代码优化记录
- [模块化方案](docs/INDEX_HTML_MODULARIZATION_PLAN.md) - HTML 模块化重构方案
- [飞书文档](https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc) - 项目设计文档

---

## 📜 License

MIT License © 2024
