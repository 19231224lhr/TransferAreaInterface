# JavaScript 文件分割重构方案

## 📋 概述

当前 `app.js` 文件已达 **8591 行**，严重影响代码维护性和开发效率。本方案将其按功能模块进行分割，保持功能不变。

---

## 🏗️ 目标架构

```
js/
├── app.js                    # 主入口文件（约 100 行）
├── config/
│   └── constants.js          # 常量配置（约 50 行）
├── i18n/
│   ├── index.js              # i18n 核心逻辑（约 150 行）
│   ├── zh-CN.js              # 中文翻译字典（约 450 行）
│   └── en.js                 # 英文翻译字典（约 450 行）
├── utils/
│   ├── crypto.js             # 加密工具函数（约 150 行）
│   ├── storage.js            # 本地存储管理（约 200 行）
│   ├── helpers.js            # 通用辅助函数（约 100 行）
│   └── toast.js              # Toast 提示系统（约 150 行）
├── services/
│   ├── account.js            # 账户服务（约 300 行）
│   ├── wallet.js             # 钱包服务（约 400 行）
│   └── transaction.js        # 交易服务（约 600 行）
├── ui/
│   ├── header.js             # 头部用户栏（约 400 行）
│   ├── modal.js              # 模态框系统（约 300 行）
│   ├── profile.js            # 个人资料页（约 400 行）
│   └── charts.js             # 图表渲染（约 300 行）
├── pages/
│   ├── welcome.js            # 欢迎页（约 150 行）
│   ├── entry.js              # 入口页（约 200 行）
│   ├── login.js              # 登录页（约 350 行）
│   ├── newUser.js            # 新建账户页（约 300 行）
│   ├── import.js             # 导入钱包页（约 300 行）
│   ├── main.js               # 主钱包页（约 800 行）
│   ├── joinGroup.js          # 加入担保组织页（约 400 行）
│   └── groupDetail.js        # 组织详情页（约 200 行）
└── router.js                 # 路由系统（约 200 行）
```

---

## 📦 模块详细设计

### 1. 配置与常量 (`js/config/constants.js`)

**行数范围**: 原文件 1241-1252 行

```javascript
// js/config/constants.js
export const STORAGE_KEY = 'walletAccount';
export const I18N_STORAGE_KEY = 'appLanguage';
export const THEME_STORAGE_KEY = 'appTheme';
export const PROFILE_STORAGE_KEY = 'userProfile';

export const DEFAULT_GROUP = { 
  groupID: '10000000', 
  aggreNode: '39012088', 
  assignNode: '17770032', 
  pledgeAddress: '5bd548d76dcb3f9db1d213db01464406bef5dd09' 
};

export const GROUP_LIST = [DEFAULT_GROUP];
export const BASE_LIFT = 20;

// 币种类型
export const COIN_TYPES = {
  PGC: 0,
  BTC: 1,
  ETH: 2
};

// 汇率配置
export const EXCHANGE_RATES = {
  PGC_TO_USDT: 1,
  BTC_TO_USDT: 100,
  ETH_TO_USDT: 10
};
```

---

### 2. 国际化系统 (`js/i18n/`)

#### 2.1 中文翻译 (`js/i18n/zh-CN.js`)
**行数范围**: 原文件 46-452 行

```javascript
// js/i18n/zh-CN.js
export default {
  // 通用
  'common.cancel': '取消',
  'common.save': '保存',
  'common.back': '返回',
  // ... 约 400+ 翻译键
};
```

#### 2.2 英文翻译 (`js/i18n/en.js`)
**行数范围**: 原文件 453-859 行

```javascript
// js/i18n/en.js
export default {
  // Common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.back': 'Back',
  // ... 约 400+ 翻译键
};
```

#### 2.3 i18n 核心逻辑 (`js/i18n/index.js`)
**行数范围**: 原文件 860-1010 行

