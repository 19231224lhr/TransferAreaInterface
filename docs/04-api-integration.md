# 04. 后端对接（端点 / SSE / BigInt / 签名与序列化）

这章是交接里最关键的一章：**任何“签名不通过 / 金额不对 / TXID 对不上 / SSE 不更新”基本都能在这里定位到原因**。

---

## 1. 后端地址与端口（前端真实实现）

前端默认后端入口由 `js/config/api.ts` 决定：

- 若存在 `window.__API_BASE_URL__`：优先使用（一般由 `assets/runtime-config.js` 注入）
- 否则：
  - `__PANGU_DEV__ = true` → `http://localhost:3001`
  - `__PANGU_DEV__ = false` → `${window.location.hostname}:3001`

对应文件：
- `assets/runtime-config.js`
- `js/config/constants.ts`（读取 `__PANGU_DEV__`）
- `js/config/api.ts`（计算 `API_BASE_URL`）

---

## 2. 连接模型：BootNode / ComNode / AssignNode（前端如何选路）

### 2.1 BootNode/Gateway（`API_BASE_URL`）

用于“服务发现/元信息”：
- `GET /api/v1/groups`
- `GET /api/v1/groups/{id}`
- `GET /api/v1/committee/endpoint`
- `GET /api/v1/org/publickey?org_id=...`（胶囊地址验签用组织公钥）

### 2.2 ComNode（担保委员会 Leader）

ComNode 端点不是固定端口，前端会通过 BootNode 查询并缓存：
- 代码：`js/services/comNodeEndpoint.ts`
- 查询：`GET {API_BASE_URL}/api/v1/committee/endpoint`

拿到 ComNode URL 后，前端会直连 ComNode：
- `POST {comNodeURL}/api/v1/com/query-address`
- `POST {comNodeURL}/api/v1/com/query-address-group`
- `POST {comNodeURL}/api/v1/com/submit-noguargroup-tx`
- `POST {comNodeURL}/api/v1/com/capsule/generate`
- `GET  {comNodeURL}/api/v1/com/public-key`

### 2.3 AssignNode（组织通道）

组织信息里若包含 `assignAPIEndpoint`（`":8081"` 或 `"IP:PORT"`），前端会优先直连 AssignNode：
- 端点拼装：`js/services/group.ts#buildAssignNodeUrl`
- SSE：`{assignNodeUrl}/api/v1/{groupID}/assign/account-update-stream?userID=...`

否则会 fallback 走 `{API_BASE_URL}/api/v1/{groupID}/assign/...`（视后端网关是否支持代理 SSE 而定）。

---

## 3. SSE 与轮询：账户/UTXO/TXCer 如何实时更新

组织用户进入主页面后会启动同步：`js/services/accountPolling.ts#startAccountPolling`

### 3.1 SSE（首选）

连接地址：
- `GET {assignNodeUrl}/api/v1/{groupID}/assign/account-update-stream?userID=...`

事件类型（前端已监听）：
- `account_update`：UTXO in/out、区块高度、利息、确认 txid 列表等
- `txcer_change`：TXCer 状态变更（0/1/2）
- `cross_org_txcer`：跨组织 TXCer 接收
- `tx_status_change`：交易状态变化（前端会派发 `window` 事件 `pangu_tx_status`）

### 3.2 轮询（兜底 + 消耗离线队列）

即使 SSE 已连接，前端也会先做一次轮询来消耗离线队列；SSE 不可用时则周期轮询：
- 账户更新：`/api/v1/{groupID}/assign/account-update`
- TXCer 变动：`/api/v1/{groupID}/assign/txcer-change`（SSE 活跃时会跳过）
- 跨组织 TXCer：`/api/v1/{groupID}/assign/poll-cross-org-txcers`（SSE 活跃时会跳过）

---

## 4. BigInt：为什么必须用“安全解析”

后端返回的结构体里包含超出 JS 安全整数范围的字段：
- 公钥坐标 `PublicKeyNew.X / Y`
- ECDSA 签名 `R / S`
- 以及部分结构体里的大整数/计数

