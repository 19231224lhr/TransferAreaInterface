# API 直连架构重构方案

## 1. 背景与目标

### 1.1 当前架构问题

当前所有前端 HTTP 请求都发送到 BootNode Gateway (端口 8080)，由 BootNode 转发到对应的 AssignNode/AggrNode/ComNode：

```
┌─────────────────┐     HTTP      ┌─────────────────┐
│  Frontend       │ ◄──────────► │  BootNode       │
│  (Browser)      │   Port 8080  │  Gateway        │
└─────────────────┘              └────────┬────────┘
                                          │ 转发
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌───────────┐        ┌─────────────┐       ┌─────────────┐
              │AssignNode │        │  AggrNode   │       │  ComNode    │
              │ Port 动态  │        │ Port 动态   │       │ Port 动态   │
              └───────────┘        └─────────────┘       └─────────────┘
```

**问题：**
- BootNode 成为单点瓶颈，所有请求都经过它
- 增加网络延迟（2 跳 vs 1 跳）
- 不符合去中心化设计理念
- BootNode 需要维护复杂的转发逻辑

### 1.2 目标架构

BootNode 仅作为**服务发现**节点，前端获取端点信息后直接与担保组织节点通信：

```
┌─────────────────┐                ┌─────────────────┐
│  Frontend       │ ──查询端点──► │  BootNode       │
│  (Browser)      │   (一次性)    │  Port 8080      │
└────────┬────────┘              └─────────────────┘
         │
         │ 直连（后续所有请求）
         │
         ├──────────────────────────────────────────┐
         ▼                     ▼                    ▼
   ┌───────────┐        ┌─────────────┐      ┌─────────────┐
   │AssignNode │        │  AggrNode   │      │  ComNode    │
   │ Port 8081 │        │ Port 8082   │      │ Port 8083   │
   └───────────┘        └─────────────┘      └─────────────┘
```

**优势：**
- 减少 BootNode 负载
- 降低网络延迟
- 更符合去中心化设计
- 简化 BootNode 代码（移除转发逻辑）

---

## 2. 详细设计

### 2.1 后端修改 (UTXO-Area)

#### 2.1.1 新增端点查询接口

**文件**: `gateway/server.go`

**接口**: `GET /api/v1/groups/{groupID}/endpoints`

**请求**: 无需请求体

**响应**:
```json
{
  "success": true,
  "groupID": "10000000",
  "endpoints": {
    "assign": "http://localhost:8081",
    "aggr": "http://localhost:8082"
  },
  "groupInfo": {
    "peerGroupID": "10000000",
    "aggrID": "...",
    "assiID": "...",
    "pledgeAddress": "..."
  }
}
```

**实现逻辑**:
```go
func (g *APIGateway) handleGetGroupEndpoints(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    groupID := vars["groupID"]
    
    // 从 BootNode 获取组织信息
    groupTable, err := g.BootNode.ReturnGroupInfoForGateway(groupID)
    if err != nil {
        respondWithError(w, http.StatusNotFound, "Group not found")
        return
    }
    
    // 构造完整 URL
    baseHost := getRequestHost(r) // 获取请求的 host（本地测试时为 localhost）
    
    response := map[string]interface{}{
        "success": true,
        "groupID": groupID,
        "endpoints": map[string]string{
            "assign": buildEndpointURL(baseHost, groupTable.AssignAPIEndpoint),
            "aggr":   buildEndpointURL(baseHost, groupTable.AggrAPIEndpoint),
        },
        "groupInfo": groupTable,
    }
    
    respondWithJSON(w, http.StatusOK, response)
}

// buildEndpointURL 构造完整的端点 URL
// 如果 endpoint 是 ":8081" 格式，则补充 host
// 如果 endpoint 已经是完整 URL，则直接返回
func buildEndpointURL(host string, endpoint string) string {
    if endpoint == "" {
        return ""
    }
    if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
        return endpoint
    }
    // endpoint 格式为 ":8081" 或 "8081"
    if !strings.HasPrefix(endpoint, ":") {
        endpoint = ":" + endpoint
    }
    return "http://" + host + endpoint
}
```

#### 2.1.2 修改 AssignNode/AggrNode 端点注册