```javascript
// js/i18n/index.js
import zhCN from './zh-CN.js';
import en from './en.js';
import { I18N_STORAGE_KEY } from '../config/constants.js';

const translations = { 'zh-CN': zhCN, 'en': en };
let currentLanguage = 'zh-CN';

export function getCurrentLanguage() { /* ... */ }
export function setLanguage(lang) { /* ... */ }
export function t(key, params = {}) { /* ... */ }
export function updatePageTranslations() { /* ... */ }
export function loadLanguageSetting() { /* ... */ }
export function saveLanguageSetting(lang) { /* ... */ }
```

---

### 3. 工具函数 (`js/utils/`)

#### 3.1 加密工具 (`js/utils/crypto.js`)
**行数范围**: 原文件 1218-1295 行

```javascript
// js/utils/crypto.js

// Base64 编解码
export const base64urlToBytes = (b64url) => { /* ... */ };
export const bytesToBase64url = (bytes) => { /* ... */ };

// Hex 转换
export const bytesToHex = (bytes) => { /* ... */ };
export const hexToBytes = (hex) => { /* ... */ };

// CRC32 实现
const crc32Table = (() => { /* ... */ })();
export const crc32 = (bytes) => { /* ... */ };
export const generate8DigitFromInputHex = (hex) => { /* ... */ };

// ECDSA 签名 (WebCrypto)
export async function ecdsaSignData(privKeyHex, data, pubXHex, pubYHex) { /* ... */ }

// SHA-256 哈希
export async function sha256(data) { /* ... */ }
```

#### 3.2 存储管理 (`js/utils/storage.js`)
**行数范围**: 原文件 1297-1500 行

```javascript
// js/utils/storage.js
import { STORAGE_KEY, PROFILE_STORAGE_KEY } from '../config/constants.js';

// 账户数据
export function loadUser() { /* ... */ }
export function saveUser(data) { /* ... */ }
export function toAccount(basic, prev) { /* ... */ }

// 用户配置
export function loadUserProfile() { /* ... */ }
export function saveUserProfile(profile) { /* ... */ }

// 担保组织
export function getJoinedGroup() { /* ... */ }
export function saveGuarChoice(choice) { /* ... */ }

// 清理函数
export function clearAccountStorage() { /* ... */ }
export function resetOrgSelectionForNewUser() { /* ... */ }
```

#### 3.3 Toast 提示 (`js/utils/toast.js`)
**行数范围**: 原文件 1100-1218 行

```javascript
// js/utils/toast.js
import { t } from '../i18n/index.js';

// Toast 容器
function getOrCreateContainer() { /* ... */ }

// 主 Toast 函数
export function showToast(message, type = 'info', title = '') { /* ... */ }
export function removeToast(toast) { /* ... */ }

// 便捷方法
export const showErrorToast = (message, title = '') => showToast(message, 'error', title);
export const showSuccessToast = (message, title = '') => showToast(message, 'success', title);
export const showWarningToast = (message, title = '') => showToast(message, 'warning', title);
export const showInfoToast = (message, title = '') => showToast(message, 'info', title);

// Mini Toast
export function showMiniToast(message, type = 'info') { /* ... */ }
```

#### 3.4 通用辅助 (`js/utils/helpers.js`)
**行数范围**: 原文件 1243-1270 行

```javascript
// js/utils/helpers.js

export const wait = (ms) => new Promise(r => setTimeout(r, ms));

export const toFiniteNumber = (val) => { /* ... */ };

export function readAddressInterest(meta) { /* ... */ }

export function normalizeAddrInput(raw) { /* ... */ }

export function isValidAddressFormat(addr) { /* ... */ }

export function formatBalance(amount, decimals = 2) { /* ... */ }

export function truncateAddress(addr, start = 6, end = 4) { /* ... */ }
```

---

### 4. 服务层 (`js/services/`)

#### 4.1 账户服务 (`js/services/account.js`)
**行数范围**: 原文件 4200-4600 行

