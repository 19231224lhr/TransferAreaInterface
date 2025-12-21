# AssignNode API 前端对接文档

> 本文档面向前端开发人员，介绍如何对接 AssignNode 的 6 个 HTTP API 接口。

---

## 基础信息

| 项目 | 说明 |
|------|------|
| 基础 URL | `http://localhost:8080`（开发环境，生产环境另行通知） |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 跨域 | 已启用 CORS，支持所有来源 |

### 路由规则

所有 AssignNode 接口采用**动态路由**设计：

```
/api/v1/{groupID}/assign/xxx
```

- `{groupID}` 是担保组织 ID（如 `10000000`）
- 前端需要先通过服务发现接口获取可用的担保组织列表

---

## 接口列表

| 序号 | 接口 | 方法 | 功能 |
|------|------|------|------|
| 1 | `/api/v1/{groupID}/assign/health` | GET | 健康检查 |
| 2 | `/api/v1/{groupID}/assign/new-address` | POST | 用户新建子地址 |
| 3 | `/api/v1/{groupID}/assign/flow-apply` | POST | 用户加入/退出担保组织 |
| 4 | `/api/v1/{groupID}/assign/submit-tx` | POST | 用户提交交易 |
| 5 | `/api/v1/{groupID}/assign/re-online` | POST | 用户重新上线（登录） |
| 6 | `/api/v1/{groupID}/assign/group-info` | GET | 查询担保组织信息 |

---

## 1. 健康检查

检查指定担保组织的 AssignNode 是否在线。

### 请求

```
GET /api/v1/{groupID}/assign/health
```

### 示例

