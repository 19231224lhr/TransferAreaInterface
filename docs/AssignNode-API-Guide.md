# AssignNode API 前端对接文档

> 本文档面向前端开发人员，介绍如何对接 AssignNode 的 6 个 HTTP API 接口。

---

## 基础信息

| 项目 | 说明 |
|------|------|
| BootNode 基础 URL | `http://localhost:8080`（开发环境，生产环境另行通知） |
| AssignNode URL | **动态获取**，通过 BootNode 查询担保组织信息获得 |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 跨域 | 已启用 CORS，支持所有来源 |

### ⚠️ 重要：端口是动态的

**AssignNode 的端口不是固定的**，每个担保组织的 AssignNode 可能运行在不同端口。

前端需要先通过 **BootNode** 查询担保组织信息，获取 `AssignAPIEndpoint` 字段：

```
1. 调用 BootNode: GET http://localhost:8080/api/v1/groups/{groupID}
2. 从返回的 AssignAPIEndpoint 字段获取端口（如 ":8081"）
3. 拼接完整 URL: http://localhost:8081/api/v1/{groupID}/assign/xxx
```

### 服务发现流程（只需一次）

用户选择或加入担保组织时，**只需查询一次** BootNode，然后将端口信息**缓存到前端本地**：

```typescript
// 1. 用户选择担保组织时，查询一次 BootNode
const bootNodeUrl = 'http://localhost:8080';
const groupId = '10000000';

const groupInfo = await fetch(`${bootNodeUrl}/api/v1/groups/${groupId}`)
    .then(r => r.json());

// 2. 获取 AssignNode 端口并缓存到本地
const assignEndpoint = groupInfo.AssignAPIEndpoint;  // 例如 ":8081"
const assignNodeUrl = `http://localhost${assignEndpoint}`;

// 3. 保存到前端状态管理（localStorage / Redux / Vuex 等）
localStorage.setItem('assignNodeUrl', assignNodeUrl);
localStorage.setItem('groupId', groupId);

// 4. 后续所有请求直接使用缓存的 URL，无需重复查询
const cachedUrl = localStorage.getItem('assignNodeUrl');
const healthUrl = `${cachedUrl}/api/v1/${groupId}/assign/health`;
```

### BootNode 返回示例

```json
// GET http://localhost:8080/api/v1/groups/10000000
{
    "GroupID": "10000000",
    "PeerGroupID": "12D3KooW...",
    "AssiPeerID": "12D3KooW...",
    "AggrPeerID": "12D3KooW...",
    "AssignAPIEndpoint": ":8081",    // ← AssignNode 端口
    "AggrAPIEndpoint": ":8082",      // ← AggregationNode 端口
    "GuarTable": { ... }
}
```

### 路由规则

所有 AssignNode 接口采用**动态路由**设计：

```
http://localhost{AssignAPIEndpoint}/api/v1/{groupID}/assign/xxx
```

- `{AssignAPIEndpoint}` 从 BootNode 查询获得（如 `:8081`）
- `{groupID}` 是担保组织 ID（如 `10000000`）

---

## ⚠️ 重要：密钥与签名说明

### 密钥体系

本系统使用 **ECDSA P-256（secp256r1）** 椭圆曲线签名算法。用户有两套密钥：

| 密钥类型 | 用途 | 说明 |
|----------|------|------|
| **账户密钥（AccountKey）** | 身份认证 | 用于加入/退出组织、重新上线等身份相关操作 |
| **地址密钥（AddressKey）** | 资产操作 | 每个子地址有独立的密钥对，用于交易签名 |

### 公钥格式（PublicKeyNew）

```json
{
    "CurveName": "P256",
    "X": 12345678901234567890,
    "Y": 98765432109876543210
}
```

⚠️ **重要**：`X` 和 `Y` 必须是**数字格式**（不带引号），不能是字符串！

**Hex 字符串格式**：`{X的hex}&{Y的hex}`

示例：
```
6d3c84f78f75e51cf7129a65ab1b2bdf37d1782a7bc106a010ab8d7c813bd084&cb0f627365c72b0f9ed7fe9e6b3b3519c7b54ef4f31bead11542141845e0b871
```

### 签名格式（EcdsaSignature）

```json
{
    "R": 12345678901234567890,
    "S": 98765432109876543210
}
```

⚠️ **重要**：`R` 和 `S` 必须是**数字格式**（不带引号），不能是字符串！
```