```javascript
// js/services/account.js
import { generate8DigitFromInputHex, bytesToHex } from '../utils/crypto.js';
import { saveUser, loadUser } from '../utils/storage.js';

// 生成新密钥对 (WebCrypto P-256)
export async function generateKeyPair() { /* ... */ }

// 从私钥导入账户
export async function importFromPrivHex(privHex) { /* ... */ }

// 生成地址 (SHA-256(uncompressed_pubkey)[:20])
export async function generateAddress(pubXHex, pubYHex) { /* ... */ }

// 添加子钱包地址
export async function addNewSubWallet() { /* ... */ }
```

#### 4.2 钱包服务 (`js/services/wallet.js`)
**行数范围**: 原文件 5000-5800 行

```javascript
// js/services/wallet.js
import { loadUser, saveUser } from '../utils/storage.js';
import { COIN_TYPES } from '../config/constants.js';

// 获取钱包余额汇总
export function getWalletSummary(user) { /* ... */ }

// 更新钱包余额显示
export function updateWalletDisplay(user) { /* ... */ }

// 渲染地址列表
export function renderAddressList(container, addresses) { /* ... */ }

// 删除地址
export function deleteAddress(address) { /* ... */ }

// 清空地址余额
export function clearAddressBalance(address) { /* ... */ }

// 导出私钥
export function exportPrivateKey(address) { /* ... */ }
```

#### 4.3 交易服务 (`js/services/transaction.js`)
**行数范围**: 原文件 7800-8400 行

```javascript
// js/services/transaction.js
import { ecdsaSignData } from '../utils/crypto.js';
import { loadUser } from '../utils/storage.js';

// 构建交易结构体
export async function buildTransaction(buildTXInfo) { /* ... */ }

// 验证交易参数
export function validateBuildTXInfo(info) { /* ... */ }

// 获取 UTXO
export function selectUTXOs(addresses, targetValue, coinType) { /* ... */ }

// 计算交易哈希
export async function getTXOutputHash(output) { /* ... */ }

// 序列化交易输出
export function getTXOutputSerializedData(output) { /* ... */ }

// 查询地址信息
export async function fetchAddrInfo(address) { /* ... */ }
```

---

### 5. UI 组件 (`js/ui/`)

#### 5.1 头部用户栏 (`js/ui/header.js`)
**行数范围**: 原文件 1350-1800 行

```javascript
// js/ui/header.js
import { loadUser, loadUserProfile } from '../utils/storage.js';
import { t } from '../i18n/index.js';

// 更新头部用户信息
export function updateHeaderUser(user) { /* ... */ }

// 初始化用户菜单
export function initUserMenu() { /* ... */ }

// 更新地址下拉列表
export function updateAddressPopup(addresses) { /* ... */ }

// 更新余额显示
export function updateBalanceDisplay(balance) { /* ... */ }
```

#### 5.2 模态框系统 (`js/ui/modal.js`)
**行数范围**: 原文件 1800-2200 行

```javascript
// js/ui/modal.js
import { t } from '../i18n/index.js';

// 统一加载遮罩
export function showUnifiedLoading(text) { /* ... */ }
export function showUnifiedSuccess(title, desc, onOk, onCancel, isError) { /* ... */ }
export function hideUnifiedOverlay() { /* ... */ }

// 确认模态框
export function showConfirmModal(title, desc, okText, cancelText) { /* ... */ }

// 提示模态框
export function showModalTip(title, desc, isError) { /* ... */ }

// 详情模态框
export function showDetailModal(title, htmlContent) { /* ... */ }

// 地址管理模态框
export function initAddressModal() { /* ... */ }
```

#### 5.3 个人资料页 (`js/ui/profile.js`)
**行数范围**: 原文件 1900-2200 行

