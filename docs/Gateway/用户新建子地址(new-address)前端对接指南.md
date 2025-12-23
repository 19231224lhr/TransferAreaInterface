# 用户新建子地址（new-address）前端对接指南

> 目标：前端通过 HTTP/Gateway 调用 AssignNode 的“用户新建子地址”接口，在担保组织内为指定用户新增一个钱包子地址（Address），并完成后端验签与落库。

---

## 接口信息

- **方法**：`POST`
- **路径**：`/api/v1/{groupID}/assign/new-address`
- **说明**：
  - `{groupID}` 是用户当前所属担保组织 ID（也就是该组织的 AssignNode 实例）。
  - **该接口要求用户必须已加入该担保组织**；否则后端会返回错误：`the user is not in the guarantor organization`。

---

## 前置条件（如何拿到 groupID）

- **推荐**：用户登录走 `POST /api/v1/re-online`（BootNode 入口），若 `ReturnUserReOnlineMsg.IsInGroup=true`，使用返回的 `GuarantorGroupID` 作为 `{groupID}`。
- **加入担保组织后**：前端在“加入成功”后将当前 groupID 缓存到本地（后续新建子地址/提交交易等都用它）。

---

## 请求结构：`UserNewAddressInfo`

后端结构体定义：

```145:153:core/guargroup.go
// UserNewAddressInfo 用户新建子地址信息
type UserNewAddressInfo struct {
    NewAddress   string
    PublicKeyNew PublicKeyNew
    UserID       string
    Type         int

    Sig EcdsaSignature // 使用用户私钥签名
}
```

### 字段说明

- **NewAddress**：新建的钱包子地址（**必须与 `PublicKeyNew` 匹配**，后端会校验）。
- **PublicKeyNew**：该地址对应的公钥（P-256）。
- **UserID**：用户 8 位 ID（字符串）。
- **Type**：地址类型（后端作为分类字段保存；常见值参考你们既有约定，如 0=盘古币，1=比特币，2=以太坊）。
- **Sig**：用户签名（ECDSA P-256）。

---

## 地址生成规则（必须与后端一致）

后端校验逻辑：将 `PublicKeyNew` 转为椭圆曲线点字节后，做 SHA-256，再取前 20 字节转 hex：

```34:48:Guarantor/AssignNode/manage.go
// 将公钥转换为字节数组
publicKey := core.ConvertToPublicKey(userNewAddressMsg.PublicKeyNew)
pubKeyBytes := elliptic.Marshal(publicKey.Curve, publicKey.X, publicKey.Y)
// 计算 SHA-256 哈希
hash := sha256.Sum256(pubKeyBytes)
if userNewAddressMsg.NewAddress != fmt.Sprintf("%x", hash[:20]) {
    return fmt.Errorf("the address and public key do not match")
}
```

因此前端必须用同样规则生成 `NewAddress`（否则会被拒绝）。

---

## 签名规则（前端必须遵循）

后端验签逻辑：使用“用户账户公钥（加入担保组织时保存的公钥）”对 `UserNewAddressInfo` 验签，排除字段为 `Sig`：

```34:53:Guarantor/AssignNode/manage.go
PK, isExist := a.LocalMsg.GuarGroupMsg.UserMessage[userNewAddressMsg.UserID]
// ...
err := core.VerifyStructSig(userNewAddressMsg.Sig, core.ConvertToPublicKey(PK.PublicKeyNew), userNewAddressMsg, "Sig")
```

这意味着：
- **签名算法**：ECDSA P-256
- **哈希算法**：SHA-256（对序列化后的 JSON 做哈希）
- **排除字段**：`Sig`（参与签名前必须置为零值，而不是删除字段）

### `big.Int` 字段格式（必须是 JSON number）
`PublicKeyNew.X/Y`、`Sig.R/S` 在 JSON 中必须是**数字字面量**（不带引号），否则会触发 `math/big` 反序列化错误。

> 与你们的统一规则一致，细节见：`docs/gateway/前端签名与序列化唯一指南（以Go后端实现为准）.md`

---

## 请求示例（JSON）

```json
{
  "NewAddress": "2980543afa6edc9b674244d71b1fd80f0301e64a",
  "PublicKeyNew": { "CurveName": "P256", "X": 123, "Y": 456 },
  "UserID": "12345678",
  "Type": 0,
  "Sig": { "R": 789, "S": 101112 }
}
```

> 注意：上面示例中的数字仅用于格式演示；真实 `X/Y/R/S` 需要按签名/公钥计算得到。

---

## 响应格式

Gateway 返回：

```json
{
  "success": true,
  "message": "Address created successfully"
}
```

失败时，HTTP 状态码通常为 `400`，响应为：

```json
{ "error": "..." }
```

常见错误：
- `the user is not in the guarantor organization`
- `the address and public key do not match`
- `signature verification error`

---

## 推荐前端对接流程（最短闭环）

1. **登录**：`POST /api/v1/re-online`，拿到 `GuarantorGroupID`（如果 `IsInGroup=true`）。
2. **本地生成地址密钥对**：生成 P-256 keypair → 计算 `NewAddress`（按上文规则）。
3. **构造待签名对象**：把 `Sig` 置零值（不要删字段）。
4. **序列化 + 哈希 + 签名**：得到 `Sig.R/S`。
5. **调用接口**：`POST /api/v1/{groupID}/assign/new-address`。
6. **成功后本地落库**：保存新地址与其私钥（后端不保存私钥），并更新本地地址列表。