**当前问题**: 节点注册时只发送端口号（如 `:8081`），不包含 IP 地址。

**修改方案**: 保持现有逻辑不变，由 BootNode 在返回端点时动态构造完整 URL。

**原因**:
- 本地测试时，所有节点在同一台机器，IP 相同
- 生产环境时，可以在注册时包含完整 IP:Port
- 这样可以兼容两种场景

#### 2.1.3 ComNode 端点查询

ComNode 是全局唯一的（Leader 节点），需要单独的查询接口：

**接口**: `GET /api/v1/committee/endpoint`

**响应**:
```json
{
  "success": true,
  "endpoint": "http://localhost:8083",
  "leaderID": "...",
  "committeeID": "..."
}
```

#### 2.1.4 路由注册

在 `registerRoutes()` 中添加新路由：

```go
// 服务发现接口（BootNode 专用）
g.Router.HandleFunc("/api/v1/groups/{groupID}/endpoints", g.handleGetGroupEndpoints).Methods("GET", "OPTIONS")
g.Router.HandleFunc("/api/v1/committee/endpoint", g.handleGetCommitteeEndpoint).Methods("GET", "OPTIONS")
```

---

### 2.2 前端修改 (TransferAreaInterface)

#### 2.2.1 修改 JoinedGroup 类型

**文件**: `js/utils/storage.ts`

```typescript
/**
 * 已加入的担保组织信息
 */
export interface JoinedGroup {
  groupID: string;
  groupName?: string;
  joinTime: number;
  
  // 新增：节点端点信息
  endpoints: {
    assign: string;  // AssignNode 端点，如 "http://localhost:8081"
    aggr: string;    // AggrNode 端点，如 "http://localhost:8082"
  };
  
  // 组织详细信息（可选）
  groupInfo?: {
    peerGroupID: string;
    aggrID: string;
    assiID: string;
    pledgeAddress: string;
  };
}
```

#### 2.2.2 新增端点查询服务

**文件**: `js/services/endpoints.ts` (新建)

```typescript
/**
 * Endpoint Discovery Service
 * 
 * 从 BootNode 查询担保组织的节点端点信息
 */

import { apiClient } from './api';

/**
 * 端点信息响应
 */
interface EndpointsResponse {
  success: boolean;
  groupID: string;
  endpoints: {
    assign: string;
    aggr: string;
  };
  groupInfo?: {
    peerGroupID: string;
    aggrID: string;
    assiID: string;
    pledgeAddress: string;
  };
}

/**
 * 查询担保组织的节点端点
 * 
 * @param groupID 担保组织 ID
 * @returns 端点信息
 */
export async function queryGroupEndpoints(groupID: string): Promise<EndpointsResponse> {
  // 这个请求发到 BootNode
  const response = await apiClient.get<EndpointsResponse>(
    `/api/v1/groups/${groupID}/endpoints`
  );
  
  if (!response.success) {
    throw new Error('Failed to query group endpoints');
  }
  
  return response;
}

/**
 * 查询 ComNode 端点
 */
export async function queryCommitteeEndpoint(): Promise<string> {
  const response = await apiClient.get<{
    success: boolean;
    endpoint: string;
  }>('/api/v1/committee/endpoint');
  
  if (!response.success || !response.endpoint) {
    throw new Error('Failed to query committee endpoint');
  }
  
  return response.endpoint;
}
```

#### 2.2.3 修改加入组织流程

**文件**: `js/services/group.ts`

```typescript
import { queryGroupEndpoints } from './endpoints';
import { saveJoinedGroup } from '../utils/storage';

/**
 * 加入担保组织（完整流程）
 */
export async function joinGroup(groupID: string, ...): Promise<void> {
  // 1. 先查询端点信息
  const endpointsInfo = await queryGroupEndpoints(groupID);
  
  // 2. 发送加入请求（直接发到 AssignNode）
  const joinResponse = await fetch(`${endpointsInfo.endpoints.assign}/api/v1/${groupID}/assign/flow-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(joinRequest)
  });
  
  // 3. 保存组织信息（包含端点）
  saveJoinedGroup({
    groupID,
    joinTime: Date.now(),
    endpoints: endpointsInfo.endpoints,
    groupInfo: endpointsInfo.groupInfo
  });
}
```

#### 2.2.4 修改 API 客户端

**文件**: `js/services/api.ts`

新增支持动态基地址的方法：

```typescript
/**
 * 发送请求到指定端点
 * 
 * @param baseUrl 目标端点基地址
 * @param path 请求路径
 * @param options 请求选项
 */