```javascript
// js/ui/profile.js
import { loadUserProfile, saveUserProfile } from '../utils/storage.js';
import { showSuccessToast, showErrorToast } from '../utils/toast.js';

// 初始化个人资料页
export function initProfilePage() { /* ... */ }

// 绑定事件
export function bindProfileEvents() { /* ... */ }

// 头像处理
export function handleAvatarFileSelect(e) { /* ... */ }
export function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) { /* ... */ }
export function updateAvatarPreview(avatarUrl) { /* ... */ }
export function handleAvatarRemove() { /* ... */ }

// 保存个人信息
export function handleProfileSave() { /* ... */ }

// 主题切换
export function initThemeSelector() { /* ... */ }

// 语言切换
export function initLanguageSelector() { /* ... */ }
```

#### 5.4 图表渲染 (`js/ui/charts.js`)
**行数范围**: 原文件 5800-6000, 8400-8591 行

```javascript
// js/ui/charts.js

// Catmull-Rom 样条插值
export function catmullRomSpline(points, tension = 0.5) { /* ... */ }

// 余额曲线图
export function updateBalanceChart(user) { /* ... */ }
export function initBalanceChart() { /* ... */ }

// 网络状态图
export function initNetworkChart() { /* ... */ }

// 钱包结构体展示
export function updateWalletStruct() { /* ... */ }
```

---

### 6. 页面模块 (`js/pages/`)

#### 6.1 欢迎页 (`js/pages/welcome.js`)
**行数范围**: 原文件 2400-2600 行

```javascript
// js/pages/welcome.js
import { loadUser } from '../utils/storage.js';
import { t } from '../i18n/index.js';

export function initWelcomePage() { /* ... */ }
export function updateWelcomeButtons() { /* ... */ }
export function bindWelcomeEvents() { /* ... */ }
```

#### 6.2 入口页 (`js/pages/entry.js`)
**行数范围**: 原文件 3400-3700 行

```javascript
// js/pages/entry.js
import { loadUser } from '../utils/storage.js';
import { t } from '../i18n/index.js';

export function initEntryPage() { /* ... */ }
export function updateWalletBrief() { /* ... */ }
export function bindEntryEvents() { /* ... */ }
```

#### 6.3 登录页 (`js/pages/login.js`)
**行数范围**: 原文件 4480-4700 行

```javascript
// js/pages/login.js
import { importFromPrivHex } from '../services/account.js';
import { saveUser } from '../utils/storage.js';
import { showErrorToast, showSuccessToast } from '../utils/toast.js';

export function initLoginPage() { /* ... */ }
export function bindLoginEvents() { /* ... */ }
export function handleLogin(privHex) { /* ... */ }
```

#### 6.4 新建账户页 (`js/pages/newUser.js`)
**行数范围**: 原文件 4100-4350 行

```javascript
// js/pages/newUser.js
import { generateKeyPair } from '../services/account.js';
import { saveUser } from '../utils/storage.js';

export function initNewUserPage() { /* ... */ }
export function bindNewUserEvents() { /* ... */ }
export function handleGenerateKeys() { /* ... */ }
```

#### 6.5 导入钱包页 (`js/pages/import.js`)
**行数范围**: 原文件 4350-4480 行

```javascript
// js/pages/import.js
import { importFromPrivHex } from '../services/account.js';
import { saveUser, loadUser, toAccount } from '../utils/storage.js';

export function initImportPage() { /* ... */ }
export function bindImportEvents() { /* ... */ }
export function handleImport(privHex, mode) { /* ... */ }
```

#### 6.6 主钱包页 (`js/pages/main.js`)
**行数范围**: 原文件 4900-7400 行

```javascript
// js/pages/main.js
import { loadUser, saveUser, getJoinedGroup } from '../utils/storage.js';
import { updateWalletDisplay, renderAddressList } from '../services/wallet.js';
import { buildTransaction } from '../services/transaction.js';
import { initBalanceChart, updateBalanceChart } from '../ui/charts.js';

export function initMainPage() { /* ... */ }
export function renderWallet() { /* ... */ }
export function bindMainPageEvents() { /* ... */ }
export function initTransferForm() { /* ... */ }
export function handleBuildTransaction() { /* ... */ }
export function refreshOrgPanel() { /* ... */ }
```

