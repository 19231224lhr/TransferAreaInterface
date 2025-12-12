# PanguPay

盘古系统转账区 - 基于 UTXO 模型的区块链支付钱包前端界面与后端核心代码实现。

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.18+-00ADD8?style=flat-square&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 项目简介

本项目是一个完整的区块链钱包解决方案，包含：

- **前端界面**：基于原生 HTML/CSS/JavaScript + TypeScript 的现代化钱包 UI
- **后端核心**：Go 语言实现的 UTXO 交易构建与签名逻辑
- **Web 服务器**：Go 静态资源服务器 + Vite 开发服务器

更多详细信息参考飞书文档：https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc

---

## 🚀 快速开始

### 环境要求

- **Go 1.18+** (后端服务器)
- **Node.js 18+** (前端开发环境，可选)
- 现代浏览器 (Chrome/Firefox/Edge/Safari)

### 启动方式

**本项目已采用现代化前端架构（Vite + TypeScript），必须使用 Vite 开发服务器启动。**

```bash
# 1. 克隆项目
git clone https://github.com/19231224lhr/TransferAreaInterface.git
cd TransferAreaInterface

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 打开浏览器访问: http://localhost:3000/
```

### 前端命令一览

```bash
npm run dev       # 启动 Vite 开发服务器 (热更新、TypeScript 支持)
npm run build     # 构建生产版本到 dist/ 目录
npm run preview   # 预览构建结果
npm run typecheck # 运行 TypeScript 类型检查
```

### 生产部署

```bash
# 构建生产版本
npm run build

# 部署 dist/ 目录到静态服务器
# 例如: Nginx, Apache, Vercel, Netlify 等
```

> **⚠️ 重要提示**：
> - 前端使用 ES Module 和 TypeScript，**需要构建工具支持**
> - 不支持直接通过 Go 服务器访问源文件
> - 开发环境请使用 `npm run dev`
> - 生产环境请部署 `npm run build` 构建后的 `dist/` 目录

---

## 🏗️ 项目架构

```
TransferAreaInterface/
├── index.html                 # 主页面入口
├── sw.js                      # Service Worker (离线支持)
├── package.json               # npm 配置
├── vite.config.js             # Vite 构建配置
├── tsconfig.json              # TypeScript 配置
├── jsconfig.json              # JavaScript 类型检查配置
├── IMPROVEMENT_REPORT.md      # 优化报告文档
├── .gitignore                 # Git 忽略配置
├── css/                       # 模块化样式文件
│   ├── base.css              # 基础样式与 CSS 变量
│   ├── animations.css        # 动画效果
│   ├── components.css        # 通用组件样式
│   ├── p2-improvements.css   # P2 优化样式（A11y、Loading、表单验证等）
│   ├── header.css            # 顶部导航栏
│   ├── welcome.css           # 欢迎页样式
│   ├── wallet.css            # 钱包主页样式
│   ├── transaction.css       # 转账表单样式
│   ├── toast.css             # Toast 提示样式
│   └── ...                   # 其他页面样式
├── js/                        # 前端代码 (JS/TS 混合)
│   ├── app.js                # 应用入口
│   ├── router.js             # 路由管理
│   ├── types.js              # 类型定义 (JSDoc)
│   ├── globals.d.ts          # 全局类型声明 (TypeScript)
│   ├── config/
│   │   └── constants.ts      # 配置常量 (TypeScript)
│   ├── i18n/                 # 国际化
│   │   ├── index.js          # i18n 核心
│   │   ├── zh-CN.js          # 简体中文翻译
│   │   └── en.js             # 英文翻译
│   ├── pages/                # 页面组件
│   │   ├── welcome.js        # 欢迎页
│   │   ├── login.js          # 登录页
│   │   ├── newUser.js        # 注册页
│   │   ├── main.js           # 钱包主页
│   │   ├── history.js        # 历史记录
│   │   └── ...               # 其他页面
│   ├── services/             # 业务逻辑服务
│   │   ├── account.ts        # 账户服务 (TypeScript)
│   │   ├── transaction.ts    # 交易服务 (TypeScript)
│   │   ├── transfer.ts       # 转账服务 (TypeScript)
│   │   ├── wallet.js         # 钱包服务
│   │   └── ...
│   ├── ui/                   # UI 组件
│   │   ├── header.js         # 头部组件
│   │   ├── footer.js         # 底部组件
│   │   ├── modal.js          # 模态框
│   │   ├── toast.js          # Toast 提示
│   │   ├── charts.js         # 图表组件
│   │   └── ...
│   └── utils/                # 工具函数
│       ├── crypto.ts         # 加密工具 (TypeScript)
│       ├── keyEncryption.ts  # 密钥加密 (TypeScript)
│       ├── security.ts       # 安全验证 (TypeScript)
│       ├── storage.ts        # 存储管理 (TypeScript)
│       ├── accessibility.ts  # A11y 工具 (TypeScript)
│       ├── loading.ts        # 加载管理 (TypeScript)
│       ├── formValidator.ts  # 表单验证 (TypeScript)
│       ├── transaction.ts    # 事务操作 (TypeScript)
│       ├── enhancedRouter.ts # 增强路由 (TypeScript)
│       ├── serviceWorker.ts  # Service Worker 管理 (TypeScript)
│       ├── lazyLoader.ts     # 懒加载 (TypeScript)
│       ├── store.js          # 状态管理
│       └── ...
├── backend/                   # Go 后端代码 (交易构建逻辑)
│   ├── Account.go            # 账户与钱包结构体
│   ├── NewAccount.go         # 创建新账户
│   ├── GetAddressMsg.go      # 查询地址信息
│   ├── JoinGroup.go          # 加入担保组织
│   ├── SendTX.go             # 构建与发送交易
│   ├── Transaction.go        # 交易结构体定义
│   ├── UTXO.go               # UTXO 数据结构
│   ├── core/                 # 核心工具包
│   │   ├── keyformat.go      # 密钥格式转换
│   │   └── util.go           # 通用工具
│   └── cmd/
│       └── webserver/
│           └── main.go       # Web 服务器 (仅用于测试)
├── assets/                    # 静态资源
│   └── logo.png
├── dist/                      # 构建输出 (npm run build)
├── node_modules/              # npm 依赖
└── tests/                     # 测试文件
```

