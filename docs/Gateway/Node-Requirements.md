# Gateway 后端节点需求文档

> 目的：统一记录 BootNode、AssignNode、AggrNode、ComNode 需要通过 HTTP Gateway 对外暴露的接口需求。保留组内/全网广播的 P2P 逻辑，**原有 P2P 方法不改动**；对"前端主动调用"的业务新增一个 "ForGateway" 版本（去掉对单个用户 Peer 的 P2P 单播）。对于"节点主动下发给用户"的场景，不做 ForGateway 复制，而是在原位置增加一条 Gateway 发送路径（P2P 群发保留）。

> **相关文档**：前端功能需求请参阅 [Frontend-Requirements.md](./Frontend-Requirements.md)

---

## ⚠️ 节点隔离架构规范（重要）

### 架构设计原则

Gateway 采用 **节点隔离架构**，确保不同类型的节点和不同担保组织之间的请求完全隔离：

1. **单节点单路由**：每种节点类型只暴露属于自己的 API 路由
   - BootNode 只处理 BootNode 相关路由（如 `/api/v1/group/{id}`）
   - AssignNode 只处理 AssignNode 相关路由（如 `/api/v1/{groupID}/assign/*`）
   - AggrNode 只处理 AggrNode 相关路由
   - ComNode 只处理 ComNode 相关路由

2. **多组织隔离**：同一类型的节点按担保组织 ID 隔离
   - 每个担保组织的 AssignNode 独立注册，使用 `map[string]AssignNodeInterface` 存储
   - 请求通过 URL 路径中的 `{groupID}` 路由到对应的节点实例
   - 担保组织 A 的请求**绝对不会**被担保组织 B 的 AssignNode 处理

3. **404 优于 503**：未注册的节点返回 404（资源不存在），而非 503（服务不可用）
   - 更符合 REST 语义
   - 前端可以明确知道是组织不存在还是服务故障

### 路由注册规范

**后续实现新节点 API 时必须遵循：**

```go
// ✅ 正确做法：使用 map 存储多个节点实例，按 ID 隔离
type APIGateway struct {
    BootNode    BootNodeInterface                  // 全局唯一
    assignNodes map[string]AssignNodeInterface     // GroupID -> AssignNode
    aggrNodes   map[string]AggrNodeInterface       // GroupID -> AggrNode
    comNodes    map[string]ComNodeInterface        // 委员会ID -> ComNode
}

// ✅ 正确做法：注册时指定节点所属的组织/委员会 ID
gw.RegisterAssignNode(groupID, assignNode)
gw.RegisterAggrNode(groupID, aggrNode)
gw.RegisterComNode(committeeID, comNode)

// ✅ 正确做法：处理请求时根据 ID 获取对应实例
func (g *APIGateway) handleXxxRequest(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    groupID := vars["groupID"]  // 从 URL 获取
    
    node := g.getAssignNode(groupID)
    if node == nil {
        respondWithError(w, http.StatusNotFound, 
            fmt.Sprintf("GuarGroup '%s' not found", groupID))
        return
    }
    // 调用节点方法...
}
```

```go
// ❌ 错误做法：使用单个节点实例（无法支持多组织）
type APIGateway struct {
    AssignNode AssignNodeInterface  // 只能存一个！
}

// ❌ 错误做法：所有请求都发给同一个节点
func (g *APIGateway) handleXxxRequest(w http.ResponseWriter, r *http.Request) {
    if g.AssignNode == nil {
        respondWithError(w, http.StatusServiceUnavailable, "...")
        return
    }
    g.AssignNode.DoSomething()  // 无法区分组织！
}
```

### 服务发现接口

Gateway 提供服务发现接口，前端可查询当前可用的担保组织列表：