export async function fetchFromEndpoint<T>(
  baseUrl: string,
  path: string,
  options?: RequestOptions
): Promise<T> {
  const url = `${baseUrl}${path}`;
  return apiClient.request<T>(url, options);
}
```

#### 2.2.5 修改各服务模块

**文件**: `js/services/accountPolling.ts`

```typescript
import { getJoinedGroup } from '../utils/storage';

async function pollAccountUpdates(): Promise<void> {
  const group = getJoinedGroup();
  if (!group?.endpoints?.assign) {
    console.warn('[AccountPolling] No assign endpoint configured');
    return;
  }
  
  // 直接发到 AssignNode
  const endpoint = `${group.endpoints.assign}/api/v1/${group.groupID}/assign/account-update`;
  const response = await fetch(endpoint + `?userID=${user.accountId}&consume=true`);
  // ...
}
```

**需要修改的服务模块列表**:

| 模块 | 文件 | 目标节点 |
|------|------|---------|
| 账户轮询 | `accountPolling.ts` | AssignNode |
| 交易构建 | `txBuilder.ts` | AssignNode |
| 地址管理 | `address.ts` | AssignNode |
| 转账服务 | `transfer.ts` | AssignNode |
| 账户查询 | `accountQuery.ts` | ComNode |
| 组织服务 | `group.ts` | AssignNode |

#### 2.2.6 修改 API 配置

**文件**: `js/config/api.ts`

```typescript
/**
 * BootNode 基地址（仅用于服务发现）
 */
export const BOOTNODE_URL = 'http://localhost:8080';

/**
 * API 端点路径（相对路径，需要配合具体节点端点使用）
 */
export const API_PATHS = {
  // AssignNode 路径
  ASSIGN: {
    HEALTH: (groupId: string) => `/api/v1/${groupId}/assign/health`,
    NEW_ADDRESS: (groupId: string) => `/api/v1/${groupId}/assign/new-address`,
    FLOW_APPLY: (groupId: string) => `/api/v1/${groupId}/assign/flow-apply`,
    SUBMIT_TX: (groupId: string) => `/api/v1/${groupId}/assign/submit-tx`,
    ACCOUNT_UPDATE: (groupId: string) => `/api/v1/${groupId}/assign/account-update`,
    // ...
  },
  
  // AggrNode 路径
  AGGR: {
    TXCER_NEW: (groupId: string) => `/api/v1/${groupId}/aggr/txcer-new`,
  },
  
  // ComNode 路径
  COM: {
    QUERY_ADDRESS: '/api/v1/com/query-address',
    QUERY_ADDRESS_GROUP: '/api/v1/com/query-address-group',
  },
  
  // BootNode 路径（服务发现）
  BOOT: {
    GROUP_ENDPOINTS: (groupId: string) => `/api/v1/groups/${groupId}/endpoints`,
    COMMITTEE_ENDPOINT: '/api/v1/committee/endpoint',
  }
} as const;
```

---

## 3. 数据流变化

### 3.1 用户加入组织流程

```
【之前】
1. Frontend -> BootNode:8080 -> AssignNode (转发)
2. 保存 groupID

【之后】
1. Frontend -> BootNode:8080 (查询端点)
2. Frontend -> AssignNode:8081 (直连加入)
3. 保存 groupID + endpoints
```

### 3.2 账户更新轮询流程

```
【之前】
Frontend -> BootNode:8080 -> AssignNode (每次都转发)

【之后】
Frontend -> AssignNode:8081 (直连，不经过 BootNode)
```

### 3.3 交易提交流程

```
【之前】
Frontend -> BootNode:8080 -> AssignNode (转发)