### 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | Vanilla JS + TypeScript | - | 无框架，原生开发，渐进式 TS 迁移 |
| 构建工具 | Vite | 5.4.21 | 快速热更新，ES Module 支持 |
| 类型系统 | TypeScript | 5.9.3 | 严格类型检查，JS/TS 混合 |
| 样式 | CSS3 | - | 模块化 CSS，支持深色模式 |
| 后端 | Go | 1.18+ | UTXO 交易逻辑（仅用于参考） |
| 国际化 | 自研 i18n | - | 支持中英文，260+ 翻译键 |
| 离线支持 | Service Worker | - | PWA 支持，离线缓存 |

---

## 💻 前端架构

### UI 设计风格

前端采用现代化的 **Glassmorphism (玻璃拟态)** 设计风格：

- **渐变配色**：主色调为天蓝色 `#0ea5e9` 与紫色 `#8b5cf6` 的渐变
- **毛玻璃效果**：使用 `backdrop-filter: blur()` 实现半透明模糊背景
- **柔和阴影**：多层阴影营造悬浮卡片效果
- **流畅动画**：贝塞尔曲线过渡与入场动画
- **深色模式**：支持浅色/深色主题切换

### 核心页面与路由

| 路由 | 页面 | 功能描述 |
|------|------|----------|
| `#/` | 欢迎页 | 首页展示与功能入口 |
| `#/login` | 登录页 | 私钥登录已有账户 |
| `#/new-user` | 注册页 | 生成新账户与密钥对 |
| `#/entry` | 入口页 | 钱包地址管理与导入 |
| `#/import` | 导入页 | 通过私钥导入子地址 |
| `#/join-group` | 担保组织 | 搜索并加入担保组织 |
| `#/inquiry-main` | 确认页 | 账户与担保组织信息确认 |
| `#/main` | 钱包主页 | 资产概览与转账功能 |
| `#/history` | 历史记录 | 交易历史查询 |
| `#/group-detail` | 组织详情 | 担保组织信息展示 |
| `#/profile` | 个人信息 | 账户设置、语言切换、主题切换 |

### 核心功能特性

#### 🌐 国际化 (i18n)