```
GET /api/v1/groups

Response:
{
  "success": true,
  "groups": [
    {
      "group_id": "10000000",
      "assign_api_endpoint": ":8081",
      "aggr_api_endpoint": ":8082",
      "assi_peer_id": "12D3KooW...",
      "aggr_peer_id": "12D3KooW..."
    },
    {
      "group_id": "20000000",
      "assign_api_endpoint": ":8083",
      "aggr_api_endpoint": ":8084",
      "assi_peer_id": "12D3KooW...",
      "aggr_peer_id": "12D3KooW..."
    }
  ],
  "count": 2,
  "boot_node": true
}
```

查询单个担保组织详细信息（RESTful 风格）：

```
GET /api/v1/groups/{id}

Response: GuarGroupTable（包含 AssignAPIEndpoint 和 AggrAPIEndpoint）
```

### 动态路由设计

AssignNode 使用动态路由 `/api/v1/{groupID}/assign/*`：

| 路由 | 示例 | 说明 |
|------|------|------|
| `/api/v1/{groupID}/assign/new-address` | `/api/v1/10000000/assign/new-address` | 向 10000000 组织的 AssignNode 发送请求 |
| `/api/v1/{groupID}/assign/submit-tx` | `/api/v1/20000000/assign/submit-tx` | 向 20000000 组织的 AssignNode 发送请求 |

**工作流程**：
```
前端请求 POST /api/v1/10000000/assign/submit-tx
    ↓
Gateway 提取 groupID = "10000000"
    ↓
Gateway 调用 getAssignNode("10000000")
    ↓
找到对应的 AssignNode 实例
    ↓
调用 AssignNode.ReceiveUserNewTXForGateway(...)
    ↓
返回处理结果
```

### 节点启动时的注册流程

```go
// AssignNode 启动时
func (a *AssignNode) Handle(...) {
    gw := gateway.GetGlobalGateway()
    if gw != nil {
        // 使用组织 ID 注册
        gw.RegisterAssignNode(a.GuarGroupID, a)
    }
    // ...
}

// AssignNode 关闭时
func (a *AssignNode) AssignNodeOut() {
    gw := gateway.GetGlobalGateway()
    if gw != nil {
        gw.UnregisterAssignNode(a.GuarGroupID)
    }
}
```

---

命名约定  
- 后端方法：`XxxForGateway`（与原业务函数同名，但移除单播发送）。  
- 路由路径：与业务含义对应，`/api/v1/...`；GET 用查询，POST 用写入/提交。  
- 部署域名：文档中的 `localhost:8080` 为本地示例，上线后替换为实际域名/反向代理端口，路径 `/api/v1/...` 保持不变。

---

## 通用返回/错误规范
- 200：业务成功，返回 JSON。  
- 404：资源未找到（如 group/committee 不存在），`{"error": "..."}`。  
- 400：参数错误，`{"error": "..."}`。  
- 500：内部错误，`{"error": "..."}`。  
统一使用 Gateway 全局 CORS；如需生产安全，可增加鉴权/限流/日志中间件。

---

## BootNode（引导节点）

### 1) 对外输入场景（前端调用，新增 ForGateway 版本）

| 场景 | 前端输入（core 结构） | ForGateway 调用（新增） | 原内部方法 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 查询担保组织信息 | `GetGroupMsg`（`GroupID`，前端不需要 `FromPeerID`） | `ReturnGroupInfoForGateway` | `ReturnGroupInfo` | `bootnodetrans.go` 176-200 | **已实现**，ForGateway 版本直接复用本地查询逻辑 `LocalMsg.FindGuarGroup`，移除 P2P 单播 |

### 2) 路由草案（对应 ForGateway 方法）

| 路由 | 方法 | 功能 | 内部调用 | 状态 |
| --- | --- | --- | --- | --- |
| `/api/v1/groups` | GET | 列出所有担保组织（简要信息 + API 端口） | `GetAllGroupsWithAPI` → 返回组织列表 | ✅ 已实现 |
| `/api/v1/groups/{id}` | GET | 查询指定担保组织详细信息（包含 API 端口） | `ReturnGroupInfoForGateway` → 返回 `GuarGroupTable` | ✅ 已实现 |
| `/health` | GET | 健康检查 | - | ✅ 已实现 |