#### 6.7 加入担保组织页 (`js/pages/joinGroup.js`)
**行数范围**: 原文件 3100-3400 行

```javascript
// js/pages/joinGroup.js
import { saveUser, loadUser } from '../utils/storage.js';
import { showSuccessToast } from '../utils/toast.js';

export function initJoinGroupPage() { /* ... */ }
export function bindJoinGroupEvents() { /* ... */ }
export function handleJoinGroup(groupId) { /* ... */ }
export function handleSkipGroup() { /* ... */ }
```

#### 6.8 组织详情页 (`js/pages/groupDetail.js`)
**行数范围**: 原文件 5300-5500 行

```javascript
// js/pages/groupDetail.js
import { getJoinedGroup, saveUser, loadUser } from '../utils/storage.js';
import { t } from '../i18n/index.js';

export function initGroupDetailPage() { /* ... */ }
export function bindGroupDetailEvents() { /* ... */ }
export function handleLeaveGroup() { /* ... */ }
```

---

### 7. 路由系统 (`js/router.js`)

**行数范围**: 原文件 2900-3100 行

```javascript
// js/router.js
import { loadUser } from './utils/storage.js';
import { updatePageTranslations } from './i18n/index.js';
import { initWelcomePage } from './pages/welcome.js';
import { initEntryPage } from './pages/entry.js';
import { initLoginPage } from './pages/login.js';
import { initNewUserPage } from './pages/newUser.js';
import { initImportPage } from './pages/import.js';
import { initMainPage } from './pages/main.js';
import { initJoinGroupPage } from './pages/joinGroup.js';
import { initGroupDetailPage } from './pages/groupDetail.js';
import { initProfilePage } from './ui/profile.js';

// 页面卡片映射
const cardMap = {
  '/welcome': 'welcomeCard',
  '/entry': 'entryCard',
  '/new': 'newUserCard',
  '/login': 'loginCard',
  '/import': 'importCard',
  '/main': 'walletCard',
  '/join-group': 'joinCard',
  '/group-detail': 'groupDetailCard',
  '/profile': 'profileCard',
  '/inquiry': 'inquiryCard'
};

// 显示指定卡片
export function showCard(card) { /* ... */ }

// 路由处理
export function router() { /* ... */ }

// 路由跳转
export function routeTo(hash) { /* ... */ }

// 初始化路由
export function initRouter() {
  window.addEventListener('hashchange', router);
  router(); // 初始路由
}
```

---

### 8. 主入口文件 (`js/app.js`)

