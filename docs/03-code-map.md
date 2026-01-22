# 03. 代码地图（目录结构与改动入口）

本章用于“快速定位”：当你要改某个功能时，应该先打开哪些文件。

---

## 1. 顶层目录

- `index.html`：页面骨架 + `runtime-config.js` 注入 + 入口脚本 `/js/app.js`
- `assets/`
  - `assets/templates/pages/*.html`：所有页面模板（运行时以 `/templates/pages/...` 形式被加载）
  - `assets/runtime-config.js`：运行时配置（后端地址/开发开关）
- `js/`：应用核心（TS/JS 混合）
- `css/`：样式
- `tests/`：少量测试（利息、同步等）

---

## 2. 页面系统（“一个页面由什么组成”）

一页通常由三部分组成：

1) **模板**：`assets/templates/pages/<page>.html`  
2) **配置注册**：`js/config/pageTemplates.ts`（`id/containerId/templatePath`）  
3) **页面逻辑模块**：`js/pages/<page>.{ts,js}`（导出 init/处理函数）

路由分发：`js/router.ts`（hash 路由，负责模板加载 + 懒加载页面模块）

---

## 3. 核心模块索引（按业务）

### 3.1 组织（担保组织/委员会）

- 组织查询/加入/退出：`js/services/group.ts`
- 加入组织页面：`js/pages/joinGroup.ts`（含 inquiry 动画）
- 组织详情/退出：`js/pages/groupDetail.js`
- ComNode 端点发现与缓存：`js/services/comNodeEndpoint.ts`

### 3.2 钱包（地址/余额/卡片 UI）

- 钱包渲染与交互：`js/services/wallet.ts`
- 地址管理：`js/services/address.ts`
- 钱包结构体/详情弹窗：`js/ui/walletStruct.js`、`js/services/walletStruct.js`

### 3.3 转账（构造/提交/历史）

- 交易构造与提交入口：`js/services/transfer.ts`
- 交易构造细节（Inputs/Outputs/TXID/签名）：`js/services/txBuilder.ts`
- 交易历史：`js/services/txHistory.ts`、`js/pages/history.js`
- 参数校验与防注入：`js/utils/security.ts`

### 3.4 UTXO / TXCer（同步与锁）

- 账户同步（SSE + 轮询）：`js/services/accountPolling.ts`
- ComNode 查询（地址余额/UTXO/归属）：`js/services/accountQuery.ts`
- UTXO 锁：`js/utils/utxoLock.ts`
- TXCer 锁（避免竞态）：`js/services/txCerLockManager.ts`

### 3.5 胶囊地址（Capsule）

- 生成/缓存/验签解码：`js/services/capsule.ts`
- Base58Check：`js/utils/base58.ts`

---

## 4. 基础设施（跨业务）

### 4.1 API 配置与端点

- Base URL 与端点常量：`js/config/api.ts`
- HTTP 客户端封装：`js/services/api.ts`

### 4.2 签名/序列化（与 Go 后端对齐）

- 签名与 JSON 数字字面量处理：`js/utils/signature.ts`

### 4.3 i18n / 主题 / 体验增强

- i18n：`js/i18n/*`
- 主题：`js/ui/theme.js`
- 全局 Toast：`js/utils/toast.js`
- 全局 Loading：`js/utils/loading.ts`
- Service Worker：`js/utils/serviceWorker.ts`、`sw.js`

---

## 5. 常见改动任务：从哪下手

- 新增一个页面：
  1) 新增模板 `assets/templates/pages/<x>.html`
  2) 在 `js/config/pageTemplates.ts` 注册
  3) 新增 `js/pages/<x>.ts` 并在 `js/router.ts` 注册懒加载
- 新增一个后端接口：
  1) 在 `js/config/api.ts` 添加 endpoint 常量
  2) 在对应 `js/services/<domain>.ts` 封装调用（必要时开启 BigInt 解析）
- 调整签名/序列化：
  - 只改 `js/utils/signature.ts`（并确保与后端验签完全一致）
- 调整“TXCer 锁定”体验：
  - 只改 `js/services/txCerLockManager.ts` + `js/services/wallet.ts` 的展示逻辑