完整的双语国际化系统，支持简体中文（zh-CN）和英语（en）：

- **260+ 翻译键**：覆盖所有页面、组件和交互元素
- **核心函数**：`t(key, params)` 翻译函数，支持参数替换
- **HTML 属性**：`data-i18n`、`data-i18n-placeholder`、`data-i18n-title`
- **持久化**：语言偏好存储在 localStorage (`appLanguage`)
- **自动更新**：路由切换时自动更新所有翻译元素
- **语言选择器**：个人信息页面提供 🇨🇳 简体中文 / 🇺🇸 English 切换

#### 🔐 安全特性

- **私钥加密存储**：使用 Web Crypto API 的 AES-256-GCM 加密
- **PBKDF2 密钥派生**：100,000 次迭代，抗暴力破解
- **XSS 防护**：输入转义、DOM 安全创建
- **CSRF 防护**：安全请求封装、Token 验证
- **输入验证**：地址、私钥、金额等统一验证

#### ♿ 可访问性 (A11y)

- **ARIA 支持**：完整的 ARIA 标签和角色
- **键盘导航**：支持 Tab、Enter、Escape 等快捷键
- **屏幕阅读器**：实时播报重要操作
- **跳过链接**：快速导航到主要内容
- **焦点管理**：模态框焦点陷阱、自动聚焦
- **颜色对比**：符合 WCAG 2.1 AA 标准

#### 🚀 性能优化

- **代码分割**：懒加载页面模块，减少首屏加载时间
- **Service Worker**：静态资源缓存，支持离线访问
- **RAF 批量更新**：减少 DOM 重排，提升渲染性能
- **事件管理**：防抖节流、事件委托、自动清理
- **内存优化**：页面切换时清理监听器和定时器

#### 📦 状态管理

- **响应式 Store**：集中管理全局状态（用户、路由、主题、语言）
- **订阅机制**：状态变化自动通知订阅者
- **持久化**：关键状态自动保存到 localStorage
- **选择器模式**：`selectUser`、`selectTheme` 等选择器函数

#### 🎨 组件化开发

- **模块化 CSS**：按功能拆分样式文件，易于维护
- **可复用组件**：Toast、Modal、Loading、Charts 等
- **事件系统**：统一的事件管理和清理机制
- **表单验证**：声明式验证规则，实时反馈

#### 1. 密钥生成与管理

使用 **WebCrypto API** 在浏览器端生成 ECDSA P-256 密钥对：

```javascript
// 生成密钥对
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

// 导出为 JWK 格式
const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
```

**账户 ID 生成算法**：
- 输入：私钥 D 的十六进制字符串
- 处理：`CRC32(IEEE)` 校验和
- 输出：映射为 8 位数字 (10000000 - 99999999)

**地址生成算法**：
- 输入：未压缩公钥 `0x04 || X || Y`
- 处理：`SHA-256` 哈希
- 输出：取前 20 字节的十六进制字符串 (40 位)

#### 2. 本地存储结构

使用 `localStorage` 存储账户信息，键名为 `walletAccount`：

```javascript
{
  accountId: "12345678",           // 8 位账户 ID
  address: "5bd548d76dcb...",      // 主地址
  orgNumber: "10000000",           // 担保组织 ID
  keys: {
    privHex: "...",                // 私钥 (十六进制)
    pubXHex: "...",                // 公钥 X 坐标
    pubYHex: "..."                 // 公钥 Y 坐标
  },
  wallet: {
    addressMsg: {                  // 子地址映射
      "address1": {
        type: 0,                   // 币种: 0=PGC, 1=BTC, 2=ETH
        value: { totalValue, utxoValue, txCerValue },
        utxos: { ... },
        estInterest: 0
      }
    },
    totalValue: 1000,              // 总资产
    valueDivision: { 0: 800, 1: 150, 2: 50 },
    history: [...]                 // 余额历史记录
  }
}
```

#### 3. Toast 提示系统

自定义 Toast 组件，支持四种类型：

```javascript
showToast(message, type, title, duration);
// type: 'info' | 'success' | 'warning' | 'error'

// 便捷方法
showSuccessToast('操作成功');
showErrorToast('操作失败');
showWarningToast('请注意');
showInfoToast('提示信息');
```

---

## 🔧 后端架构

