# Gateway 后端节点接口实现汇总

> 文档状态：实现版（与 `UTXO-Area/gateway/server.go` 对齐）
> 目的：汇总 BootNode、AssignNode、AggrNode、ComNode 通过 HTTP Gateway 对外暴露的接口与数据结构，作为前后端对接的唯一参考。
> 相关文档：前端需求见 `./Frontend-Requirements.md`

---

## 架构与路由隔离

- BootNode 为全局唯一入口，提供组信息与登录路由。
- AssignNode / AggrNode 按 `groupID` 隔离，每个组织独立实例。
- ComNode 为委员会 Leader 单实例。
- 未注册节点统一返回 404（资源不存在），优先于 503。

---

## 公共与 BootNode

### 服务发现
- GET `/api/v1/groups`：列出担保组织（含 Assign/Aggr API endpoint）。
- GET `/api/v1/groups/{id}`：查询单个担保组织详情。
- GET `/api/v1/committee/endpoint`：查询 ComNode Leader 的 API endpoint。
- GET `/health`：健康检查。

### 登录统一入口
- POST `/api/v1/re-online`
  - BootNode 按 `UserID -> GuarGroupID` 路由转发到 `/api/v1/{groupID}/assign/re-online`。
  - 未命中时会 fallback 探测已注册组并缓存结果。

---

## AssignNode

### 写入类
- POST `/api/v1/{groupID}/assign/new-address`：新建子地址。
- POST `/api/v1/{groupID}/assign/flow-apply`：加入/退出担保组。
- POST `/api/v1/{groupID}/assign/submit-tx`：提交交易。
- POST `/api/v1/{groupID}/assign/re-online`：用户重登。
- POST `/api/v1/{groupID}/assign/unbind-address`：解绑子地址。

### 查询/状态
- GET `/api/v1/{groupID}/assign/health`：健康检查。
- GET `/api/v1/{groupID}/assign/group-info`：查询本组织信息。
- GET `/api/v1/{groupID}/assign/tx-status/{txID}`：查询 AssignNode 对交易的处理状态。
  - 仅表示“处理结果”，最终上链确认以 `account_update.ConfirmedTxIDs` 为准。

### 轮询接口
- GET `/api/v1/{groupID}/assign/account-update?userID=...&since=0&limit=10&consume=true`
- GET `/api/v1/{groupID}/assign/txcer-change?userID=...&limit=10&consume=true`
- GET `/api/v1/{groupID}/assign/poll-cross-org-txcers?userID=...&limit=10&consume=true`

### SSE 实时同步
- GET `/api/v1/{groupID}/assign/account-update-stream?userID=...`
- 事件类型：
  - `account_update` -> `AccountUpdateInfo`
  - `txcer_change` -> `TXCerChangeToUser`
  - `cross_org_txcer` -> `TXCerToUser`
  - `tx_status_change` -> `TXStatusResponse`

---

## AggrNode

- GET `/api/v1/{groupID}/aggr/health`：健康检查。

---

## ComNode（委员会 Leader）

- GET `/api/v1/com/health`：健康检查。
- POST `/api/v1/com/query-address`：查询地址账户信息。
- POST `/api/v1/com/query-address-group`：查询地址所属担保组织。
- POST `/api/v1/com/submit-noguargroup-tx`：提交散户普通交易。

---

## 关键数据结构（实现版）

### AccountUpdateInfo（新增 ConfirmedTxIDs）
```go
type AccountUpdateInfo struct {
  UserID              string
  WalletChangeData    InfoChangeData
  TXCerChangeData     []TXCerChangeToUser
  UsedTXCerChangeData []UsedTXCerChangeData
  Timestamp           uint64
  BlockHeight         int
  ConfirmedTxIDs      []string
  IsNoWalletChange    bool
}
```
- `ConfirmedTxIDs` 用于标记“已上链”的 TXID（快速转账/跨链转账的最终确认）。

### TXStatusResponse
```json
{
  "tx_id": "...",
  "status": "pending|success|failed|not_found",
  "receive_result": true,
  "result": true,
  "error_reason": "",
  "guar_id": "...",
  "user_id": "...",
  "block_height": 0
}
```

---

## 通用返回与错误

- 200：成功
- 400：参数错误
- 404：group/committee 未注册
- 500：内部错误
- 503：ComNode 非 Leader 或 BootNode 不可用

---

## 接口汇总（实现版）

| 节点 | 路由 | 方法 | 说明 |
| --- | --- | --- | --- |
| 公共 | `/health` | GET | Gateway 健康检查 |
| BootNode | `/api/v1/groups` | GET | 服务发现（担保组织列表） |
| BootNode | `/api/v1/groups/{id}` | GET | 担保组织详情 |
| BootNode | `/api/v1/committee/endpoint` | GET | ComNode Leader endpoint |
| BootNode | `/api/v1/re-online` | POST | 登录/重登统一入口 |
| AssignNode | `/api/v1/{groupID}/assign/health` | GET | 健康检查 |
| AssignNode | `/api/v1/{groupID}/assign/new-address` | POST | 新建子地址 |
| AssignNode | `/api/v1/{groupID}/assign/flow-apply` | POST | 加入/退出担保组 |
| AssignNode | `/api/v1/{groupID}/assign/submit-tx` | POST | 提交交易 |
| AssignNode | `/api/v1/{groupID}/assign/tx-status/{txID}` | GET | 交易处理状态 |
| AssignNode | `/api/v1/{groupID}/assign/re-online` | POST | 用户重登 |
| AssignNode | `/api/v1/{groupID}/assign/group-info` | GET | 组织信息 |
| AssignNode | `/api/v1/{groupID}/assign/unbind-address` | POST | 解绑子地址 |
| AssignNode | `/api/v1/{groupID}/assign/account-update` | GET | 账户更新轮询 |
| AssignNode | `/api/v1/{groupID}/assign/account-update-stream` | GET | SSE 实时同步 |
| AssignNode | `/api/v1/{groupID}/assign/txcer-change` | GET | TXCer 变更轮询 |
| AssignNode | `/api/v1/{groupID}/assign/poll-cross-org-txcers` | GET | 跨组 TXCer 轮询 |
| AggrNode | `/api/v1/{groupID}/aggr/health` | GET | 健康检查 |
| ComNode | `/api/v1/com/health` | GET | 健康检查 |
| ComNode | `/api/v1/com/query-address` | POST | 查询地址账户信息 |
| ComNode | `/api/v1/com/query-address-group` | POST | 查询地址所属担保组织 |
| ComNode | `/api/v1/com/submit-noguargroup-tx` | POST | 提交散户普通交易 |