【之后】
Frontend -> AssignNode:8081 (直连)
```

---

## 4. 兼容性考虑

### 4.1 端点缓存与刷新

- 端点信息保存在 `localStorage`，随组织信息一起存储
- 用户重新登录时，如果端点信息缺失，自动查询并补充
- 提供手动刷新端点的功能（应对节点重启端口变化）

### 4.2 端点失效处理

```typescript
async function callAssignNode(path: string, options?: RequestOptions) {
  const group = getJoinedGroup();
  
  try {
    return await fetch(`${group.endpoints.assign}${path}`, options);
  } catch (error) {
    if (isNetworkError(error)) {
      // 端点可能失效，尝试重新查询
      const newEndpoints = await queryGroupEndpoints(group.groupID);
      updateJoinedGroupEndpoints(newEndpoints.endpoints);
      
      // 重试
      return await fetch(`${newEndpoints.endpoints.assign}${path}`, options);
    }
    throw error;
  }
}
```

### 4.3 向后兼容

- 保留 BootNode 的转发逻辑（作为 fallback）
- 前端检测到端点信息缺失时，可以回退到通过 BootNode 转发

---

## 5. 实施计划

### Phase 1: 后端修改

1. [ ] 添加 `/api/v1/groups/{groupID}/endpoints` 接口
2. [ ] 添加 `/api/v1/committee/endpoint` 接口
3. [ ] 确保 AssignNode/AggrNode 正确注册端点
4. [ ] 测试端点查询功能

### Phase 2: 前端基础设施

1. [ ] 修改 `JoinedGroup` 类型，添加 `endpoints` 字段
2. [ ] 新建 `endpoints.ts` 服务模块
3. [ ] 修改 `api.ts`，支持动态基地址
4. [ ] 修改 `api.ts` 配置，区分路径和完整 URL

### Phase 3: 前端服务迁移

1. [ ] 修改 `group.ts` - 加入/退出组织
2. [ ] 修改 `accountPolling.ts` - 账户更新轮询
3. [ ] 修改 `txBuilder.ts` - 交易构建和状态查询
4. [ ] 修改 `address.ts` - 地址管理
5. [ ] 修改 `transfer.ts` - 转账服务
6. [ ] 修改 `accountQuery.ts` - 账户查询（ComNode）

### Phase 4: 测试与优化

1. [ ] 端到端测试
2. [ ] 端点失效恢复测试
3. [ ] 性能对比测试
4. [ ] 文档更新

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 节点重启导致端口变化 | 前端无法连接 | 自动重新查询端点 |
| 端点查询失败 | 无法加入组织 | 回退到 BootNode 转发 |
| 跨域问题 | 浏览器阻止请求 | 各节点 Gateway 配置 CORS |
| 端点信息过期 | 请求失败 | 定期刷新 + 失败重试 |

---

## 7. 附录

### 7.1 受影响的文件清单

**后端 (UTXO-Area)**:
- `gateway/server.go` - 添加端点查询接口
- `Bootstrap/gateway.go` - 可能需要辅助方法

**前端 (TransferAreaInterface)**:
- `js/utils/storage.ts` - 修改 JoinedGroup 类型
- `js/config/api.ts` - 修改 API 配置
- `js/services/api.ts` - 支持动态基地址
- `js/services/endpoints.ts` - 新建端点查询服务
- `js/services/group.ts` - 修改加入组织流程
- `js/services/accountPolling.ts` - 直连 AssignNode
- `js/services/txBuilder.ts` - 直连 AssignNode
- `js/services/address.ts` - 直连 AssignNode
- `js/services/transfer.ts` - 直连 AssignNode
- `js/services/accountQuery.ts` - 直连 ComNode

### 7.2 API 端点汇总

| 接口 | 方法 | 节点 | 用途 |
|------|------|------|------|
| `/api/v1/groups/{groupID}/endpoints` | GET | BootNode | 查询组织端点 |
| `/api/v1/committee/endpoint` | GET | BootNode | 查询 ComNode 端点 |
| `/api/v1/{groupID}/assign/*` | * | AssignNode | 组织业务接口 |
| `/api/v1/{groupID}/aggr/*` | * | AggrNode | 聚合节点接口 |
| `/api/v1/com/*` | * | ComNode | 委员会接口 |
