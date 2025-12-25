# 查询地址所属担保组织（query-address-group）前端对接指南

> 目标：前端通过 HTTP/Gateway 调用 ComNode 的"查询地址所属担保组织"接口，批量查询一个或多个钱包地址所属的担保组织信息。

---

## 接口信息

- **方法**：`POST`
- **路径**：`/api/v1/com/query-address-group`
- **说明**：
  - 该接口由 ComNode（委员会节点）的 **Leader 节点** 提供
  - 支持批量查询多个地址
  - **无需签名**，纯查询接口

---

## 前置条件：获取 ComNode API 端口

由于 ComNode 启动时动态分配端口，前端需要先通过 BootNode 查询 ComNode 的 API 端点。

### 步骤 1：查询 ComNode 端口（已完成）

```
GET http://localhost:8080/api/v1/committee/endpoint
```

**响应示例**：
```json
{
    "success": true,
    "endpoint": ":8081",
    "message": "ComNode (Leader) API endpoint"
}
```

### 步骤 2：拼接完整地址

```typescript
// 假设 BootNode 返回 endpoint = ":8081"
const bootNodeHost = "localhost";  // 或实际部署的主机地址
const comNodeEndpoint = ":8081";
const comNodeBaseURL = `http://${bootNodeHost}${comNodeEndpoint}`;
// 结果：http://localhost:8081
```

---

## 请求结构

### 请求体（JSON）

```json
{
    "address": ["地址1", "地址2", "地址3"]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| **address** | string[] | 是 | 要查询的钱包地址列表（40位十六进制字符串） |

### 请求示例

```json
{
    "address": [
        "0cb3e0ee7ce34c26f2221a39bcf8df7150742d96",
        "2980543afa6edc9b674244d71b1fd80f0301e64a"
    ]
}
```

---

## 响应结构

### 后端 Go 定义

```go
// UserQueryAddressGuarGroupReply 用户查询地址所属担保组织返回
type UserQueryAddressGuarGroupReply struct {
    UserID         string // 用户id（Gateway 调用时为空）
    Addresstogroup map[string]struct {
        GroupID   string       // 担保组织ID
        PublicKey PublicKeyNew // 地址公钥
    }
}

// PublicKeyNew 公钥结构
type PublicKeyNew struct {
    CurveName string   // 曲线名称，固定为 "P256"
    X         *big.Int // 公钥X坐标
    Y         *big.Int // 公钥Y坐标
}
```

### TypeScript 类型定义

```typescript
/** P-256 公钥 */
interface PublicKeyNew {
    CurveName: string;  // 固定为 "P256"
    X: number;          // big.Int，JSON 中为数字
    Y: number;
}

/** 单个地址的查询结果 */
interface AddressGroupInfo {
    GroupID: string;        // 担保组织ID（特殊值见下表）
    PublicKey: PublicKeyNew; // 地址公钥
}

/** 查询响应 */
interface QueryAddressGroupResponse {
    UserID: string;  // Gateway 调用时为空字符串
    Addresstogroup: Record<string, AddressGroupInfo>;  // 地址 -> 组织信息
}
```

### GroupID 特殊值说明

| GroupID 值 | 含义 | 说明 |
|-----------|------|------|
| `"0"` | 地址不存在 | 该地址从未在链上出现过 |
| `"1"` | 散户地址 | 地址存在但未加入任何担保组织 |
| 其他（如 `"10000000"`） | 担保组织ID | 地址已加入该担保组织 |

---

## 响应示例

### 成功响应（HTTP 200）

```json
{
    "UserID": "",
    "Addresstogroup": {
        "0cb3e0ee7ce34c26f2221a39bcf8df7150742d96": {
            "GroupID": "10000000",
            "PublicKey": {
                "CurveName": "P256",
                "X": 12345678901234567890,
                "Y": 98765432109876543210
            }
        },
        "2980543afa6edc9b674244d71b1fd80f0301e64a": {
            "GroupID": "1",
            "PublicKey": {
                "CurveName": "P256",
                "X": 11223344556677889900,
                "Y": 99887766554433221100
            }
        },
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": {
            "GroupID": "0",
            "PublicKey": {
                "CurveName": "",
                "X": 0,
                "Y": 0
            }
        }
    }
}
```

### 错误响应

| HTTP 状态码 | 错误信息 | 说明 |
|------------|---------|------|
| 400 | `Invalid request body` | 请求体格式错误 |
| 503 | `ComNode (Leader) not registered` | ComNode 未注册到 Gateway |
| 503 | `not leader node, please retry later` | 当前节点不是 Leader |

**错误响应格式**：
```json
{
    "error": "错误信息"
}
```

---

## 完整调用流程

### 流程图

```
前端应用
    │
    ├─① GET /api/v1/committee/endpoint ──────────► BootNode (8080)
    │                                                    │
    │◄─────────────── {"endpoint": ":8081"} ─────────────┘
    │
    ├─② POST /api/v1/com/query-address-group ────► ComNode (8081)
    │   Body: {"address": ["addr1", "addr2"]}            │
    │                                                    │
    │                                              ┌─────┴─────┐
    │                                              │ 区块链存储 │
    │                                              │ StoragePoint │
    │                                              └─────┬─────┘
    │                                                    │
    │◄─────────────── 返回地址组织信息 ──────────────────┘
```

### TypeScript 实现示例

```typescript
/**
 * 查询地址所属担保组织
 * 
 * @param addresses - 要查询的地址列表
 * @param bootNodeURL - BootNode 地址（默认 http://localhost:8080）
 * @returns 地址到担保组织的映射
 */
async function queryAddressGroup(
    addresses: string[],
    bootNodeURL: string = 'http://localhost:8080'
): Promise<QueryAddressGroupResponse> {
    
    // Step 1: 获取 ComNode API 端点
    const endpointResp = await fetch(`${bootNodeURL}/api/v1/committee/endpoint`);
    if (!endpointResp.ok) {
        throw new Error('Failed to get ComNode endpoint');
    }
    const endpointData = await endpointResp.json();
    
    if (!endpointData.success || !endpointData.endpoint) {
        throw new Error(endpointData.error || 'ComNode endpoint not available');
    }
    
    // Step 2: 拼接 ComNode 完整地址
    // endpoint 格式为 ":8081"，需要拼接主机名
    const bootNodeHost = new URL(bootNodeURL).hostname;
    const comNodeURL = `http://${bootNodeHost}${endpointData.endpoint}`;
    
    // Step 3: 调用查询接口
    const queryResp = await fetch(`${comNodeURL}/api/v1/com/query-address-group`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: addresses })
    });
    
    if (!queryResp.ok) {
        const errorData = await queryResp.json();
        throw new Error(errorData.error || 'Query failed');
    }
    
    return await queryResp.json();
}