> **注意**：后端 Go 代码仅作为 UTXO 交易构建逻辑的参考实现，不是必需的运行组件。前端钱包已实现完整的密钥管理和交易构建功能。

### 核心数据结构

后端 Go 代码展示了区块链钱包的核心数据模型，前端 TypeScript/JavaScript 代码与之保持一致：

#### Account (账户)

```go
type Account struct {
    AccountID         string           // 用户唯一标识 (8 位数字)
    Wallet            Wallet           // 钱包信息
    GuarantorGroupID  string           // 担保组织 ID
    GuarGroupBootMsg  GuarGroupTable   // 担保组织通信信息
    AccountPublicKey  ecdsa.PublicKey  // 账户公钥
    AccountPrivateKey ecdsa.PrivateKey // 账户私钥
}
```

#### Wallet (钱包)

```go
type Wallet struct {
    AddressMsg    map[string]AddressData   // 子地址映射
    TotalTXCers   map[string]TxCertificate // 交易凭证
    TotalValue    float64                  // 总余额 (汇率转换后)
    ValueDivision map[int]float64          // 按币种分类余额
    UpdateTime    uint64                   // 更新时间
    UpdateBlock   int                      // 更新区块高度
}
```

#### Transaction (交易)

```go
type Transaction struct {
    TXID           string              // 交易 ID (SHA-256 哈希)
    Size           int                 // 交易大小 (字节)
    Version        float32             // 版本号
    GuarantorGroup string              // 担保组织 ID
    TXType         int                 // 交易类型
    Value          float64             // 总转账金额
    ValueDivision  map[int]float64     // 分币种金额
    InterestAssign InterestAssign      // 手续费分配
    UserSignature  EcdsaSignature      // 用户签名
    TXInputsNormal []TXInputNormal     // UTXO 输入
    TXOutputs      []TXOutput          // 交易输出
    Data           []byte              // 额外数据 (跨链用)
}
```

#### BuildTXInfo (交易构建参数)

```go
type BuildTXInfo struct {
    Value            float64            // 转账总金额
    ValueDivision    map[int]float64    // 按币种分配
    Bill             map[string]BillMsg // 转账账单
    UserAddress      []string           // 来源地址列表
    PriUseTXCer      bool               // 是否优先使用交易凭证
    ChangeAddress    map[int]string     // 找零地址 (按币种)
    IsPledgeTX       bool               // 是否质押交易
    HowMuchPayForGas float64            // 额外 Gas 支付
    IsCrossChainTX   bool               // 是否跨链交易
    Data             []byte             // 跨链数据
    InterestAssign   InterestAssign     // 手续费分配
}
```

### 核心功能模块

| 文件 | 功能 | 主要方法 |
|------|------|----------|
| `NewAccount.go` | 创建账户 | `NewUser()` |
| `GetAddressMsg.go` | 查询地址 | `GetAddressMsg()`, `ReceiveAddressMsg()` |
| `JoinGroup.go` | 加入组织 | `JoinGuarGroup()`, `ReceiveJoinReply()` |
| `SendTX.go` | 发送交易 | `BuildNewTX()`, `SendTX()` |
| `Transaction.go` | 交易结构 | `GetTXHash()`, `GetTXID()`, `GetTXSize()` |
| `Account.go` | 账户管理 | `NewSubAddress()`, `GenerateAddress()` |
| `core.go` | 工具函数 | `SignStruct()`, `SerializeStruct()` |

### 交易类型说明

| TXType | 类型 | 说明 |
|--------|------|------|
| 0 | 普通交易 | 担保组织内部转账 |
| 6 | 跨链交易 | 跨担保组织/跨链转账 |
| 8 | 散户转账 | 未加入担保组织的转账 |
| -1 | 质押交易 | 资产质押操作 |

---

## 📱 功能流程

### 完整业务流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   欢迎页    │ ─→ │ 创建/登录   │ ─→ │ 加入担保组织 │ ─→ │  钱包主页   │
│  Welcome    │    │ New/Login   │    │ Join Group  │    │   Wallet    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                  │                  │
                          ▼                  ▼                  ▼
                   生成/导入密钥对      RPC 申请加入       资产查看/转账
