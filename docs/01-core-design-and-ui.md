# 01. 核心设计与 UI 落地（担保组织 / 委员会 / TXCer / 胶囊地址）

本章用“前端能看见/能操作的东西”为主线，把后端的核心理念映射到 UI 与代码结构上：你应该能回答——

- 担保组织/担保委员会/AssignNode/ComNode 在 UI 上分别体现在哪里？
- TXCer 是什么？用户何时会看到？为什么会出现“TXCer 锁定”？
- 快速转账/普通转账/跨链/质押在前端的入口、限制与代码路径是什么？
- 胶囊地址是什么？为什么它在 UI 上看起来像「orgId@xxxx」？

---

## 1. 角色/节点概念（前端视角）

> 这部分不是重述后端白皮书，而是说明“前端如何使用它们”。

### 1.1 BootNode / Gateway（前端的默认入口）

- 前端有一个“默认后端入口”`API_BASE_URL`（见 `js/config/api.ts`）
- 前端通过这个入口：
  - 拉取担保组织信息：`/api/v1/groups`、`/api/v1/groups/{id}`
  - 查询担保委员会（ComNode）HTTP 端点：`/api/v1/committee/endpoint`
  - 查询组织公钥（胶囊地址验签）：`/api/v1/org/publickey`（部分场景走 ComNode 的 `/api/v1/com/public-key`）

### 1.2 担保委员会（ComNode）

- 在前端的“体验”主要是：
  - 地址查询/归属查询（用于地址验证、散户相关查询）：`/api/v1/com/query-address`、`/api/v1/com/query-address-group`
  - 散户交易提交：`/api/v1/com/submit-noguargroup-tx`
- ComNode 的端口会动态变化，所以前端会先向 BootNode/Gateway 请求委员会端点并缓存：
  - 代码：`js/services/comNodeEndpoint.ts`
  - 本地缓存 key：`localStorage.comNodeEndpoint`

### 1.3 担保组织（Guarantor Organization）与 AssignNode / AggrNode

- 用户加入担保组织后，前端会走组织通道（尤其是 **SSE 实时同步**、**快速转账提交**、**TXCer 相关逻辑**）
- 组织信息包含：
  - `groupID / aggreNode / assignNode / pledgeAddress`
  - 以及可选的 `assignAPIEndpoint / aggrAPIEndpoint`（形如 `:8081` 或 `IP:PORT`）
- 代码：
  - 查询组织：`js/services/group.ts`（BootNode API）
  - 组织端点拼装：`buildAssignNodeUrl()`、`buildAggrNodeUrl()`（会做 `localhost`/`127.0.0.1` 归一化，避免浏览器跨域问题）

---

## 2. 页面与功能总览（你在 UI 上看到什么）

页面系统是 hash 路由（`/#/xxx`）。页面清单由 `js/config/pageTemplates.ts` 统一注册，对应模板在 `assets/templates/pages/`。

| 路由 | 页面用途 | 模板 | 页面逻辑 |
|---|---|---|---|
| `/#/welcome` | 欢迎页 | `assets/templates/pages/welcome.html` | `js/pages/welcome.js` |
| `/#/entry` | 钱包入口（选择账号/进入） | `assets/templates/pages/entry.html` | `js/pages/entry.ts` |
| `/#/new` | 创建账户 | `assets/templates/pages/new-user.html` | `js/pages/newUser.js` |
| `/#/set-password` | 设置/加密私钥 | `assets/templates/pages/set-password.html` | `js/pages/setPassword.ts` |
| `/#/login` | 登录（解锁） | `assets/templates/pages/login.html` | `js/pages/login.ts` |
| `/#/import` | 导入钱包/地址 | `assets/templates/pages/import.html` | `js/pages/import.ts` |
| `/#/main` | 主钱包 + 转账面板 | `assets/templates/pages/wallet.html` | `js/pages/main.js`（核心在 `js/services/wallet.ts`、`js/services/transfer.ts`） |
| `/#/join-group` | 加入担保组织 | `assets/templates/pages/join-group.html` | `js/pages/joinGroup.ts` |
| `/#/inquiry` / `/#/inquiry-main` | 网络问询动画（加入组织/进入主页面前） | `assets/templates/pages/inquiry.html` | `js/pages/joinGroup.ts`（复用动画） |
| `/#/group-detail` | 担保组织详情/查询/退出 | `assets/templates/pages/group-detail.html` | `js/pages/groupDetail.js` |
| `/#/history` | 交易历史 | `assets/templates/pages/history.html` | `js/pages/history.js` |
| `/#/docs` | 应用内文档 | `assets/templates/pages/docs.html` | `js/pages/docs.ts`（加载 `docs/site/*.md`） |
| `/#/profile` | 个人信息 | `assets/templates/pages/profile.html` | `js/ui/profile.ts` |

---

## 3. 主页面 `/#/main`：快速转账功能如何呈现

### 3.1 钱包面板（左侧）：UTXO / TXCer / 锁定状态

地址卡片在 UI 上拆分展示：
- **可用余额**：扣除“锁定的 UTXO / 锁定的 TXCer”后的可用值
- **UTXO 余额**：传统可花费 UTXO
- **TXCer 余额（待转换）**：快速转账体系里的“凭证余额”，会在链上确认后转成 UTXO
- **锁定余额**：当你构造/提交交易时，被占用的 UTXO/TXCer 会被锁定，避免重复使用