### 3) 数据结构说明

#### 输入结构

```go
// 查询担保组织 - Gateway 版简化输入（直接使用 URL 参数）
// GET /api/v1/groups/{id}
// 无需 POST body，groupID 从 URL path 获取
```

#### 输出结构

```go
// 担保组织信息返回 - core.GuarGroupTable
type GuarGroupTable struct {
    GroupID           string            `json:"group_id"`            // 担保组织ID
    PeerGroupID       string            `json:"peer_group_id"`       // 组织PeerID
    AssiPeerID        string            `json:"assi_peer_id"`        // 分配节点PeerID
    AggrPeerID        string            `json:"aggr_peer_id"`        // 聚合节点PeerID
    GuarTable         map[string]string `json:"guar_table"`          // 担保人ID → PeerID
    AssiPublicKey     PublicKeyNew      `json:"assi_public_key"`     // 分配节点公钥
    AggrPublicKey     PublicKeyNew      `json:"aggr_public_key"`     // 聚合节点公钥
    AssignAPIEndpoint string            `json:"assign_api_endpoint"` // AssignNode HTTP API 地址
    AggrAPIEndpoint   string            `json:"aggr_api_endpoint"`   // AggregationNode HTTP API 地址
    // ... 其他字段
}
```

### 4) 设计要点

1. **无状态查询**：接口是纯查询，无副作用，适合 GET 请求。

2. **缓存友好**：担保组织信息变更频率低，前端可适当缓存减少请求。

3. **错误处理**：
   - 组织不存在：返回 404 `{"error": "group not found"}`

### 5) 实施步骤

1. ✅ 已实现 `ReturnGroupInfoForGateway`。

---

## AssignNode（分配节点）

### 1) 对外输入场景（前端调用，新增 ForGateway 版本）

| 场景 | 前端输入（core 结构） | ForGateway 调用（新增） | 原内部方法 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 用户新建子地址 | `UserNewAddressInfo`（`NewAddress`, `PublicKeyNew`, `UserID`, `Type`, `Sig`） | `ProcessUserNewAddressForGateway` | `ProcessUserNewAddress` | `manage.go` 33-68 | ForGateway 版本直接复用业务逻辑，去掉 P2P 单播，返回操作结果 |
| 用户加入/退出担保组织 | `UserFlowMsg`（`Status`, `UserID`, `UserPeerID`, `GuarGroupID`, `AddressMsg`, `TimeStamp`, `UserSig`） | `ProcessUserFlowApplyForGateway` | `ProcessUserFlowApply` | `manage.go` 71-190 | ForGateway 版本直接复用业务逻辑，去掉 P2P 单播，返回 `UserFlowMsgReply` |
| 用户构造交易 | `UserNewTX`（`TX`, `UserID`） | `ReceiveUserNewTXForGateway` | `ReceiveUserNewTX` | `assignnode.go` 218-223 | ForGateway 版本直接复用业务逻辑，去掉 P2P 单播，返回交易受理状态 |
| 用户重登（退出后再上线） | `UserReOnlineMsg`（`UserID`, `FromPeerID`, `Address[]`, `Sig`） | `UserReOnlineForGateway` | `UserReOnline` | `assignnode.go` 995-1039 | ForGateway 版本直接复用业务逻辑，移除 `UnicastP2P` 单播，直接返回 `ReturnUserReOnlineMsg` |
| 入组后查询其他担保组织 | `GetGroupMsg`（`GroupID`） | `GetGroupMsgForGateway` | `LocalMsg.AddGroupBootMsg` | `LocalMsg` | ForGateway 版本直接复用本地查询逻辑，返回 `ReturnGroupBootMsg`，不单播 |

### 2) 对用户输出场景（AssignNode → 用户，前端轮询）

