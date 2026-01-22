# 02. 前端架构与数据流（路由 / 模板 / 状态 / Services）

本章回答两个问题：
1) 项目整体架构是什么样？（模块如何协作）  
2) 一次“用户点击发送 → 交易构造 → 提交 → 状态回写 UI”的数据流怎么走？

---

## 1. 总体分层（建议的心智模型）

可以把项目粗略理解为 4 层：

1) **UI/模板层**：`assets/templates/pages/*.html` + `js/ui/*`  
2) **页面控制层**：`js/pages/*`（各页面 init/事件绑定/状态驱动）  
3) **业务服务层**：`js/services/*`（钱包、转账、组织、账户同步、API 封装）  
4) **基础设施/工具层**：`js/utils/*`、`js/config/*`、`js/core/*`

其中：页面层尽量不直接拼 HTTP，统一调用 services；加密/签名/序列化等都在 utils 层封装。

---

## 2. 入口与初始化

- HTML 入口：`index.html`
  - 运行时配置：`<script src="/runtime-config.js"></script>` → `assets/runtime-config.js`
  - 应用入口：`<script type="module" src="/js/app.js"></script>`
- JS 入口：`js/app.js`
  - 初始化命名空间：`window.PanguPay`
  - 初始化全局事件委托：`js/core/eventDelegate.ts`
  - 初始化路由：`js/router.ts`
  - 初始化模板系统：`js/utils/pageManager.ts` + `js/utils/templateLoader.ts`

---

## 3. 路由与页面系统（Hash Router + 动态模板加载）

### 3.1 页面注册

- 页面配置集中在：`js/config/pageTemplates.ts`
  - `id`：页面标识（与路由映射一致）
  - `containerId`：DOM 容器 id
  - `templatePath`：模板路径（运行时从 `/templates/pages/...` 加载；源文件在 `assets/templates/pages/...`）

### 3.2 路由分发

- 路由实现：`js/router.ts`
  - 监听 `hashchange`
  - 将 `/#/xxx` 映射到 pageId
  - 通过 `pageManager.ensureLoaded(pageId)` 确保模板已加载到 DOM
  - 懒加载页面模块（`import('./pages/xxx')`）并调用页面 init 方法

### 3.3 动态模板加载

- `js/utils/pageManager.ts` 负责：
  - 注册页面配置
  - `ensureLoaded()`：首次进入时 fetch 对应 HTML 模板并插入主容器
  - `showPage()`：隐藏其它页面并显示当前页面
- `js/utils/templateLoader.ts` 负责：
  - 从 `/templates/pages/*.html` 拉取模板
  - 执行 i18n 文本填充（`data-i18n`）

---

## 4. 状态管理与持久化

### 4.1 Store（轻量全局状态）

- 全局 Store：`js/utils/store.js`
  - 保存：`user / currentRoute / language / theme / isLoading / transfer` 等
  - 支持：`subscribe()`、`subscribeToSelector()`

### 4.2 用户数据持久化（localStorage）

- 用户与钱包数据：`js/utils/storage.ts`
  - 按账号隔离存储（不同 userId 对应不同 key）
  - 重要约束：**TXCer 不持久化**（刷新后清空，依赖 SSE/轮询重新下发）

### 4.3 事件监听清理

页面切换会触发清理，避免重复绑定导致的“点击一次触发多次”：
- `js/utils/eventUtils.js`：`globalEventManager`、`cleanupPageListeners()`

---

## 5. 关键业务数据流

### 5.1 “构造并提交一笔交易”的链路

1. 用户在 `/#/main` 选择 From 地址、填写 To 收款人、选择模式  
2. 点击 `#tfSendBtn` → `js/services/transfer.ts#initTransferSubmit`
3. `transfer.ts` 做校验与 UI 保护：
   - 参数校验：`js/utils/security.ts`
   - 快照/回滚：`js/utils/transaction.ts`
   - UTXO/TXCer 锁：`js/utils/utxoLock.ts`、`js/services/txCerLockManager.ts`
4. 构造交易对象：
   - `js/services/txBuilder.ts`（UTXO 选择、TXInputs/TXOutputs、TXID、签名）
5. 序列化与提交：
   - 对接细节见 `docs/04-api-integration.md`
6. 状态回写：
   - 组织用户：`js/services/accountPolling.ts`（SSE / 轮询）更新 UTXO/TXCer 与交易状态
   - 交易历史：`js/services/txHistory.ts` 记录与更新

### 5.2 “组织用户余额实时更新”的链路

1. 进入 `/#/main` 后会尝试启动账户同步：`js/services/accountPolling.ts#startAccountPolling`
2. 先执行一次轮询以消耗离线队列，然后建立 SSE：
   - SSE：`/api/v1/{groupID}/assign/account-update-stream?userID=...`
3. 收到事件后更新本地钱包结构，并触发 UI 重渲染：
   - `renderWallet()`、`refreshSrcAddrList()`、`updateWalletBrief()`（见 `js/services/wallet.ts`）

---

## 6. 加密与签名（前端安全边界）

### 6.1 私钥加密存储

- 加密实现：`js/utils/keyEncryption.ts`
- UI 解锁交互：`js/utils/keyEncryptionUI.ts`
- 典型流程：创建/导入 → 设置密码 → 本地加密存储；签名时弹窗解锁，明文私钥仅在内存短暂存在

### 6.2 结构体签名与序列化对齐

这是最容易踩坑的部分，详细规则放在 `docs/04-api-integration.md`：
- 排除字段必须置零值（不能删除）
- 只对 map 字段排序，不能全局排序
- X/Y/R/S/D 必须以 JSON number 字面量形式出现（不能带引号）

实现位置：`js/utils/signature.ts`