// 使用示例
async function example() {
    try {
        const result = await queryAddressGroup([
            '0cb3e0ee7ce34c26f2221a39bcf8df7150742d96',
            '2980543afa6edc9b674244d71b1fd80f0301e64a'
        ]);
        
        // 解析结果
        for (const [address, info] of Object.entries(result.Addresstogroup)) {
            if (info.GroupID === '0') {
                console.log(`${address}: 地址不存在`);
            } else if (info.GroupID === '1') {
                console.log(`${address}: 散户（未加入担保组织）`);
            } else {
                console.log(`${address}: 已加入担保组织 ${info.GroupID}`);
            }
        }
    } catch (error) {
        console.error('查询失败:', error);
    }
}
```

---

## 典型使用场景

### 场景 1：转账前验证收款地址

在用户发起转账前，查询收款地址是否有效及其所属组织：

```typescript
async function validateReceiverAddress(receiverAddress: string): Promise<{
    isValid: boolean;
    groupID: string | null;
    publicKey: PublicKeyNew | null;
    message: string;
}> {
    const result = await queryAddressGroup([receiverAddress]);
    const info = result.Addresstogroup[receiverAddress];
    
    if (!info || info.GroupID === '0') {
        return {
            isValid: false,
            groupID: null,
            publicKey: null,
            message: '收款地址不存在，请检查地址是否正确'
        };
    }
    
    if (info.GroupID === '1') {
        return {
            isValid: true,
            groupID: null,  // 散户没有组织ID
            publicKey: info.PublicKey,
            message: '收款地址有效（散户地址）'
        };
    }
    
    return {
        isValid: true,
        groupID: info.GroupID,
        publicKey: info.PublicKey,
        message: `收款地址有效，所属担保组织: ${info.GroupID}`
    };
}
```

### 场景 2：批量查询用户所有地址状态

```typescript
async function checkUserAddresses(userAddresses: string[]): Promise<void> {
    const result = await queryAddressGroup(userAddresses);
    
    const summary = {
        total: userAddresses.length,
        inGroup: 0,
        retail: 0,      // 散户
        notFound: 0
    };
    
    for (const [address, info] of Object.entries(result.Addresstogroup)) {
        switch (info.GroupID) {
            case '0':
                summary.notFound++;
                break;
            case '1':
                summary.retail++;
                break;
            default:
                summary.inGroup++;
                break;
        }
    }
    
    console.log('地址状态统计:', summary);
}
```

### 场景 3：获取收款地址公钥（用于构造交易）

构造交易时需要收款地址的公钥，可通过此接口获取：

```typescript
async function getReceiverPublicKey(receiverAddress: string): Promise<PublicKeyNew> {
    const result = await queryAddressGroup([receiverAddress]);
    const info = result.Addresstogroup[receiverAddress];
    
    if (!info || info.GroupID === '0') {
        throw new Error('收款地址不存在');
    }
    
    // 检查公钥是否有效
    if (!info.PublicKey.X || !info.PublicKey.Y) {
        throw new Error('收款地址公钥无效');
    }
    
    return info.PublicKey;
}
```

---

## 注意事项

1. **端口动态获取**：ComNode 端口不是固定的，每次调用前建议先查询 BootNode 获取最新端口（或缓存一段时间）。

2. **Leader 节点限制**：只有 Leader 节点才能响应查询请求，如果返回 503 错误，可能是 Leader 切换中，稍后重试即可。

3. **地址格式**：地址必须是 40 位十六进制字符串（不带 `0x` 前缀）。

4. **批量查询**：支持一次查询多个地址，建议合并请求减少网络开销。

5. **公钥格式**：返回的 `PublicKey.X` 和 `PublicKey.Y` 是 `big.Int` 类型，在 JSON 中表示为数字。

---

## 与其他接口的关系

| 接口 | 用途 | 调用时机 |
|-----|------|---------|
| `GET /api/v1/committee/endpoint` | 获取 ComNode 端口 | 调用 ComNode 接口前 |
| `POST /api/v1/com/query-address` | 查询地址余额信息 | 需要余额、利息等详细信息时 |
| `POST /api/v1/com/query-address-group` | 查询地址所属组织 | 验证地址有效性、获取公钥时 |
| `POST /api/v1/{groupID}/assign/submit-tx` | 提交交易 | 构造交易后提交 |

---

## 调试建议

1. **先测试 BootNode 连通性**：确保能访问 `GET /api/v1/committee/endpoint`

2. **检查 ComNode 是否启动**：如果返回 `ComNode (Leader) not registered`，说明 ComNode 未启动或未注册

3. **验证地址格式**：确保地址是 40 位十六进制，不带 `0x` 前缀

4. **查看 Gateway 日志**：后端日志会记录详细的请求和错误信息
