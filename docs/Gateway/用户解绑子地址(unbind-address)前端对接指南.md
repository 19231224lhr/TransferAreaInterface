# 用户解绑子地址（unbind-address）前端对接指南

> 目标：前端通过 HTTP/Gateway 调用 AssignNode 的"用户解绑子地址"接口，在担保组织内为指定用户解绑（软删除）一个已有的钱包子地址（Address）。解绑后的地址不可用于发起交易，但可通过 rebind 接口重新绑定。

---

## 接口信息

- **方法**：`POST`
- **路径**：`/api/v1/{groupID}/assign/unbind-address`
- **说明**：
  - `{groupID}` 是用户当前所属担保组织 ID（也就是该组织的 AssignNode 实例）。
  - **该接口要求用户必须已加入该担保组织**；否则后端会返回错误。
  - 解绑操作采用"墓碑模式"，地址信息会被移到 `RevokedAddresses` 列表，而非物理删除。

---

## 前置条件（如何拿到 groupID）

- **推荐**：用户登录走 `POST /api/v1/re-online`（BootNode 入口），若 `ReturnUserReOnlineMsg.IsInGroup=true`，使用返回的 `GuarantorGroupID` 作为 `{groupID}`。
- **加入担保组织后**：前端在"加入成功"后将当前 groupID 缓存到本地。

---

## 请求结构：`UserAddressBindingMsg`

后端结构体定义：

```go
// UserAddressBindingMsg 用户地址绑定/解绑消息
type UserAddressBindingMsg struct {
    Op        int            // 操作类型（前端可忽略，后端会强制设为解绑）
    UserID    string         // 用户ID
    Address   string         // 要解绑的地址
    PublicKey PublicKeyNew   // 地址公钥
    Type      int            // 地址类型
    TimeStamp uint64         // 请求时间戳
    Sig       EcdsaSignature // 使用用户私钥签名
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| **Op** | int | 否 | 操作类型，前端可不填或填 0，后端会强制设为 `UserAddressUnbind(0)` |
| **UserID** | string | 是 | 用户 8 位 ID（字符串） |
| **Address** | string | 是 | 要解绑的地址（必须是用户已有的地址） |
| **PublicKey** | PublicKeyNew | 是 | 该地址对应的公钥（P-256） |
| **Type** | int | 是 | 地址类型（0=盘古币，1=比特币，2=以太坊） |
| **TimeStamp** | uint64 | 是 | 请求时间戳（Unix 秒） |
| **Sig** | EcdsaSignature | 是 | 用户签名（ECDSA P-256） |

---

## 签名规则（前端必须遵循）

后端验签逻辑：使用"用户账户公钥（加入担保组织时保存的公钥）"对 `UserAddressBindingMsg` 验签，排除字段为 `Sig`：

```go
// 验证用户签名
userInfo := a.LocalMsg.GuarGroupMsg.UserMessage[msg.UserID]
err := core.VerifyStructSig(msg.Sig, core.ConvertToPublicKey(userInfo.PublicKeyNew), msg, "Sig")
```

这意味着：
- **签名算法**：ECDSA P-256
- **哈希算法**：SHA-256（对序列化后的 JSON 做哈希）
- **排除字段**：`Sig`（参与签名前必须置为零值，而不是删除字段）

### `big.Int` 字段格式（必须是 JSON number）
`PublicKey.X/Y`、`Sig.R/S` 在 JSON 中必须是**数字字面量**（不带引号），否则会触发 `math/big` 反序列化错误。

> 与你们的统一规则一致，细节见：`docs/gateway/前端签名与序列化唯一指南（以Go后端实现为准）.md`

---

## 请求示例（JSON）

```json
{
  "Op": 0,
  "UserID": "12345678",
  "Address": "b26703a6876afc3eb95d280c7c5eb582c90c8d67",
  "PublicKey": {
    "CurveName": "P256",
    "X": 19283746501928374650192837465019283746501928374650192837465019283746,
    "Y": 98765432109876543210987654321098765432109876543210987654321098765432
  },
  "Type": 0,
  "TimeStamp": 1735041600,
  "Sig": {
    "R": 11223344556677889900112233445566778899001122334455667788990011223344,
    "S": 99887766554433221100998877665544332211009988776655443322110099887766
  }
}
```

> 注意：上面示例中的数字仅用于格式演示；真实 `X/Y/R/S` 需要按签名/公钥计算得到。

---

## 响应格式

### 成功响应（HTTP 200）

```json
{
  "success": true,
  "message": "Address unbound successfully"
}
```

### 失败响应

失败时，HTTP 状态码通常为 `400` 或 `404`，响应为：

```json
{ "error": "错误信息" }
```

### 常见错误

| HTTP 状态码 | 错误信息 | 说明 |
|------------|---------|------|
| 404 | `GuarGroup 'xxx' not found or AssignNode not registered` | 担保组织不存在或未注册 |
| 400 | `user not found in group` | 用户不在担保组织中 |
| 400 | `address not found in user's addresses` | 地址不属于该用户 |
| 400 | `address already revoked` | 地址已经被解绑 |
| 400 | `signature verification failed` | 签名验证失败 |
| 400 | `Invalid request body` | 请求体 JSON 格式错误 |