前端统一策略：
- **接收**：用 `parseBigIntJson()` 把大整数解析成字符串（见 `js/utils/bigIntJson.ts`）
- **发送**：序列化时把 `X/Y/R/S/D` 输出为 **JSON number 字面量**（不带引号），但内部仍以 `bigint`/十进制字符串保存（见下一节）

典型调用点：
- SSE 事件解析：`js/services/accountPolling.ts`（明确标注“使用 BigInt 安全解析”）
- ComNode 查询：`js/services/accountQuery.ts`（使用 BigInt-safe JSON 解析）

---

## 5. 签名与序列化对齐（最常见故障点）

### 5.1 规则一：排除字段必须“置零值”，不能删除

后端 Go 侧在签名时会把排除字段设为零值（reflect.Zero），而不是从 JSON 里删除。

在前端实现中：
- 对签名字段（`UserSig` / `Sig` / `GroupSig` / `UserSignature`）的零值是：
  - `{ "R": null, "S": null }`

实现位置：`js/utils/signature.ts#applyExcludeZeroValue`

### 5.2 规则二：只排序 map 字段，不能全局排序

Go 的 `json.Marshal` 会对 `map[string]...` 的 key 做稳定排序，但不会改变 struct 字段顺序。

因此前端只对已知 map 字段做排序（例如 `AddressMsg`、`GuarTable`），而不是对整个对象排序。

实现位置：`js/utils/signature.ts#sortMapFieldsOnly`

### 5.3 规则三：X/Y/R/S/D 必须是 JSON number（不带引号）

Go 的 `*big.Int` 序列化为 JSON 时输出数字字面量；但 JS 无法用 `Number` 表示 256 位整数。

前端做法：
1) 先 `JSON.stringify`，把 bigint 转十进制字符串  
2) 再用正则把 `"X":"123"` 替换为 `"X":123`（对 `X|Y|R|S|D` 同理）

实现位置：
- 签名时：`js/utils/signature.ts#signStruct`
- 发请求体：`js/utils/signature.ts#serializeForBackend`

> 注意：这条规则对“签名哈希”与“发给后端的 JSON”都必须一致，否则后端验签必失败。

---

## 6. 时间戳：项目里存在两种格式（不要想当然）

你会在请求结构体里看到 `TimeStamp` / `Timestamp` 字段，但**它们不一定都是 Unix 秒**。

当前实现中：
- 自定义纪元（2020-01-01 起算秒数）：`js/services/group.ts#getTimestamp`
  - 用在：组织加入/退出 `FlowApply`、胶囊地址等（也被部分其它请求复用）
- Unix 秒：`Math.floor(Date.now()/1000)` 或 `js/utils/signature.ts#getTimestamp`
  - 用在：部分请求（例如某些地址解绑逻辑）

最稳妥的原则：
- **不要统一替换**时间戳算法；应以“当前 service 的实现”为准，并与后端对应结构体的校验逻辑一致。

---

## 7. 端点速查（来源：`js/config/api.ts`）

> 需要新增/修改端点时，先改这里，再改对应 service。

- BootNode/Gateway
  - `/api/v1/groups`
  - `/api/v1/groups/{groupId}`
  - `/api/v1/committee/endpoint`
  - `/api/v1/org/publickey?org_id=...`
- AssignNode（`/api/v1/{groupId}/assign/*`）
  - `/health`
  - `/new-address`
  - `/unbind-address`
  - `/capsule/generate`
  - `/flow-apply`
  - `/submit-tx`
  - `/tx-status/{txId}`
  - `/re-online`
  - `/group-info`
  - `/account-update`
  - `/txcer-change`
  - `/poll-cross-org-txcers`
- AggrNode（`/api/v1/{groupId}/aggr/*`）
  - `/txcer`
- ComNode（`/api/v1/com/*`）
  - `/health`
  - `/query-address`
  - `/query-address-group`
  - `/register-address`
  - `/capsule/generate`
  - `/public-key`
  - `/submit-noguargroup-tx`