```bash
curl http://localhost:8080/api/v1/10000000/assign/health
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

### 前端使用建议

- 在调用其他接口前，先调用健康检查确认 AssignNode 在线
- 可用于前端展示担保组织的在线状态

---

## 2. 用户新建子地址

用户在担保组织内创建新的钱包子地址。

### 请求

```
POST /api/v1/{groupID}/assign/new-address
Content-Type: application/json
```

### 请求体

```json
{
    "new_address": "abc123def456...",
    "public_key": {
        "x": "base64编码的X坐标",
        "y": "base64编码的Y坐标"
    },
    "user_id": "12345678",
    "type": 0,
    "sig": {
        "r": "base64编码的签名R值",
        "s": "base64编码的签名S值"
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| new_address | string | 是 | 新地址（SHA256(公钥) 前40字符） |
| public_key | object | 是 | 地址对应的 ECDSA 公钥 |
| user_id | string | 是 | 用户 ID（8位数字） |
| type | int | 是 | 地址类型：0=盘古币，1=比特币，2=以太坊 |
| sig | object | 是 | 用户对请求的 ECDSA 签名 |

### 响应

**成功（200）：**
```json
{
    "success": true,
    "message": "Address created successfully"
}
```

**失败（400）：**
```json
{
    "error": "签名验证失败"
}
```

---

## 3. 用户加入/退出担保组织

用户申请加入或退出某个担保组织。

### 请求

```
POST /api/v1/{groupID}/assign/flow-apply
Content-Type: application/json
```

### 请求体

```json
{
    "status": 1,
    "user_id": "12345678",
    "user_peer_id": "",
    "guar_group_id": "10000000",
    "user_public_key": {
        "x": "base64编码的X坐标",
        "y": "base64编码的Y坐标"
    },
    "address_msg": {
        "地址1": {
            "address_data": {
                "public_key": {
                    "x": "...",
                    "y": "..."
                }
            }
        }
    },
    "timestamp": 1702300000000,
    "user_sig": {
        "r": "base64编码的签名R值",
        "s": "base64编码的签名S值"
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | int | 是 | 操作类型：1=加入，0=退出 |
| user_id | string | 是 | 用户 ID |
| user_peer_id | string | 否 | P2P 节点 ID（HTTP 调用可留空） |
| guar_group_id | string | 是 | 目标担保组织 ID |
| user_public_key | object | 是 | 用户账户公钥 |
| address_msg | object | 是 | 申请担保的地址信息（加入时必填） |
| timestamp | int64 | 是 | 时间戳（毫秒），**5分钟内有效** |
| user_sig | object | 是 | 用户签名 |

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

**失败（400）：**
```json
{
    "error": "时间戳已过期"
}
```

### ⚠️ 注意事项

- 时间戳有 **5 分钟有效期**，超时后签名失效
- 加入前需确保用户未加入其他担保组织
- 退出时 `address_msg` 可为空

---

## 4. 用户提交交易

用户提交转账交易到担保组织。

### 请求

```
POST /api/v1/{groupID}/assign/submit-tx
Content-Type: application/json
```

### 请求体

```json
{
    "tx": {
        "tx_inputs_normal": [
            {
                "txid": "前置交易ID",
                "vout": 0,
                "signature": {...}
            }
        ],
        "tx_outputs": [
            {
                "to_address": "接收地址",
                "value": 100.0
            }
        ]
    },
    "user_id": "12345678"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tx | object | 是 | 交易本体（包含输入和输出） |
| tx.tx_inputs_normal | array | 是 | 交易输入（UTXO 引用） |
| tx.tx_outputs | array | 是 | 交易输出（接收地址和金额） |
| user_id | string | 是 | 发起交易的用户 ID |

### 响应

**成功（200）：**
```json
{
    "success": true,
    "tx_id": "交易ID"
}
```

**失败（400）：**
```json
{
    "error": "余额不足"
}
```

---

## 5. 用户重新上线（登录）

用户启动钱包后，向后端同步账户状态。

### 请求

```
POST /api/v1/{groupID}/assign/re-online
Content-Type: application/json
```

### 请求体

```json
{
    "user_id": "12345678",
    "from_peer_id": "",
    "address": ["地址1", "地址2"],
    "sig": {
        "r": "base64编码的签名R值",
        "s": "base64编码的签名S值"
    }
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户 ID |
| from_peer_id | string | 否 | P2P 节点 ID（HTTP 调用可留空） |
| address | array | 是 | 用户的地址列表 |
| sig | object | 是 | 用户签名 |

### 响应

**成功（200）：**
```json
{
    "user_id": "12345678",
    "is_in_group": true,
    "guarantor_group_id": "10000000",
    "guar_group_boot": {
        "group_id": "10000000",
        "peer_group_id": "...",
        "assi_peer_id": "...",
        "aggr_peer_id": "..."
    },
    "user_wallet_data": {
        "value": 1000.0,
        "sub_address_msg": {
            "地址1": {
                "value": 500.0,
                "type": 0,
                "utxo": {...}
            }
        }
    }
}
```

### 响应字段说明

| 字段 | 说明 |
|------|------|
| is_in_group | 用户是否在担保组织中 |
| guarantor_group_id | 用户所属担保组织 ID |
| guar_group_boot | 担保组织通信信息 |
| user_wallet_data | 用户钱包数据（余额、UTXO 等） |

### 前端使用建议

- 用户登录时调用此接口同步数据
- 根据 `is_in_group` 判断用户是组内用户还是散户
- 将 `user_wallet_data` 缓存到本地

---

## 6. 查询担保组织信息

查询指定担保组织的详细信息。

### 请求

```
GET /api/v1/{groupID}/assign/group-info
```

### 示例

```bash
curl http://localhost:8080/api/v1/10000000/assign/group-info
```

### 响应

**成功（200）：**
```json
{
    "guar_group_id": "10000000",
    "group_msg": {
        "group_id": "10000000",
        "peer_group_id": "12D3KooW...",
        "assi_peer_id": "12D3KooW...",
        "aggr_peer_id": "12D3KooW...",
        "guar_table": {
            "担保人1": "PeerID1",
            "担保人2": "PeerID2"
        },
        "assign_api_endpoint": ":8081",
        "aggr_api_endpoint": ":8082"
    }
}
```

**未找到（404）：**
```json
{
    "error": "group not found"
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

## 前端对接流程建议

### 1. 初始化流程

```
1. 调用 GET /api/v1/groups 获取所有担保组织列表
2. 选择目标担保组织，调用 /assign/health 检查是否在线
3. 调用 /assign/re-online 登录并同步用户数据
```

### 2. 加入担保组织流程

```
1. 调用 GET /api/v1/groups/{id} 查询目标组织信息
2. 构造 UserFlowMsg（status=1），签名
3. 调用 /assign/flow-apply 提交加入申请
4. 处理返回结果
```

### 3. 发送交易流程

```
1. 选择 UTXO 构造交易输入
2. 构造交易输出（接收地址、金额、找零）
3. 对交易签名
4. 调用 /assign/submit-tx 提交交易
5. 记录返回的 tx_id
```

---

## JavaScript 示例代码

### 健康检查

```javascript
async function checkAssignNodeHealth(groupId) {
    const response = await fetch(
        `http://localhost:8080/api/v1/${groupId}/assign/health`
    );
    const data = await response.json();
    return data.status === 'ok';
}
```

### 用户登录

```javascript
async function userLogin(groupId, userId, addresses, signature) {
    const response = await fetch(
        `http://localhost:8080/api/v1/${groupId}/assign/re-online`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                from_peer_id: '',
                address: addresses,
                sig: signature
            })
        }
    );
    return await response.json();
}
```

### 提交交易

```javascript
async function submitTransaction(groupId, userId, transaction) {
    const response = await fetch(
        `http://localhost:8080/api/v1/${groupId}/assign/submit-tx`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tx: transaction,
                user_id: userId
            })
        }
    );
    return await response.json();
}
```

---

## 联系方式

如有问题，请联系后端开发人员。