```javascript
// js/app.js - 主入口文件

// 抑制浏览器扩展错误
import './utils/errorSuppression.js';

// 初始化国际化
import { loadLanguageSetting, updatePageTranslations } from './i18n/index.js';

// 初始化路由
import { initRouter } from './router.js';

// 初始化 UI 组件
import { initUserMenu, updateHeaderUser } from './ui/header.js';
import { initNetworkChart } from './ui/charts.js';

// 工具函数
import { loadUser } from './utils/storage.js';

// 全局初始化
function init() {
  // 加载语言设置
  loadLanguageSetting();
  
  // 初始化用户菜单
  initUserMenu();
  
  // 更新头部用户信息
  const user = loadUser();
  updateHeaderUser(user);
  
  // 初始化路由
  initRouter();
  
  // 更新页面翻译
  updatePageTranslations();
  
  // 初始化网络图表
  initNetworkChart();
  
  console.log('UTXO Wallet initialized');
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

## 🔧 HTML 引入方式

### 方案 A: ES6 模块 (推荐)

```html
<!-- index.html -->
<script type="module" src="/js/app.js"></script>
```

**优点**:
- 原生支持，无需构建工具
- 自动处理依赖关系
- 现代浏览器全面支持

**注意事项**:
- 需要 HTTP 服务器（不能直接打开文件）
- 旧浏览器需要 polyfill

### 方案 B: 传统脚本标签 + IIFE

如果需要兼容旧环境，可以使用构建工具打包：

```html
<!-- index.html -->
<script src="/js/bundle.js"></script>
```

使用 **Rollup** 或 **Webpack** 打包成单文件。

---

## 📋 迁移步骤

### 阶段一：准备工作 (1-2天)
1. ✅ 创建 `js/` 目录结构
2. ✅ 备份原 `app.js` 文件
3. ✅ 创建各模块的空文件

### 阶段二：提取常量和工具 (2-3天)
1. 提取 `config/constants.js`
2. 提取 `utils/crypto.js`
3. 提取 `utils/storage.js`
4. 提取 `utils/helpers.js`
5. 提取 `utils/toast.js`

### 阶段三：提取国际化 (1-2天)
1. 提取 `i18n/zh-CN.js`
2. 提取 `i18n/en.js`
3. 提取 `i18n/index.js`

### 阶段四：提取服务层 (3-4天)
1. 提取 `services/account.js`
2. 提取 `services/wallet.js`
3. 提取 `services/transaction.js`

### 阶段五：提取 UI 组件 (3-4天)
1. 提取 `ui/header.js`
2. 提取 `ui/modal.js`
3. 提取 `ui/profile.js`
4. 提取 `ui/charts.js`

### 阶段六：提取页面模块 (4-5天)
1. 提取各页面模块
2. 提取 `router.js`
3. 创建 `app.js` 主入口

### 阶段七：测试与修复 (3-4天)
1. 功能回归测试
2. 修复模块间依赖问题
3. 性能测试

---

## ⚠️ 注意事项

### 1. 全局变量处理

原代码中有大量全局变量，需要：
- 使用 `window.xxx` 显式导出需要全局访问的函数
- 或者使用事件委托替代全局函数调用

```javascript
// 导出到全局（兼容旧代码）
window.showUtxoDetail = showUtxoDetail;
window.closeUtxoModal = closeUtxoModal;
```

### 2. 循环依赖

避免模块间循环依赖，如：
- A imports B
- B imports A

**解决方案**：提取共享代码到独立模块

### 3. 事件绑定时机

确保 DOM 元素存在后再绑定事件：
```javascript
// 使用 DOMContentLoaded 或页面初始化时绑定
document.addEventListener('DOMContentLoaded', bindEvents);
```

### 4. 异步加载优化

对于非首屏模块，可以使用动态导入：
```javascript
// 延迟加载交易模块
const { buildTransaction } = await import('./services/transaction.js');
```

---

## 📊 预期收益

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| 主文件行数 | 8591 行 | ~100 行 |
| 模块数量 | 1 个 | 20+ 个 |
| 单文件最大行数 | 8591 行 | ~800 行 |
| 代码复用性 | 低 | 高 |
| 维护难度 | 高 | 低 |
| 团队协作 | 困难 | 容易 |
| 测试覆盖 | 困难 | 容易 |

---

## 🚀 后续优化建议

1. **TypeScript 迁移**: 添加类型定义，提升代码质量
2. **单元测试**: 为各模块添加测试用例
3. **文档注释**: 使用 JSDoc 规范注释
4. **代码检查**: 配置 ESLint 规则
5. **构建优化**: 使用 Vite 或 Rollup 进行生产构建

---

方案是 90 分 的架构设计。 剩下的 10 分 在于工程化细节：

- 处理 DOM 事件绑定（别用 inline onclick）。

- 处理共享状态（不要只依赖 localStorage，考虑内存 store）。

- 引入 Vite（解决多文件加载慢的问题）。

*文档创建时间: 2025-12-09*
*适用版本: TransferAreaInterface v1.x*