| 场景 | 输出结构 | 原发送端参考 | Gateway 方案 |
| --- | --- | --- | --- |
| 账户/余额/UTXO/TXCer 更新 | `AccountUpdateInfo` | `assignnode.go` 800-838 | 提供轮询接口 `GET /api/v1/assign/account-update?userID=...`，原 P2P 单播保留 |
| 仅区块高度更新 | `AccountUpdateInfo`（`IsNoWalletChange=true`） | `assignnode.go` 854-886 | 同上，复用轮询接口 |
| TXCer 状态变动通知 | `TXCerChangeToUser` | `txcertable.go` 178-191 | 提供轮询接口 `GET /api/v1/assign/txcer-change?userID=...`，原 P2P 单播保留 |

### 3) 路由草案（对应 ForGateway 方法）

> **动态路由设计**：所有 AssignNode 路由采用 `/api/v1/{groupID}/assign/*` 格式，`{groupID}` 是担保组织ID，确保请求路由到正确的 AssignNode 实例。

| 路由 | 方法 | 功能 | 内部调用 | 状态 |
| --- | --- | --- | --- | --- |
| `GET /api/v1/{groupID}/assign/health` | GET | AssignNode 健康检查 | 检查 AssignNode 是否已注册 | ✅ 已实现 |
| `POST /api/v1/{groupID}/assign/new-address` | POST | 用户新建子地址 | `ProcessUserNewAddressForGateway` → 返回操作结果 | ✅ 已实现 |
| `POST /api/v1/{groupID}/assign/flow-apply` | POST | 用户加入/退出担保组织 | `ProcessUserFlowApplyForGateway` → 返回 `UserFlowMsgReply` | ✅ 已实现 |
| `POST /api/v1/{groupID}/assign/submit-tx` | POST | 用户提交交易 | `ReceiveUserNewTXForGateway` → 返回受理状态 | ✅ 已实现 |
| `POST /api/v1/{groupID}/assign/re-online` | POST | 用户重新上线 | `UserReOnlineForGateway` → 返回 `ReturnUserReOnlineMsg` | ✅ 已实现 |
| `GET /api/v1/{groupID}/assign/group-info` | GET | 查询担保组织信息 | `GetGroupMsgForGateway` → 返回 `ReturnGroupBootMsg` | ✅ 已实现 |
| `GET /api/v1/{groupID}/assign/account-update?userID=...` | GET | 轮询获取账户更新信息 | 返回 `[]AccountUpdateInfo`（增量/列表） | 待实现 |
| `GET /api/v1/{groupID}/assign/txcer-change?userID=...` | GET | 轮询获取 TXCer 状态变动 | 返回 `[]TXCerChangeToUser`（增量/列表） | 待实现 |

### 4) 数据结构说明

#### 输入结构

```go
// 用户新建子地址 - core.UserNewAddressInfo
type UserNewAddressInfo struct {
    NewAddress   string         `json:"new_address"`   // 新地址
    PublicKeyNew PublicKeyNew   `json:"public_key"`    // 地址公钥
    UserID       string         `json:"user_id"`       // 用户ID
    Type         int            `json:"type"`          // 地址类型 (0:盘古币, 1:比特币, 2:以太坊)
    Sig          EcdsaSignature `json:"sig"`           // 用户签名
}

// 用户加入/退出担保组织 - core.UserFlowMsg
type UserFlowMsg struct {
    Status        int                        `json:"status"`          // 0:退出, 1:加入
    UserID        string                     `json:"user_id"`         // 用户ID
    UserPeerID    string                     `json:"user_peer_id"`    // 用户PeerID（Gateway可忽略）
    GuarGroupID   string                     `json:"guar_group_id"`   // 目标担保组织ID
    UserPublicKey PublicKeyNew               `json:"user_public_key"` // 用户账户公钥
    AddressMsg    map[string]FlowAddressData `json:"address_msg"`     // 申请担保的地址信息
    TimeStamp     uint64                     `json:"timestamp"`       // 申请时间戳
    UserSig       EcdsaSignature             `json:"user_sig"`        // 用户签名
}

// 用户提交交易 - core.UserNewTX
type UserNewTX struct {
    TX     Transaction `json:"tx"`      // 交易本体
    UserID string      `json:"user_id"` // 用户ID
}

// 用户重新上线 - core.UserReOnlineMsg（Gateway版简化）
type UserReOnlineMsgForGateway struct {
    UserID  string         `json:"user_id"`  // 用户ID
    Address []string       `json:"address"`  // 用户地址列表（用于散户）
    Sig     EcdsaSignature `json:"sig"`      // 用户签名
}
```

