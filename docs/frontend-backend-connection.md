# 前端与后端连接专项说明 (Frontend-Backend Connection)

## 1. 连接策略概览 (Connection Strategy)
PanguPay 前端并不硬编码所有的后端节点地址，而是采用 **"BootNode 引导 + 动态发现"** 的两级连接策略。这确保了系统在部分节点变更或宕机时，前端仍能自动切换到可用服务。

### 1.1 服务发现流程 (Service Discovery)
1.  **初始引导**: 应用启动时，读取配置中的 `BootNode` 地址（默认 `http://localhost:8080`）。
2.  **获取委员会**: 调用 `/api/v1/committee/endpoint` 获取当前活跃的 Committee Node (ComNode) 列表。
3.  **获取分配节点**: 用户选择担保组织后，进一步查询该组织下的 Assignment Node (AssignNode) 地址。
4.  **本地缓存**: 发现的节点地址会被缓存在内存 `ComNodeEndpoint` 单例中，减少冗余请求。

---

## 2. API 接口规范 (API Specifications)

所有接口均通过 HTTP/HTTPS 协议提供，响应格式统一为 JSON。

### 2.1 基础与发现 (BootNode/Gateway)

| Method | Endpoint | 描述 | 关键参数 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/groups` | 获取所有担保组织列表 | - |
| `GET` | `/api/v1/groups/{id}` | 获取特定担保组织详情 | `id`: string |
| `GET` | `/api/v1/committee/endpoint` | 获取委员会节点地址 | - |

### 2.2 组织内业务 (AssignNode)
*Base URL: `/api/v1/{groupID}/assign`*

| Method | Endpoint | 描述 | 载体 (Payload) |
| :--- | :--- | :--- | :--- |
| `POST` | `/submit-tx` | 提交快速/跨链交易 | `UserNewTX` (JSON) |
| `GET` | `/account-update` | 轮询账户状态 | - |
| `GET` | `/txcer-change` | 轮询交易凭证变更 | - |
| `GET` | `/poll-cross-org-txcers` | 轮询跨组织凭证 | - |

### 2.3 散户与公共业务 (ComNode)
*Base URL: `/api/v1/com`*

| Method | Endpoint | 描述 | 载体 (Payload) |
| :--- | :--- | :--- | :--- |
| `GET` | `/query-address` | 查询任意地址 UTXO | `address`: string |
| `GET` | `/query-address-group` | 查询地址所属组织 | `address`: string |
| `POST` | `/submit-noguargroup-tx`| 提交普通聚合交易 | `AggregateGTX` (JSON) |

---

## 3. 数据协议与安全性 (Data Protocol)

### 3.1 BigInt 序列化 (Critical)
由于 JavaScript `Number` 类型的精度限制（最大安全整数 2^53-1），而后端使用 `int64` 及 `uint256`。
*   **发送时**: 前端必须将所有大整数（金额、Nonce、坐标）转换为 **字符串** 或 **Hex 字符串**。
*   **接收时**: 必须使用 `json-bigint` 库解析响应体，**严禁使用原生 `JSON.parse`**，否则会导致金额末位截断。

### 3.2 字段序 (Canonical Serialization)
为了保证签名哈希一致性，发送给后端的 JSON 对象必须严格按照 Golang 结构体的字段顺序排列。前端 `js/services/txBuilder.ts` 中实现了专门的 `serialize` 函数来保证这一点。

---

## 4. 实时通讯机制 (SSE & Polling)

前端实现了双重状态同步机制，以适应不同网络环境。

### 4.1 Server-Sent Events (SSE)
*   **启用条件**: 用户登录并加入担保组织。
*   **Endpoint**: `/api/v1/{groupID}/assign/account-update-stream`
*   **事件类型**:
    *   `init`: 连接建立，返回初始状态。
    *   `account_update`: 余额变动、UTXO 消费/生成。
    *   `tx_status_change`: 交易从 Pending 变为 Committed。

### 4.2 降级轮询 (Fallback Polling)
若 SSE 连接失败或被防火墙阻断，`js/services/accountPolling.ts` 会自动降级为定时间隔轮询（默认为 1秒/次），调用 `/account-update` 接口，确保用户界面数据最终一致。

---

## 5. 错误处理标准
API 响应遵循以下错误结构，前端 `apiClient` 会自动拦截并弹窗提示：
```json
{
  "code": 400,
  "message": "UTXO has been spent",
  "data": { ... }
}
```
*   **Network Error**: 自动重试 3 次。
*   **Business Error (4xx)**: 抛出异常，由 UI 层捕获并显示 Toast。
*   **Server Error (5xx)**: 提示“服务暂时不可用”。