---

## 解绑后的影响

1. **地址不可用于交易**：解绑后的地址无法作为交易输入或输出
2. **查询时不显示**：前端本地应维护已解绑地址列表，查询/显示时过滤
3. **可重新绑定**：通过 `rebind-address` 接口可恢复地址（暂未对外开放）
4. **链上状态**：解绑信息会广播到担保组织内所有节点并持久化

---

## 推荐前端对接流程

### 1. 获取用户地址列表

前端应维护用户的地址列表，可从以下途径获取：
- 登录时 `ReturnUserReOnlineMsg.UserWalletData.SubAddressMsg`
- 本地缓存的地址列表

### 2. 用户选择要解绑的地址

展示用户当前有效地址列表（需过滤已解绑的地址），让用户选择。

### 3. 构造请求

```javascript
// 伪代码示例
const unbindRequest = {
  Op: 0,  // 可省略，后端会强制设为解绑
  UserID: "12345678",
  Address: selectedAddress,
  PublicKey: {
    CurveName: "P256",
    X: addressPublicKey.X,  // big.Int，JSON 中为数字
    Y: addressPublicKey.Y
  },
  Type: addressType,  // 0, 1, 或 2
  TimeStamp: Math.floor(Date.now() / 1000),
  Sig: { R: 0, S: 0 }  // 先置零值
};
```

### 4. 签名

```javascript
// 1. 序列化（Sig 字段保留但为零值）
const jsonStr = JSON.stringify(unbindRequest);

// 2. SHA-256 哈希
const hash = sha256(jsonStr);

// 3. 使用用户账户私钥签名（注意：是账户私钥，不是地址私钥）
const signature = ecdsaSign(hash, userAccountPrivateKey);

// 4. 填入签名
unbindRequest.Sig = {
  R: signature.r,
  S: signature.s
};
```

### 5. 发送请求

```javascript
const response = await fetch(`/api/v1/${groupID}/assign/unbind-address`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(unbindRequest)
});

const result = await response.json();
if (result.success) {
  // 成功：更新本地状态，将地址加入已解绑列表
  localRevokedAddresses.push(selectedAddress);
} else {
  // 失败：显示错误信息
  alert(result.error);
}
```

### 6. 更新本地状态

解绑成功后，前端应：
- 将地址加入本地 `revokedAddresses` 列表
- 刷新地址列表显示（过滤已解绑地址）
- 可选：调用 `getwalletmsg` 或 `re-online` 刷新服务端数据

---

## 完整调用示例（curl）

```bash
curl -X POST "http://localhost:8080/api/v1/10000000/assign/unbind-address" \
  -H "Content-Type: application/json" \
  -d '{
    "UserID": "12345678",
    "Address": "b26703a6876afc3eb95d280c7c5eb582c90c8d67",
    "PublicKey": { "CurveName": "P256", "X": 123, "Y": 456 },
    "Type": 0,
    "TimeStamp": 1735041600,
    "Sig": { "R": 789, "S": 101112 }
  }'
```

---

## 注意事项

1. **签名使用账户私钥**：签名时使用的是用户的**账户私钥**（加入担保组织时使用的私钥），而不是地址私钥。

2. **TimeStamp 有效期**：建议使用当前时间戳，过旧的时间戳可能被后端拒绝。

3. **地址必须存在**：只能解绑用户已有且未被解绑的地址。

4. **本地过滤**：解绑成功后，前端应在本地维护已解绑地址列表，避免重复显示。

5. **幂等性**：重复解绑同一地址会返回错误 `address already revoked`。