### 签名流程（核心！）

后端使用 `SignStruct` 方法对结构体签名，流程如下：

```
1. 将结构体转为 JSON（排除签名字段）
2. 对 JSON 字节数组计算 SHA-256 哈希
3. 使用 ECDSA 私钥对哈希值签名
4. 返回 (R, S) 签名对
```

**关键点**：
- 签名时**排除签名字段本身**（如 `Sig`、`UserSig`）
- 使用 **JSON 序列化**（不是 gob）
- 哈希算法：**SHA-256**
- 签名算法：**ECDSA P-256**

---

## 接口列表

| 序号 | 接口 | 方法 | 功能 | 需要签名 |
|------|------|------|------|----------|
| 1 | `/api/v1/{groupID}/assign/health` | GET | 健康检查 | ❌ |
| 2 | `/api/v1/{groupID}/assign/new-address` | POST | 用户新建子地址 | ✅ 账户私钥 |
| 3 | `/api/v1/{groupID}/assign/flow-apply` | POST | 用户加入/退出担保组织 | ✅ 账户私钥 |
| 4 | `/api/v1/{groupID}/assign/submit-tx` | POST | 用户提交交易 | ✅ 地址私钥 |
| 5 | `/api/v1/{groupID}/assign/re-online` | POST | 用户重新上线（登录） | ✅ 账户私钥 |
| 6 | `/api/v1/{groupID}/assign/group-info` | GET | 查询担保组织信息 | ❌ |

---

## 1. 健康检查

检查指定担保组织的 AssignNode 是否在线。**无需签名**。

### 请求

```
GET /api/v1/{groupID}/assign/health
```

### 响应

**成功（200）：**
```json
{
    "status": "ok",
    "group_id": "10000000",
    "message": "AssignNode is running"
}
```

**未找到（404）：**
```json
{
    "status": "not_found",
    "group_id": "10000000",
    "message": "AssignNode for GuarGroup '10000000' not registered"
}
```

---

## 2. 用户新建子地址

用户在担保组织内创建新的钱包子地址。

### 签名要求

- **签名私钥**：账户私钥（AccountPrivateKey）
- **排除字段**：`Sig`
- **签名对象**：整个请求体（不含 `Sig` 字段）

### 请求

```
POST /api/v1/{groupID}/assign/new-address
Content-Type: application/json
```

### 请求体