#### 输出结构

```go
// 加入/退出担保组织返回 - core.UserFlowMsgReply
type UserFlowMsgReply struct {
    Status      int    `json:"status"`        // 0:退出, 1:加入
    UserID      string `json:"user_id"`       // 用户ID
    GuarGroupID string `json:"guar_group_id"` // 担保组织ID
    Result      bool   `json:"result"`        // 操作结果
    Message     string `json:"message"`       // 结果信息
}

// 通用操作结果
type OperationResult struct {
    Success bool   `json:"success"` // 是否成功
    Message string `json:"message"` // 成功/失败信息
    Error   string `json:"error"`   // 错误详情（失败时）
}

// 交易受理结果
type TXReceiveResult struct {
    Success bool   `json:"success"` // 是否受理
    TXID    string `json:"tx_id"`   // 交易ID（成功时）
    Error   string `json:"error"`   // 错误信息（失败时）
}

// 用户重登返回 - core.ReturnUserReOnlineMsg
type ReturnUserReOnlineMsg struct {
    UserID           string         `json:"user_id"`            // 用户ID
    IsInGroup        bool           `json:"is_in_group"`        // 是否在担保组织中
    GuarantorGroupID string         `json:"guarantor_group_id"` // 用户对应担保组织ID
    GuarGroupBootMsg GuarGroupTable `json:"guar_group_boot"`    // 担保组织通信信息
    UserWalletData   UserWalletData `json:"user_wallet_data"`   // 用户钱包数据
}

// 担保组织信息返回 - core.ReturnGroupBootMsg
type ReturnGroupBootMsg struct {
    GuarGroupID string         `json:"guar_group_id"` // 担保组织ID
    GroupMsg    GuarGroupTable `json:"group_msg"`     // 组织详情
}

// 账户更新信息 - core.AccountUpdateInfo
type AccountUpdateInfo struct {
    UserID              string                `json:"user_id"`             // 用户ID
    WalletChangeData    InfoChangeData        `json:"wallet_change_data"`  // 账户变动信息
    TXCerChangeData     []TXCerChangeToUser   `json:"txcer_change_data"`   // 交易凭证变动
    UsedTXCerChangeData []UsedTXCerChangeData `json:"used_txcer_change"`   // 已使用TXCer
    Timestamp           uint64                `json:"timestamp"`           // 时间戳
    BlockHeight         int                   `json:"block_height"`        // 区块高度
    IsNoWalletChange    bool                  `json:"is_no_wallet_change"` // true表示仅区块高度更新
}

// TXCer 状态变动 - core.TXCerChangeToUser
type TXCerChangeToUser struct {
    TXCerID string `json:"txcer_id"` // TXCer ID
    Status  int    `json:"status"`   // 0:前置交易已上链, 1:TXCer验证错误
    UTXO    string `json:"utxo"`     // 新增的UTXO标识符（Status=0时有效）
}
```

### 5) 设计要点

1. **ForGateway 实现原则**：ForGateway 方法直接复用原业务逻辑函数，不需要经过 P2P 消息解析层（handle.go），仅去除单播/群发给用户的 P2P 通信部分。

2. **签名验证**：所有写入操作（新建地址、加入/退出、交易、重登）都需要用户签名，ForGateway 版本保留签名验证逻辑。

3. **时间戳验证**：`UserFlowMsg` 有 5 分钟有效期限制，ForGateway 版本保留此限制。