对应代码：
- UI 渲染：`js/services/wallet.ts`（地址卡片里包含 TXCer 指示器、列表与“锁定”显示）
- UTXO 锁：`js/utils/utxoLock.ts`
- TXCer 锁：`js/services/txCerLockManager.ts`
- TXCer 更新来源：`js/services/accountPolling.ts`（SSE + 轮询）

### 3.2 转账面板（右侧）：模式与限制

UI 顶部提供 3 个模式 tab（见 `assets/templates/pages/wallet.html`）：
- `quick`：快速转账（用户已加入组织时走组织快速路径；未加入组织时 UI 会显示“普通转账”并走散户路径）
- `cross`：跨链转账（只在组织能力满足时可用；前端会隐藏不需要的字段）
- `pledge`：质押交易（组织相关流程）

对应代码：
- Tab 与表单字段切换：`js/services/wallet.ts#initTransferModeTabs`
- 构造/提交入口按钮：`#tfSendBtn` → `js/services/transfer.ts#initTransferSubmit`
- 交易构造：`js/services/txBuilder.ts`

### 3.3 地址验证与“胶囊地址”

收款地址支持两类输入：
1) 普通地址（40 hex，允许 `0x` 前缀）  
2) 胶囊地址：`{orgId}@{payload}`（用于隐藏真实地址、在组织公钥下可验签解码）

对应代码：
- 胶囊地址解析/生成/验签：`js/services/capsule.ts`
- 转账输入侧对胶囊地址的识别：`js/services/transfer.ts`（会判断 `isCapsuleAddress()`）

---

## 4. TXCer：你在前端看到它的完整生命周期

### 4.1 TXCer 是什么（前端视角）

在快速转账体系里，TXCer 可以理解为：
- 一种“待结算的凭证余额”（通常只针对主币种 Type=0）
- 先出现在钱包的 TXCer 列表/余额里
- 当其前置交易上链确认后，会被后端通知并转化为 UTXO，前端再把它从 TXCer 状态迁移掉

前端存储位置（用户钱包内）：
- `user.wallet.addressMsg[addr].txCers`：`TXCerID -> value`（用于展示金额）
- `user.wallet.totalTXCers`：`TXCerID -> full TXCer object`（构造交易时需要完整结构做签名/引用）

对应代码：`js/utils/storage.ts`（注意：TXCer **不会持久化**，刷新后会清空，依赖 SSE/轮询重新下发）

### 4.2 TXCer 如何更新到 UI（SSE + 轮询）

- 组织用户会启动账户同步：`js/services/accountPolling.ts#startAccountPolling`
- 首选 SSE：`/api/v1/{groupID}/assign/account-update-stream?userID=...`
  - 事件：`account_update` / `txcer_change` / `cross_org_txcer` / `tx_status_change`
- SSE 不可用时，自动降级轮询（同文件内的 `pollAccountUpdates`、`pollTXCerChanges`、`pollCrossOrgTXCers`）

### 4.3 为什么会有“TXCer 锁定”（Race Condition 处理）

用户构造/提交使用 TXCer 的交易时，可能同时收到后端推送：
- `Status=0`（前置交易上链 → TXCer 将转为 UTXO）
- 或 `Status=1`（验证错误 → TXCer 不能使用）

如果前端“立即移除/替换”TXCer，会导致：
- 用户刚选中的 TXCer 在点击发送前突然消失
- 或构造阶段引用的 TXCer 在提交时不一致，产生签名/金额/选择异常

因此引入锁管理器（`js/services/txCerLockManager.ts`）：
- `draft` 锁：用户构造阶段短锁（默认 30 秒）
- `submitted` 锁：交易已提交后的长锁（默认 24h，防止重复使用）
- 锁定期间收到的变更会被缓存，解锁后再统一处理

---

## 5. 加入/退出担保组织：UI、签名与数据流

### 5.1 加入组织 UI（`/#/join-group`）

- 推荐组织展示 + 搜索组织
- 加入需要用**账户私钥**对 `FlowApplyRequest` 签名（浏览器会弹出解锁密码）

对应代码：
- 页面：`js/pages/joinGroup.ts`
- API 与签名：`js/services/group.ts#joinGuarGroup`
- 时间戳：使用自定义纪元（2020-01-01 起算）`js/services/group.ts#getTimestamp`

### 5.2 退出组织 UI（`/#/group-detail`）

- 退出同样需要签名（账户私钥）
- 退出时有一个非常重要的细节：`AddressMsg` 必须是空对象 `{}`（不是 `null`，也不是带数据的 map）
  - 原因：后端反序列化会填充零值字段；若前端签名对象与后端最终参与验签的 JSON 不一致，会直接导致验签失败
  - 该规则已在 `js/services/group.ts#leaveGuarGroup` 用注释明确

---

## 6. 常见“功能在哪改”的快速索引

- 想改「页面路由/新增页面」：`js/config/pageTemplates.ts`、`js/router.ts`、`assets/templates/pages/`
- 想改「组织加入/退出/查询」：`js/services/group.ts`、`js/pages/joinGroup.ts`、`js/pages/groupDetail.js`
- 想改「主页面钱包/地址卡片」：`js/services/wallet.ts`
- 想改「交易构造/提交」：`js/services/transfer.ts`、`js/services/txBuilder.ts`
- 想改「TXCer 更新/锁」：`js/services/accountPolling.ts`、`js/services/txCerLockManager.ts`
- 想改「胶囊地址」：`js/services/capsule.ts`