```json
{
    "NewAddress": "abc123def456789012345678901234567890",
    "PublicKeyNew": {
        "CurveName": "P256",
        "X": 12345678901234567890,
        "Y": 98765432109876543210
    },
    "UserID": "12345678",
    "Type": 0,
    "Sig": {
        "R": 12345678901234567890,
        "S": 98765432109876543210
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| NewAddress | string | 是 | 新地址 = SHA256(公钥字节).hex[:40] |
| PublicKeyNew | object | 是 | 新地址的 ECDSA P-256 公钥 |
| UserID | string | 是 | 用户 ID（8位数字） |
| Type | int | 是 | 地址类型：0=盘古币，1=比特币，2=以太坊 |
| Sig | object | 是 | **账户私钥**对请求的签名 |

### 地址生成算法

```typescript
// 1. 将公钥序列化为字节数组（椭圆曲线点编码）
const pubKeyBytes = elliptic.Marshal(curve, publicKey.X, publicKey.Y);
// 2. 计算 SHA-256 哈希
const hash = sha256(pubKeyBytes);
// 3. 取前 20 字节的 hex 字符串（40 字符）
const address = hash.slice(0, 40);
```

### 响应

**成功（200）：**
```json
{
    "success": true,
    "message": "Address created successfully"
}
```

---

## 3. 用户加入/退出担保组织

用户申请加入或退出某个担保组织。

### 签名要求

- **签名私钥**：账户私钥（AccountPrivateKey）
- **排除字段**：`UserSig`
- **签名对象**：整个请求体（不含 `UserSig` 字段）

### 请求

```
POST /api/v1/{groupID}/assign/flow-apply
Content-Type: application/json
```

### 请求体（加入组织）

```json
{
    "Status": 1,
    "UserID": "12345678",
    "UserPeerID": "",
    "GuarGroupID": "10000000",
    "UserPublicKey": {
        "CurveName": "P256",
        "X": 12345678901234567890,
        "Y": 98765432109876543210
    },
    "AddressMsg": {
        "abc123def456789012345678901234567890": {
            "AddressData": {
                "PublicKeyNew": {
                    "CurveName": "P256",
                    "X": 11111111111111111111,
                    "Y": 22222222222222222222
                }
            }
        }
    },
    "TimeStamp": 157680000,
    "UserSig": {
        "R": 12345678901234567890,
        "S": 98765432109876543210
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| Status | int | 是 | 操作类型：1=加入，0=退出 |
| UserID | string | 是 | 用户 ID（8位数字） |
| UserPeerID | string | 否 | P2P 节点 ID（HTTP 调用填空字符串） |
| GuarGroupID | string | 是 | 目标担保组织 ID |
| UserPublicKey | object | 是 | 用户账户公钥 |
| AddressMsg | object | 是 | 申请担保的地址信息（加入时必填，退出时可为空 `{}`） |
| TimeStamp | uint64 | 是 | 时间戳（秒），**5分钟内有效** |
| UserSig | object | 是 | **账户私钥**签名 |

### ⚠️ 时间戳说明

时间戳使用**自定义起始时间**（2020年1月1日 UTC）计算：

```typescript
// 后端 Go 代码
customStartTime := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
duration := currentTime.Sub(customStartTime)
timestamp := uint64(duration.Seconds())

// 前端 TypeScript 实现
function getTimestamp(): number {
    const customStartTime = new Date('2020-01-01T00:00:00Z').getTime();
    const currentTime = Date.now();
    return Math.floor((currentTime - customStartTime) / 1000);
}
```

### 响应

**成功（200）：**
```json
{
    "status": 1,
    "user_id": "12345678",
    "guar_group_id": "10000000",
    "result": true,
    "message": "Successfully joined the guarantor group"
}
```

---

## 4. 用户提交交易

用户提交转账交易到担保组织。

### 签名要求

交易签名比较复杂，涉及多个层级：

1. **交易输入签名**：每个 UTXO 输入需要用对应**地址私钥**签名
2. **交易整体签名**：用第一个输入地址的**地址私钥**签名
3. **请求签名**：用**账户私钥**签名整个 UserNewTX 结构

### 请求

```
POST /api/v1/{groupID}/assign/submit-tx
Content-Type: application/json
```

### 请求体

```json
{
    "TX": {
        "TXID": "交易哈希hex",
        "TXType": 0,
        "Version": "1.0",
        "GuarantorGroup": "10000000",
        "TXInputsNormal": [
            {
                "FromTXID": "前置交易ID",
                "FromTxPosition": {
                    "Blocknum": 100,
                    "IndexX": 0,
                    "IndexY": 0,
                    "IndexZ": 0
                },
                "FromAddress": "发送地址",
                "TXOutputHash": "输出哈希bytes",
                "InputSignature": {
                    "R": 12345678901234567890,
                    "S": 98765432109876543210
                },
                "IsGuarMake": false
            }
        ],
        "TXOutputs": [
            {
                "ToAddress": "接收地址",
                "ToValue": 100.0,
                "ToGuarGroupID": "10000000",
                "ToPublicKey": {
                    "CurveName": "P256",
                    "X": 12345678901234567890,
                    "Y": 98765432109876543210
                },
                "Type": 0
            }
        ],
        "UserSignature": {
            "R": 12345678901234567890,
            "S": 98765432109876543210
        }
    },
    "UserID": "12345678",
    "Sig": {
        "R": 12345678901234567890,
        "S": 98765432109876543210
    }
}
```

### 交易签名流程

```typescript
// 1. 对每个 UTXO 输入签名
for (const input of tx.TXInputsNormal) {
    // 获取对应输出的哈希
    const outputHash = getOutputHash(input.FromTXID, input.FromTxPosition);
    input.TXOutputHash = outputHash;
    
    // 用该地址的私钥签名
    const addressPrivateKey = getAddressPrivateKey(input.FromAddress);
    input.InputSignature = ecdsaSign(addressPrivateKey, outputHash);
}

// 2. 计算交易哈希作为 TXID
tx.TXID = sha256(serializeTransaction(tx));

// 3. 交易整体签名（用第一个输入地址的私钥）
const firstAddressKey = getAddressPrivateKey(tx.TXInputsNormal[0].FromAddress);
tx.UserSignature = signStruct(tx, firstAddressKey, ['UserSignature']);

// 4. 构造 UserNewTX 并用账户私钥签名
const userNewTX = { TX: tx, UserID: userId };
userNewTX.Sig = signStruct(userNewTX, accountPrivateKey, ['Sig', 'Height']);
```

### 响应

**成功（200）：**
```json
{
    "success": true,
    "tx_id": "交易ID的hex字符串"
}
```

---

## 5. 用户重新上线（登录）

用户启动钱包后，向后端同步账户状态。

### 签名要求

- **签名私钥**：账户私钥（AccountPrivateKey）
- **排除字段**：`Sig`
- **签名对象**：整个请求体（不含 `Sig` 字段）

### 请求

```
POST /api/v1/{groupID}/assign/re-online
Content-Type: application/json
```

### 请求体

```json
{
    "UserID": "12345678",
    "FromPeerID": "",
    "Address": ["地址1", "地址2"],
    "Sig": {
        "R": 12345678901234567890,
        "S": 98765432109876543210
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| UserID | string | 是 | 用户 ID（8位数字） |
| FromPeerID | string | 否 | P2P 节点 ID（HTTP 调用填空字符串） |
| Address | string[] | 是 | 用户的所有地址列表 |
| Sig | object | 是 | **账户私钥**签名 |

### 响应

**成功（200）：**
```json
{
    "UserID": "12345678",
    "IsInGroup": true,
    "GuarantorGroupID": "10000000",
    "GuarGroupBootMsg": {
        "PeerGroupID": "12D3KooW...",
        "AssiPeerID": "12D3KooW...",
        "AggrPeerID": "12D3KooW..."
    },
    "UserWalletData": {
        "Value": 1000.0,
        "SubAddressMsg": {
            "地址1": {
                "Value": 500.0,
                "Type": 0,
                "UTXO": {}
            }
        }
    }
}
```

---

## 6. 查询担保组织信息

查询指定担保组织的详细信息。**无需签名**。

### 请求

```
GET /api/v1/{groupID}/assign/group-info
```

### 响应

**成功（200）：**
```json
{
    "GuarGroupID": "10000000",
    "GroupMsg": {
        "PeerGroupID": "12D3KooW...",
        "AssiPeerID": "12D3KooW...",
        "AggrPeerID": "12D3KooW...",
        "GuarTable": {
            "担保人1": "PeerID1"
        },
        "AssignAPIEndpoint": ":8081",
        "AggrAPIEndpoint": ":8082"
    }
}
```

---

## TypeScript 签名实现

### 依赖库

```bash
npm install elliptic js-sha256 buffer
```

### 核心签名函数

```typescript
import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

// 使用 P-256 曲线（与后端一致）
const ec = new EC('p256');

// 公钥结构
interface PublicKeyNew {
    CurveName: string;  // 固定为 "P256"
    X: string;          // 大整数的十进制字符串
    Y: string;          // 大整数的十进制字符串
}

// 签名结构
interface EcdsaSignature {
    R: string;  // 大整数的十进制字符串
    S: string;  // 大整数的十进制字符串
}

/**
 * 对结构体进行签名（与后端 SignStruct 一致）
 * @param data 要签名的数据对象
 * @param privateKeyHex 私钥的 hex 字符串
 * @param excludeFields 签名时排除的字段名数组
 */
function signStruct(
    data: object, 
    privateKeyHex: string, 
    excludeFields: string[]
): EcdsaSignature {
    // 1. 创建数据副本并排除指定字段
    const dataCopy = { ...data };
    for (const field of excludeFields) {
        if (field in dataCopy) {
            // 将排除字段设为零值
            (dataCopy as any)[field] = getZeroValue((data as any)[field]);
        }
    }
    
    // 2. JSON 序列化（与后端 json.Marshal 一致）
    const jsonStr = JSON.stringify(dataCopy);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    
    // 3. 计算 SHA-256 哈希
    const hash = sha256.array(jsonBytes);
    
    // 4. 使用私钥签名
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');
    const signature = key.sign(hash);
    
    // 5. 返回签名（R, S 为十进制字符串）
    return {
        R: signature.r.toString(10),
        S: signature.s.toString(10)
    };
}

/**
 * 获取字段的零值（用于签名时排除字段）
 */
function getZeroValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return '';
    if (typeof value === 'number') return 0;
    if (typeof value === 'boolean') return false;
    if (Array.isArray(value)) return [];
    if (typeof value === 'object') {
        // 对于 EcdsaSignature 类型，返回 { R: null, S: null }
        if ('R' in value && 'S' in value) {
            return { R: null, S: null };
        }
        return {};
    }
    return null;
}

/**
 * 生成时间戳（与后端 GetTimestamp 一致）
 * 起始时间：2020-01-01 00:00:00 UTC
 */
function getTimestamp(): number {
    const customStartTime = new Date('2020-01-01T00:00:00Z').getTime();
    const currentTime = Date.now();
    return Math.floor((currentTime - customStartTime) / 1000);
}

/**
 * 从私钥生成公钥
 */
function getPublicKeyFromPrivate(privateKeyHex: string): PublicKeyNew {
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');
    const pubPoint = key.getPublic();
    return {
        CurveName: 'P256',
        X: pubPoint.getX().toString(10),
        Y: pubPoint.getY().toString(10)
    };
}

/**
 * 生成钱包地址
 * 地址 = SHA256(公钥字节).hex[:40]
 */
function generateAddress(publicKey: PublicKeyNew): string {
    // 将公钥编码为字节数组（未压缩格式：04 + X + Y）
    const xHex = BigInt(publicKey.X).toString(16).padStart(64, '0');
    const yHex = BigInt(publicKey.Y).toString(16).padStart(64, '0');
    const pubKeyHex = '04' + xHex + yHex;
    
    // 计算 SHA-256 哈希
    const hash = sha256(Buffer.from(pubKeyHex, 'hex'));
    
    // 取前 40 字符（20 字节）
    return hash.slice(0, 40);
}

/**
 * ⚠️ 重要：大整数 JSON 序列化
 * 后端 Go 的 big.Int 需要数字格式（不带引号），但 JS 的 JSON.stringify 
 * 会将大整数转为字符串。此函数移除 X/Y/R/S/D 字段值的引号。
 */
function serializeForBackend(obj: any): string {
    let json = JSON.stringify(obj);
    // 将 "X": "123..." 替换为 "X": 123...（移除大整数的引号）
    json = json.replace(/"(X|Y|R|S|D)":\s*"(\d+)"/g, '"$1":$2');
    return json;
}
```

### 使用示例

#### 前端状态管理（推荐方式）

前端应该在初始化时**查询一次**担保组织信息，然后**缓存到本地**，后续所有请求都使用缓存的 URL。

```typescript
// ==================== 前端状态管理 ====================

// 全局配置
const BOOT_NODE_URL = 'http://localhost:8080';

// 缓存的担保组织信息
interface GuarGroupCache {
    groupId: string;
    assignNodeUrl: string;      // AssignNode 完整 URL
    aggrNodeUrl: string;        // AggregationNode 完整 URL（备用）
    groupInfo: any;             // 完整的组织信息
}

// 全局缓存（实际项目中可以用 Redux/Vuex/Pinia 等状态管理）
let currentGroup: GuarGroupCache | null = null;

/**
 * 初始化：查询并缓存担保组织信息（只需调用一次）
 * 建议在用户选择担保组织或加入组织时调用
 */
async function initGuarGroup(groupId: string): Promise<GuarGroupCache> {
    const response = await fetch(`${BOOT_NODE_URL}/api/v1/groups/${groupId}`);
    
    if (!response.ok) {
        throw new Error(`担保组织 ${groupId} 不存在`);
    }
    
    const groupInfo = await response.json();
    const assignEndpoint = groupInfo.AssignAPIEndpoint;  // 例如 ":8081"
    const aggrEndpoint = groupInfo.AggrAPIEndpoint;      // 例如 ":8082"
    
    if (!assignEndpoint) {
        throw new Error(`担保组织 ${groupId} 的 AssignNode 未注册`);
    }
    
    // 拼接完整 URL
    const bootNodeHost = new URL(BOOT_NODE_URL).hostname;
    
    // 缓存到全局状态
    currentGroup = {
        groupId: groupId,
        assignNodeUrl: `http://${bootNodeHost}${assignEndpoint}`,
        aggrNodeUrl: aggrEndpoint ? `http://${bootNodeHost}${aggrEndpoint}` : '',
        groupInfo: groupInfo
    };
    
    console.log(`担保组织 ${groupId} 初始化成功`);
    console.log(`AssignNode URL: ${currentGroup.assignNodeUrl}`);
    
    return currentGroup;
}

/**
 * 获取当前缓存的 AssignNode URL
 * 如果未初始化则抛出错误
 */
function getAssignNodeUrl(): string {
    if (!currentGroup) {
        throw new Error('请先调用 initGuarGroup() 初始化担保组织信息');
    }
    return currentGroup.assignNodeUrl;
}

/**
 * 获取当前担保组织 ID
 */
function getCurrentGroupId(): string {
    if (!currentGroup) {
        throw new Error('请先调用 initGuarGroup() 初始化担保组织信息');
    }
    return currentGroup.groupId;
}

// ==================== 使用示例 ====================

// 1. 用户选择担保组织时，初始化一次
await initGuarGroup('10000000');

// 2. 后续所有请求直接使用缓存的 URL，无需重复查询
const url = getAssignNodeUrl();  // "http://localhost:8081"
const groupId = getCurrentGroupId();  // "10000000"
```

#### 加入担保组织

```typescript
async function joinGuarGroup(
    groupId: string,
    userId: string,
    accountPrivateKeyHex: string,
    addresses: Map<string, { privateKey: string; publicKey: PublicKeyNew }>
) {
    // 0. 初始化担保组织信息（首次加入时调用，会缓存到本地）
    await initGuarGroup(groupId);
    
    // 1. 获取账户公钥
    const userPublicKey = getPublicKeyFromPrivate(accountPrivateKeyHex);
    
    // 2. 构造地址信息
    const addressMsg: Record<string, any> = {};
    for (const [addr, keys] of addresses) {
        addressMsg[addr] = {
            AddressData: {
                PublicKeyNew: keys.publicKey
            }
        };
    }
    
    // 3. 构造请求体（不含签名）
    const flowMsg = {
        Status: 1,
        UserID: userId,
        UserPeerID: '',
        GuarGroupID: groupId,
        UserPublicKey: userPublicKey,
        AddressMsg: addressMsg,
        TimeStamp: getTimestamp(),
        UserSig: { R: null, S: null }  // 占位，签名时会被排除
    };
    
    // 4. 使用账户私钥签名
    flowMsg.UserSig = signStruct(flowMsg, accountPrivateKeyHex, ['UserSig']);
    
    // 5. 发送请求（使用缓存的 URL）
    const response = await fetch(
        `${getAssignNodeUrl()}/api/v1/${groupId}/assign/flow-apply`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flowMsg)
        }
    );
    
    return await response.json();
}
```

#### 用户登录

```typescript
async function userReOnline(
    userId: string,
    accountPrivateKeyHex: string,
    addresses: string[]
) {
    // 使用缓存的 URL 和 groupId（已在 initGuarGroup 时初始化）
    const groupId = getCurrentGroupId();
    
    // 1. 构造请求体
    const msg = {
        UserID: userId,
        FromPeerID: '',
        Address: addresses,
        Sig: { R: null, S: null }
    };
    
    // 2. 使用账户私钥签名
    msg.Sig = signStruct(msg, accountPrivateKeyHex, ['Sig']);
    
    // 3. 发送请求（使用缓存的 URL）
    const response = await fetch(
        `${getAssignNodeUrl()}/api/v1/${groupId}/assign/re-online`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
        }
    );
    
    return await response.json();
}
```

#### 新建子地址

```typescript
async function createNewAddress(
    userId: string,
    accountPrivateKeyHex: string,
    addressType: number = 0
) {
    // 使用缓存的 URL 和 groupId（已在 initGuarGroup 时初始化）
    const groupId = getCurrentGroupId();
    
    // 1. 生成新的地址密钥对
    const keyPair = ec.genKeyPair();
    const addressPrivateKeyHex = keyPair.getPrivate('hex');
    const addressPublicKey: PublicKeyNew = {
        CurveName: 'P256',
        X: keyPair.getPublic().getX().toString(10),
        Y: keyPair.getPublic().getY().toString(10)
    };
    
    // 2. 生成地址
    const newAddress = generateAddress(addressPublicKey);
    
    // 3. 构造请求体
    const msg = {
        NewAddress: newAddress,
        PublicKeyNew: addressPublicKey,
        UserID: userId,
        Type: addressType,
        Sig: { R: null, S: null }
    };
    
    // 4. 使用账户私钥签名
    msg.Sig = signStruct(msg, accountPrivateKeyHex, ['Sig']);
    
    // 5. 发送请求（使用缓存的 URL）
    const response = await fetch(
        `${getAssignNodeUrl()}/api/v1/${groupId}/assign/new-address`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
        }
    );
    
    const result = await response.json();
    
    if (result.success) {
        // 6. 本地保存地址私钥（重要！）
        console.log('新地址创建成功:', newAddress);
        console.log('请安全保存私钥:', addressPrivateKeyHex);
        
        return {
            address: newAddress,
            privateKey: addressPrivateKeyHex,
            publicKey: addressPublicKey
        };
    }
    
    throw new Error(result.error || 'Failed to create address');
}
```

---

## 错误码说明

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误（如签名验证失败、时间戳过期） |
| 401 | 认证失败（签名无效） |
| 404 | 资源不存在（担保组织或 AssignNode 未注册） |
| 500 | 服务器内部错误 |

---

## 常见问题

### Q1: 签名验证失败怎么办？

1. 检查是否使用了正确的私钥（账户私钥 vs 地址私钥）
2. 检查 JSON 序列化顺序是否与后端一致
3. 检查排除字段是否正确设置为零值
4. 检查大整数是否使用十进制字符串格式

### Q2: 时间戳过期怎么办？

时间戳有 5 分钟有效期。确保：
1. 使用正确的起始时间（2020-01-01 UTC）
2. 客户端时间与服务器时间同步
3. 签名后立即发送请求

### Q3: 如何调试签名问题？

1. 打印签名前的 JSON 字符串，与后端对比
2. 打印 SHA-256 哈希值，与后端对比
3. 使用相同的测试私钥在前后端分别签名，对比结果

---

## 联系方式

如有问题，请联系后端开发人员。