4. **幂等性考虑**：
   - 新建地址：同一地址重复提交应返回"已存在"而非报错
   - 交易提交：可通过 TXID 去重
   - 加入/退出：检查当前状态避免重复操作

5. **轮询接口设计**：
   - 支持增量查询（通过时间戳/区块高度游标）
   - 返回格式：`[]AccountUpdateInfo` 或 `[]TXCerChangeToUser`
   - `IsNoWalletChange=true` 表示仅区块高度更新

6. **错误处理**：
   - 用户不在组织中：返回 403 `{"error": "user not in group"}`
   - 签名验证失败：返回 401 `{"error": "signature verification failed"}`
   - 时间戳过期：返回 400 `{"error": "timestamp expired"}`

### 7) 实施步骤

1. 在 `Guarantor/AssignNode/manage.go` 和 `assignnode.go` 中新增 ForGateway 方法。

2. 在 `gateway/server.go` 中定义 `AssignNodeInterface` 接口并注册路由。

3. 实现账户更新和 TXCer 变动轮询接口。

4. 在 AssignNode 启动时初始化 Gateway 并绑定自身。

---

## AggrNode（聚合节点）

### 1) 对用户输出场景（AggrNode → 用户，前端轮询）

| 场景 | 输出结构 | 原发送端参考 | Gateway 方案 |
| --- | --- | --- | --- |
| 聚合节点给用户群发 TXCer | `TXCerToUser` | `aggrnode.go` 526-535 | 提供轮询接口 `GET /api/v1/aggr/txcer?address=...`，原 P2P 群发保留 |

### 2) 路由草案

| 路由 | 方法 | 功能 | 内部调用 |
| --- | --- | --- | --- |
| `GET /api/v1/aggr/txcer?address=...` | GET | 拉取指定地址收到的 TXCer | 从本地缓存/队列返回 `[]TXCerToUser` |

### 3) 数据结构说明

#### 输出结构

```go
// TXCer 列表返回
type TXCerListResponse struct {
    TXCers    []TXCerToUser `json:"txcers"`     // TXCer列表
    Total     int           `json:"total"`      // 总数量
    HasMore   bool          `json:"has_more"`   // 是否还有更多
    NextSince uint64        `json:"next_since"` // 下次查询的起始时间戳
}

// 单条 TXCer - core.TXCerToUser
type TXCerToUser struct {
    ToAddress string        `json:"to_address"` // 接收用户子地址
    TXCer     TxCertificate `json:"txcer"`      // 交易凭证详情
}
```

### 4) 设计要点

1. **群发转轮询**：原 P2P 群发保留，Gateway 提供拉取接口，前端根据 `toAddress` 过滤。

2. **增量查询**：支持 `since` 时间戳参数。

3. **去重机制**：前端按 `TXCerID` 去重。

### 5) 实施步骤

1. 在 `Guarantor/AggretionNode/aggrnode.go` 中新增 TXCer 缓存队列。

2. 实现 `GetTXCerForGateway(address string, since uint64, limit int)` 方法。

3. 在 `gateway/server.go` 中定义 `AggrNodeInterface` 接口并注册路由。

4. 在原 `BroadcastAllP2P` 发送处，同时将 TXCer 写入缓存队列。

---

## ComNode（担保委员会节点）

### 1) 对外输入场景（前端调用，新增 ForGateway 版本）

| 场景 | 前端输入（core 结构） | ForGateway 调用（新增） | 原内部方法 | 代码位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 查询账户信息（地址余额等） | `GetNodeAddressMsg`（`Address[]`） | `GetNodeAddressMsgRequestForGateway` | `GetNodeAddressMsgRequest` | `comnode.go` 950-986 | ForGateway 版本直接复用业务逻辑，移除 P2P 单播，直接返回 `ReturnNodeAddressMsg` |
| 查询地址所属担保组织 | `UserQueryAddressGuarGroup`（`Address[]`） | `GetAddressGuarGroupForGateway` | `GetAddressGuarGroup` | `comnode.go` 1071-1121 | ForGateway 版本直接复用业务逻辑，移除 P2P 单播，直接返回 `UserQueryAddressGuarGroupReply` |
| 散户交易提交 | `AggregateGTX`（`IsNoGuarGroupTX=true`） | `ReceiveNoGuarGroupTXForGateway` | `ReceiveNewATX` | `comnode.go` 172-210 | ForGateway 版本直接复用业务逻辑，仅处理散户交易，返回受理状态 |