```

### 第一步：新建用户

调用 `NewAccount.go` 的 `NewUser()` 方法：

```go
account, err := NewUser()
// 返回包含密钥对和默认子地址的 Account 结构体
```

### 第二步：加入担保组织

调用 `JoinGroup.go` 的相关方法：

```go
// 发起加入申请
err := account.JoinGuarGroup()

// 处理 RPC 返回
err = account.ReceiveJoinReply(msg)
```

### 第三步：查询地址信息

调用 `GetAddressMsg.go` 的相关方法：

```go
// 发起查询请求
account.GetAddressMsg()

// 处理 RPC 返回
account.ReceiveAddressMsg(msg)
```

### 第四步：发送交易

调用 `SendTX.go` 的相关方法：

```go
// 构建交易
tx, err := account.BuildNewTX(buildTXInfo)

// 发送交易
err = account.SendTX(tx)
```

---

## 🧪 测试数据

可用于测试的地址和公钥信息：

**测试地址 1**
- ToAddress: `299954ff8bbd78eda3a686abcf86732cd18533af`
- ToGroup: `10000000`
- ToPubKey: `2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566&c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80`

**测试地址 2**
- ToAddress: `d76ec4020140d58c35e999a730bea07bf74a7763`
- ToGroup: `None`
- ToPubKey: `11970dd5a7c3f6a131e24e8f066416941d79a177579c63d889ef9ce90ffd9ca8&037d81e8fb19883cc9e5ed8ebcc2b75e1696880c75a864099bec10a5821f69e0`

- 测试私钥：
`963f75db05b159d60bb1b554bed2c204dd66e0033dc95fe19d77c4745980ff03`
- 对应地址：
`b0b43b638f4bcc0fb941fca7e7b26d15612eb64d`

---

## 🛡️ 安全特性

本项目实现了完整的安全防护措施：

1. **私钥加密存储**：使用 AES-256-GCM 加密，PBKDF2 密钥派生（100,000 次迭代）
2. **Web Crypto API**：浏览器原生加密，密钥不可导出
3. **XSS 防护**：所有用户输入经过转义和验证
4. **CSRF 防护**：安全请求封装，自动添加 Token
5. **输入验证**：统一的表单验证器，实时反馈
6. **HTTPS 部署**：生产环境必须使用 HTTPS
7. **Content Security Policy**：防止注入攻击
8. **密码迁移**：自动检测并迁移明文私钥到加密存储

---

## 📝 更新日志

### 2025年1月 - P2 中优先级优化

- ✅ **可访问性 (A11y)**：ARIA 标签、键盘导航、屏幕阅读器支持、跳过链接
- ✅ **Loading 状态管理**：引用计数加载器、骨架屏、进度条、元素级加载
- ✅ **路由守卫**：认证检查、路由过渡动画、预加载、滚动管理
- ✅ **错误恢复**：事务操作、检查点回滚、自动保存、表单草稿
- ✅ **代码分割**：动态导入、懒加载、预加载策略、资源预取
- ✅ **表单验证**：统一验证器、内置规则、实时反馈、A11y 集成
- ✅ **Service Worker**：离线缓存、更新检测、在线状态监控

### 2025年1月 - TypeScript 迁移与工程化

- ✅ **TypeScript 支持**：引入 TypeScript 5.9，支持 JS/TS 混合开发
- ✅ **Vite 构建工具**：引入 Vite 5.4，提供快速热更新和构建
- ✅ **类型安全**：关键模块已转换为 TypeScript，提供完整类型定义
- ✅ **开发体验**：类型检查、代码补全、错误提示
- ✅ **构建优化**：esbuild 压缩，sourcemap 支持

### 2025年1月 - P0/P1 安全与性能优化

- ✅ **国际化系统**：完整的中英文双语支持，260+ 翻译键，覆盖所有页面和组件
- ✅ **私钥加密存储**：使用 Web Crypto API 实现 AES-256-GCM 加密
- ✅ **安全防护**：XSS 防护、CSRF 防护、输入验证、安全请求封装
- ✅ **状态管理**：响应式 Store 类，支持订阅和持久化
- ✅ **性能优化**：RAF 批量更新、内存泄漏修复、事件管理优化
- ✅ **完整的钱包转账表单**：来源地址选择、账单网格、按币种找零、交易选项与实时校验
- ✅ **自定义币种下拉组件**：统一风格，支持 PGC/BTC/ETH Logo
- ✅ **担保组织交互完善**：注册/导入/入口统一跳转流程，实时同步组织信息
- ✅ **现代化 UI 重构**：欢迎页、登录页、注册页、钱包主页全新设计
- ✅ **Toast 提示系统**：四种类型提示，支持自动消失与手动关闭
- ✅ **本地存储模块**：完整的 Account/Wallet/AddressData 结构镜像
- ✅ **余额历史图表**：支持 PGC/BTC/ETH 切换与入场动画

---

## 📚 文档

- [优化报告 (IMPROVEMENT_REPORT.md)](IMPROVEMENT_REPORT.md) - 详细的代码优化记录
- [飞书文档](https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc) - 项目设计文档

---

## 📄 完整示例

```go
package main