### 2) 对用户输出场景（ComNode → 用户，前端轮询）

| 场景 | 输出结构 | 原发送端参考 | Gateway 方案 |
| --- | --- | --- | --- |
| TXCer兑换后UTXO变动通知 | `AddressUTXOChange` | `blockchain.go` 393-400 | 提供轮询接口 `GET /api/v1/com/utxo-change?address=...`，原 P2P 群发保留 |

### 3) 路由草案（对应 ForGateway 方法）

| 路由 | 方法 | 功能 | 内部调用 |
| --- | --- | --- | --- |
| `POST /api/v1/com/query-address` | POST | 查询指定地址的账户信息 | `GetNodeAddressMsgRequestForGateway` → 返回 `ReturnNodeAddressMsg` |
| `POST /api/v1/com/query-address-group` | POST | 查询指定地址所属的担保组织 | `GetAddressGuarGroupForGateway` → 返回 `UserQueryAddressGuarGroupReply` |
| `POST /api/v1/com/submit-noguargroup-tx` | POST | 提交散户交易 | `ReceiveNoGuarGroupTXForGateway` → 返回受理状态 |
| `GET /api/v1/com/utxo-change?address=...` | GET | 轮询获取 UTXO 变动通知 | 返回 `[]AddressUTXOChange` |

### 4) 数据结构说明

#### 输入结构

```go
// 查询账户信息 - Gateway 版简化输入
type GetNodeAddressMsgForGateway struct {
    Address []string `json:"address"` // 要查询的地址列表
}

// 查询地址担保组织 - Gateway 版简化输入
type UserQueryAddressGuarGroupForGateway struct {
    Address []string `json:"address"` // 要查询的地址列表
}
```

#### 输出结构

```go
// 账户信息返回 - core.ReturnNodeAddressMsg
type ReturnNodeAddressMsg struct {
    FromGroupID string                      `json:"from_group_id"` // 响应的委员会组ID
    AddressData map[string]PointAddressData `json:"address_data"`  // 地址 → 账户数据
}

// 地址担保组织返回 - core.UserQueryAddressGuarGroupReply
type UserQueryAddressGuarGroupReply struct {
    Addresstogroup map[string]struct {
        GroupID   string       `json:"group_id"`   // "0":地址错误, "1":无组织, 其他:组织ID
        PublicKey PublicKeyNew `json:"public_key"` // 地址公钥
    } `json:"address_to_group"`
}

// UTXO变动通知 - core.AddressUTXOChange
type AddressUTXOChange struct {
    Address string            `json:"address"` // 地址
    UTXO    map[string]string `json:"utxo"`    // TXID → TXCerID
    Value   float64           `json:"value"`   // 变动金额
}

// 散户交易受理返回
type NoGuarGroupTXResponse struct {
    Success bool   `json:"success"`  // 是否受理成功
    TXHash  string `json:"tx_hash"`  // 交易哈希（成功时返回）
    Error   string `json:"error"`    // 错误信息（失败时返回）
}
```

### 5) 设计要点

1. **Leader 节点限制**：只有 Leader 节点才会回复请求，非 Leader 返回 503 错误。

2. **利息计算**：返回的利息是实时计算的最新值。

3. **错误处理**：
   - 非 Leader 节点：返回 503 `{"error": "not leader node, please retry"}`
   - 交易验证失败：返回具体错误原因

### 6) 实施步骤

1. 在 `GuarCommittee/comnode.go` 中新增 ForGateway 方法。

2. 在 `gateway/server.go` 中定义 `ComNodeInterface` 接口并注册路由。

3. 实现 UTXO 变动轮询接口。

4. 在 ComNode 启动时初始化 Gateway 并绑定自身。

---

## 实施顺序建议

1. **BootNode**：✅ 已实现担保组织查询接口。
2. **AssignNode**：
   - 先实现 `user-reonline`（登录）和 `user-flow`（加入/退出）
   - 再实现 `user-new-address`（新建地址）和 `user-tx`（交易）
   - 最后实现轮询接口（account-update, txcer-change）
3. **AggrNode**：实现 TXCer 轮询拉取接口。
4. **ComNode**：实现查询接口和散户交易接口，以及 UTXO 变动轮询接口。

---

## 后端主动向前端发送信息的策略说明

- 保留链内/组内的 P2P 广播/群发逻辑不变。
- 对"原本单播给用户"的场景，新增 Gateway 拉取接口（前端轮询）：
  - 账户更新：`GET /api/v1/assign/account-update?userID=...`
  - TXCer 群发：`GET /api/v1/aggr/txcer?address=...`
  - TXCer 变动：`GET /api/v1/assign/txcer-change?userID=...`
  - UTXO 变动：`GET /api/v1/com/utxo-change?address=...`
- 如需低时延推送，可后续扩展 WebSocket/SSE。
- 去重/幂等建议：前端按业务唯一键（如 `TXCerID`）去重。

---

## 接口汇总表

| 节点 | 路由 | 方法 | 功能 | 状态 |
| --- | --- | --- | --- | --- |
| **公共** | `/health` | GET | 健康检查 | ✅ 已实现 |
| **公共** | `/api/v1/groups` | GET | 列出已注册的担保组织（服务发现 + API 端口） | ✅ 已实现 |
| BootNode | `/api/v1/groups/{id}` | GET | 查询担保组织详细信息（包含 API 端口） | ✅ 已实现 |
| AssignNode | `GET /api/v1/{groupID}/assign/health` | GET | AssignNode 健康检查 | ✅ 已实现 |
| AssignNode | `POST /api/v1/{groupID}/assign/new-address` | POST | 用户新建子地址 | ✅ 已实现 |
| AssignNode | `POST /api/v1/{groupID}/assign/flow-apply` | POST | 用户加入/退出担保组织 | ✅ 已实现 |
| AssignNode | `POST /api/v1/{groupID}/assign/submit-tx` | POST | 用户提交交易 | ✅ 已实现 |
| AssignNode | `POST /api/v1/{groupID}/assign/re-online` | POST | 用户重新上线 | ✅ 已实现 |
| AssignNode | `GET /api/v1/{groupID}/assign/group-info` | GET | 查询担保组织信息 | ✅ 已实现 |
| AssignNode | `GET /api/v1/{groupID}/assign/account-update` | GET | 轮询获取账户更新 | 待实现 |
| AssignNode | `GET /api/v1/{groupID}/assign/txcer-change` | GET | 轮询获取 TXCer 状态变动 | 待实现 |
| AggrNode | `GET /api/v1/{groupID}/aggr/txcer` | GET | 拉取 TXCer 列表 | 待实现 |
| ComNode | `POST /api/v1/{committeeID}/com/query-address` | POST | 查询地址账户信息 | 待实现 |
| ComNode | `POST /api/v1/{committeeID}/com/query-address-group` | POST | 查询地址所属担保组织 | 待实现 |
| ComNode | `POST /api/v1/{committeeID}/com/submit-noguargroup-tx` | POST | 提交散户交易 | 待实现 |
| ComNode | `GET /api/v1/{committeeID}/com/utxo-change` | GET | 轮询获取 UTXO 变动通知 | 待实现 |

> **注意**：所有 AssignNode/AggrNode/ComNode 路由均采用动态路由设计，`{groupID}` 和 `{committeeID}` 是路径参数，用于标识目标节点所属的担保组织或委员会。