import "fmt"

func main() {
    fmt.Println("开始运行示例程序...")
    
    // 第一步：新建用户
    account, err := NewUser()
    if err != nil {
        panic(err)
    }
    fmt.Println("Account ID:", account.AccountID)

    // 第二步：申请加入担保组织
    err = account.JoinGuarGroup()
    if err != nil {
        panic(err)
    }
    
    // 模拟 RPC 返回
    msg := UserFlowMsgReply{
        Result:       true,
        GroupID:      "10000000",
        GuarGroupMsg: GuarGroupTable{},
        BlockHeight:  1,
    }
    account.ReceiveJoinReply(msg)

    // 第三步：查询钱包地址信息
    account.GetAddressMsg()
    
    // 获取默认地址
    var addr string
    for a := range account.Wallet.AddressMsg {
        addr = a
        break
    }
    
    // 模拟 RPC 返回 UTXO 数据
    demoOutput := TXOutput{
        ToAddress:     addr,
        ToValue:       100,
        ToGuarGroupID: account.GuarantorGroupID,
        ToPublicKey:   ConvertToPublicKeyNew(account.Wallet.AddressMsg[addr].WPublicKey, "P256"),
        Type:          0,
    }
    demoATX := SubATX{
        TXID:      "prev-demo-txid",
        TXType:    0,
        TXOutputs: []TXOutput{demoOutput},
    }
    demoUTXO := UTXOData{
        UTXO:     demoATX,
        Value:    100,
        Type:     0,
        Time:     GetTimestamp(),
        Position: TxPosition{Blocknum: 1, IndexX: 0, IndexY: 0, IndexZ: 0},
    }
    msg1 := ReturnNodeAddressMsg{
        FromGroupID: account.GuarantorGroupID,
        AddressData: map[string]PointAddressData{
            addr: {
                Value:        100,
                Type:         0,
                Interest:     0,
                GroupID:      account.GuarantorGroupID,
                PublicKeyNew: ConvertToPublicKeyNew(account.Wallet.AddressMsg[addr].WPublicKey, "P256"),
                UTXO:         map[string]UTXOData{"demo": demoUTXO},
                LastHeight:   1,
            },
        },
    }
    account.ReceiveAddressMsg(msg1)

    // 第四步：构建并发送交易
    buildTXInfo := BuildTXInfo{
        Value:         10,
        ValueDivision: map[int]float64{0: 10},
        Bill: map[string]BillMsg{
            addr: {
                MoneyType:   0,
                Value:       10,
                GuarGroupID: account.GuarantorGroupID,
                PublicKey:   account.Wallet.AddressMsg[addr].WPublicKey,
                ToInterest:  0,
            },
        },
        UserAddress:      []string{addr},
        PriUseTXCer:      false,
        ChangeAddress:    map[int]string{0: addr},
        IsPledgeTX:       false,
        HowMuchPayForGas: 0,
        IsCrossChainTX:   false,
        Data:             nil,
        InterestAssign: InterestAssign{
            Gas:    0,
            Output: 0,
            BackAssign: map[string]float64{
                addr: 1,
            },
        },
    }
    
    tx, err := account.BuildNewTX(buildTXInfo)
    if err != nil {
        panic(err)
    }
    
    err = account.SendTX(tx)
    if err != nil {
        panic(err)
    }
    
    fmt.Println("交易发送成功！TXID:", tx.TXID)
}
```

---

## 📜 License

MIT License © 2024
