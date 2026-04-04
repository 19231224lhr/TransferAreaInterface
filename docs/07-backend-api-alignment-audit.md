# 07. 后端 API 对齐审计（以 UTXO-Area 当前实现为准）

更新时间：2026-04-04

## 1. 扫描范围

本次扫描以前端仓库 `js/config/api.ts` 中声明的全部接口常量为入口，结合实际调用代码与后端 `gateway/server.go` 的公开路由逐一比对，并继续下钻到当前协议真值文件。

前端已扫描模块：
- `js/config/api.ts`
- `js/services/api.ts`
- `js/services/auth.ts`
- `js/services/group.ts`
- `js/services/address.ts`
- `js/services/accountQuery.ts`
- `js/services/accountPolling.ts`
- `js/services/comNodeEndpoint.ts`
- `js/services/capsule.ts`
- `js/services/transfer.ts`
- `js/services/txBuilder.ts`
- `js/types/blockchain.ts`
- `js/utils/signature.ts`
- `js/utils/storage.ts`
- `js/pages/main.js`
- `js/pages/login.ts`
- `js/pages/joinGroup.ts`
- `docs/04-api-integration.md`

后端已扫描模块：
- `gateway/server.go`
- `core/transaction.go`
- `core/usernewtx_sig.go`
- `core/seedchain.go`
- `core/signature.go`
- `core/guargroup.go`
- `core/address_binding.go`
- `core/guaruserinfo.go`
- `core/storagepoint.go`
- `core/txcer.go`
- `Guarantor/AssignNode/gateway.go`
- `Guarantor/AssignNode/manage.go`
- `Guarantor/AssignNode/address_binding.go`
- `GuarCommittee/gateway.go`
- `GuarCommittee/comnode.go`
- `docs/00-current-baseline.md`
- `docs/seed-chain-refactor-guide.md`

本次审计的判定基准：
- 路由真值以 `gateway/server.go` 为准。
- 交易、签名、seed-chain、序列化规则以 `core/transaction.go`、`core/usernewtx_sig.go`、`core/seedchain.go`、`core/signature.go` 为准。
- `docs/04-api-integration.md` 现在只能作为旧版背景文档，不能再作为联调标准。
- 本文中出现的“要求”“必须补齐”“必须包含”等表述，均指前端为了兼容当前已经完成并固定下来的后端实现而必须满足的协议条件，不表示后端还需要继续修改这些字段。

## 2. 总体结论

### 2.1 结论摘要

1. 前端当前不是“接口地址错了”，而是“协议层已经落后于后端当前实现”。
2. 后端已经从旧版 `PublicKeyNew + EcdsaSignature{R,S}` 模式演进到 V2 信封签名和 seed-chain 约束；前端的大部分写接口仍按旧结构构造请求。
3. 真正高风险的不是读接口，而是所有会生成新地址、绑定地址、入组、解绑、提交交易的写路径。
4. 读接口虽然大多还能读到数据，但前端把关键 V2 字段丢掉了，结果是“看起来能读，后面却发不出去交易”。
5. 这次修复不能只改某一个 fetch body，必须先统一前端协议模型、序列化器、本地存储，再改具体业务接口。

### 2.2 当前状态归类

- 完全兼容，可直接保留：`/health`、`/api/v1/groups`、`/api/v1/groups/{id}`、`/api/v1/committee/endpoint`、`/api/v1/org/publickey`、`/api/v1/{groupID}/assign/group-info`、`/api/v1/{groupID}/assign/capsule/generate`、`/api/v1/com/capsule/generate`、`/api/v1/com/public-key`、`/api/v1/{groupID}/assign/tx-status/{txID}`、`/api/v1/com/health`
- 部分兼容，路由可用但前端模型不完整：`/api/v1/re-online`、`/api/v1/com/query-address`、`/api/v1/com/query-address-group`、`/api/v1/{groupID}/assign/account-update`、`/api/v1/{groupID}/assign/account-update-stream`、`/api/v1/{groupID}/assign/txcer-change`、`/api/v1/{groupID}/assign/poll-cross-org-txcers`
- 明确不兼容，前端必须改请求体或交易结构：`/api/v1/{groupID}/assign/new-address`、`/api/v1/{groupID}/assign/flow-apply`、`/api/v1/{groupID}/assign/unbind-address`、`/api/v1/com/register-address`、`/api/v1/{groupID}/assign/submit-tx`、`/api/v1/com/submit-noguargroup-tx`
- 后端有路由但前端当前未实际接入：`/api/v1/{groupID}/assign/health`、`/api/v1/{groupID}/assign/re-online`、`/api/v1/{groupID}/aggr/health`
- 前端声明了常量，但后端当前没有公开路由：`AGGR_TXCER`、`COM_UTXO_CHANGE`

### 2.3 根因

这次不兼容的根因不是单一字段变更，而是整条协议链路变了：
- 地址类接口新增 `SignPublicKeyV2`、`SeedAnchor`、`SeedChainStep`、`DefaultSpendAlgorithm`
- 地址注册接口把旧的 `Sig` 升级为 `AddressOwnershipSig`，并采用 `SignatureEnvelope`
- 交易输入输出新增 seed 相关字段，且 seeded output 已经不再接受旧版签名回退
- 交易、TXCer、本地钱包都需要理解 V2 签名信封和 Go `[]byte` 的 JSON 表达方式
- 前端 `storage.ts` 目前完全没有 seed 状态模型，因此读接口拿到的数据也没有被长期保存

## 3. 全量接口清单

### 3.1 Gateway / BootNode 路由

| 路由 | 前端调用点 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| `GET /health` | `js/services/api.ts` | 兼容 | 继续保留，用于健康检查。 |
| `GET /api/v1/groups` | `js/services/group.ts#listAllGroups` | 兼容 | 继续保留。 |
| `GET /api/v1/groups/{id}` | `js/services/group.ts#queryGroupInfo` | 兼容 | 继续保留。 |
| `GET /api/v1/committee/endpoint` | `js/services/comNodeEndpoint.ts#getComNodeURL` | 兼容 | 继续保留，是 ComNode 发现入口。 |
| `GET /api/v1/org/publickey` | `js/services/capsule.ts` | 兼容 | 当前未发现与 seed 重构冲突。 |
| `POST /api/v1/re-online` | `js/services/auth.ts#userReOnline`、`js/pages/login.ts` | 部分兼容 | 登录请求本身还能发，但前端没有把返回的 seed/V2 元数据落到本地。 |

### 3.2 AssignNode 路由

| 路由 | 前端调用点 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| `GET /api/v1/{groupID}/assign/health` | 无实际调用 | 未接入 | 可保留为诊断接口。 |
| `POST /api/v1/{groupID}/assign/new-address` | `js/services/address.ts#createNewAddressOnBackend*` | 不兼容 | 前端请求体仍是旧版 `UserNewAddressInfo`。 |
| `POST /api/v1/{groupID}/assign/flow-apply` | `js/services/group.ts` | 不兼容 | 入组/退组请求体仍是旧版 `FlowApplyRequest`。 |
| `POST /api/v1/{groupID}/assign/submit-tx` | `js/services/txBuilder.ts#submitTransaction` | 不兼容 | 交易结构仍是旧版，不满足 seed-chain V2 校验。 |
| `GET /api/v1/{groupID}/assign/tx-status/{txID}` | `js/services/txBuilder.ts#queryTXStatus` | 基本兼容 | 状态查询路径可继续保留。 |
| `POST /api/v1/{groupID}/assign/re-online` | 仅有常量，无实际调用 | 未接入 | 后端有路由，但当前前端没用它。 |
| `GET /api/v1/{groupID}/assign/group-info` | `js/services/group.ts#queryGroupInfoFromAssign` | 兼容 | 继续保留。 |
| `POST /api/v1/{groupID}/assign/unbind-address` | `js/services/address.ts#unbindAddressOnBackend` | 不兼容 | 前端请求体仍是旧版 `UserAddressBindingMsg`。 |
| `POST /api/v1/{groupID}/assign/capsule/generate` | `js/services/capsule.ts` | 兼容 | 当前未发现协议失配。 |
| `GET /api/v1/{groupID}/assign/account-update` | `js/services/accountPolling.ts` | 部分兼容 | 读得到，但 seed/TXCer V2 字段没有被前端完整吸收。 |
| `GET /api/v1/{groupID}/assign/account-update-stream` | `js/services/accountPolling.ts` | 部分兼容 | SSE 事件通道本身可用，但事件负载没有完整落地。 |
| `GET /api/v1/{groupID}/assign/txcer-change` | `js/services/accountPolling.ts` | 部分兼容 | `TxCertificate` 已升级，前端类型还停留在旧版。 |
| `GET /api/v1/{groupID}/assign/poll-cross-org-txcers` | `js/services/accountPolling.ts` | 部分兼容 | 与 `txcer-change` 同类问题。 |

### 3.3 AggrNode 路由

| 路由 | 前端调用点 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| `GET /api/v1/{groupID}/aggr/health` | 无实际调用 | 未接入 | 可留给诊断用途。 |

### 3.4 ComNode 路由

| 路由 | 前端调用点 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| `GET /api/v1/com/health` | `js/services/comNodeEndpoint.ts` | 兼容 | 继续保留。 |
| `POST /api/v1/com/query-address` | `js/services/accountQuery.ts`、`js/services/wallet.ts`、`js/utils/interestSync.js` | 部分兼容 | 查询结果里新的 seed/V2 元数据没有被前端保存。 |
| `POST /api/v1/com/query-address-group` | `js/services/accountQuery.ts`、`js/services/recipient.js` | 部分兼容 | 接收端校验逻辑需要升级到新模型。 |
| `POST /api/v1/com/register-address` | `js/services/address.ts#registerAddressOnComNode` | 不兼容 | 前端仍按旧版 `UserRegisterAddressMsg` 发包。 |
| `POST /api/v1/com/capsule/generate` | `js/services/capsule.ts` | 兼容 | 当前未发现协议失配。 |
| `GET /api/v1/com/public-key` | `js/services/capsule.ts` | 兼容 | 当前可保留。 |
| `POST /api/v1/com/submit-noguargroup-tx` | `js/services/transfer.ts` + `js/services/txBuilder.ts#buildNormalTransaction` | 不兼容 | 散户交易仍按旧交易结构构造。 |

### 3.5 前端声明但当前应清理的接口常量

| 前端常量 | 后端现状 | 结论 |
| --- | --- | --- |
| `AGGR_TXCER` | `gateway/server.go` 中没有公开 `/api/v1/{groupID}/aggr/txcer` | 属于死常量，建议删除或明确标注未实现。 |
| `COM_UTXO_CHANGE` | `gateway/server.go` 中没有公开 `/api/v1/{committeeId}/com/utxo-change` | 属于死常量，建议删除或明确标注未实现。 |

## 4. 协议层必须先统一的内容

在修具体接口之前，前端必须先统一以下协议事实，否则后面的修改会继续分散、继续错。

### 4.1 V2 签名/公钥信封

后端当前真值不是旧的 `{R,S}`/`{X,Y}` 结构，而是：

```json
{
  "Algorithm": "ecdsa_p256",
  "PublicKey": "<base64>"
}
```

```json
{
  "Algorithm": "ecdsa_p256",
  "Signature": "<base64>"
}
```

要点：
- `Algorithm` 当前应按后端使用 `ecdsa_p256`
- `PublicKey`、`Signature` 都不是十进制大整数，而是 Go `[]byte` 的 JSON 结果，也就是 base64 字符串
- 前端必须新增统一的 `PublicKeyEnvelope`、`SignatureEnvelope` 类型和序列化/反序列化工具

### 4.2 Go `[]byte` 字段的 JSON 语义

以下字段在 HTTP JSON 中都要按 base64 字符串处理，而不是 JS 数组或十六进制字符串：
- `SeedAnchor`
- `SeedReveal`
- `TXOutputHash`
- `Data`
- `PublicKeyEnvelope.PublicKey`
- `SignatureEnvelope.Signature`

### 4.3 nil 和空数组的规范化

`core/usernewtx_sig.go` 对部分字段区分 nil 与空切片。前端序列化器要对齐这一点，至少需要特别处理：
- `TXInputsNormal[].TXOutputHash`
- `TXInputsNormal[].SeedReveal`
- `TXOutputs[].SeedAnchor`

### 4.4 钱包本地必须持有 seed 状态

仅靠后端回包，前端无法在花费时凭空生成 `SeedReveal`。因此钱包本地必须保存至少两类信息：
- 对外协议字段：`signPublicKeyV2`、`seedAnchor`、`seedChainStep`、`defaultSpendAlgorithm`
- 本地私有状态：用于派生后续 `SeedReveal` / `SeedPublicKeyV2` 的 seed 私有材料

这意味着：
- 旧账号如果本地没有 seed 私有材料，即使后端查得到地址，也不代表这个地址还能继续转出
- 前端必须把这类地址标成“只读/待修复”，而不是继续允许用户发交易

## 5. 读接口与同步接口修复方案

### 5.1 `POST /api/v1/re-online`

现状：
- 前端 `js/services/auth.ts` 的登录请求还能发出去
- 但 `ReturnUserReOnlineMsg` 里的钱包数据已经不再是旧版足够模型
- 当前 `storage.ts` 只保存旧地址结构，seed/V2 元数据没有长期保存

需要怎么改：
- 扩展 `js/utils/storage.ts#AddressData`
- 扩展 `js/types/blockchain.ts` 的 `UTXOData`、`TXOutput`、`TxCertificate`
- 登录完成后，把地址级、UTXO 级、TXCer 级的 V2/seed 元数据一并保存
- 若缺少本地 seed 私有材料，则立即给地址打上 `readOnly` 或 `seedRepairRequired` 标记

UI 是否需要改：
- 需要，但不需要新增表单字段
- 登录后若发现地址协议状态不完整，应在主页面给出“地址待修复/不可转出”的明确状态

### 5.2 `POST /api/v1/com/query-address` 与 `POST /api/v1/com/query-address-group`

现状：
- 前端 `accountQuery.ts` 仍以旧结构归一化地址数据
- `AddressBalanceInfo` 和 `AddressData` 只保留余额、利息、公钥、UTXO 等旧字段
- 查询接口返回的新元数据没有进入本地钱包模型

需要怎么改：
- 在 `normalizeAddressData` 和 `convertToStorageUTXO` 中把 seed/V2 相关字段透传到本地结构
- 让接收方地址校验逻辑不再只看 `groupID` / `PublicKeyNew`，还要能判断地址是否具备当前协议所需元数据
- 对散户地址，如果本地注册状态和后端状态不一致，要记录 `registrationState`

UI 是否需要改：
- 推荐改，但不是新增输入项
- 收款地址校验提示要能区分“地址不存在”“地址存在但协议状态不完整”“地址已存在但不支持当前转账模式”

### 5.3 `GET /api/v1/{groupID}/assign/account-update` 与 `GET /api/v1/{groupID}/assign/account-update-stream`

现状：
- 轮询和 SSE 通道本身还可用
- 前端只消费了旧版账户变化和交易状态字段
- 对 seed 元数据、TXCer V2 字段、跨组织 TXCer 的新结构吸收不完整

需要怎么改：
- 统一账户更新 merge 逻辑，不能再用旧 `AddressData` 结构覆盖新数据
- SSE 事件和轮询接口都走同一套反序列化与本地落库逻辑
- 钱包刷新时除余额外，还要刷新每个地址的协议状态、seed 步数、注册状态

UI 是否需要改：
- 需要
- 地址列表应显示至少三种状态：`已同步`、`待修复`、`不可转出`

### 5.4 `GET /api/v1/{groupID}/assign/txcer-change` 与 `GET /api/v1/{groupID}/assign/poll-cross-org-txcers`

现状：
- 前端 `js/types/blockchain.ts#TxCertificate` 仍是旧版
- 后端当前 TXCer 已包含 `UserSignatureV2`
- 前端虽然能看到 value 和 ID，但签名与协议元数据缺失

需要怎么改：
- 升级 `TxCertificate` 类型，至少补齐 `UserSignatureV2`
- `wallet.totalTXCers` 必须保存完整 TXCer 对象，而不是只靠地址上的 value 映射工作
- 所有依赖 TXCer 的交易构造逻辑都要使用升级后的对象

UI 是否需要改：
- 需要轻量改造
- 不需要新增新页面，但 TXCer 列表和详情应能区分“旧证书缓存”和“V2 可用证书”

## 6. 地址生命周期与入组接口修复方案

### 6.1 `POST /api/v1/{groupID}/assign/new-address`

当前前端问题：
- `js/services/address.ts` 发送的是旧版 `UserNewAddressInfo`
- 只包含 `NewAddress`、`PublicKeyNew`、`UserID`、`Type`、`Sig`

按当前后端标准，前端发往该接口的请求体至少必须新增：
- `SignPublicKeyV2`
- `SeedAnchor`
- `SeedChainStep`
- `DefaultSpendAlgorithm`

修复方案：
- 在地址创建时生成并保存完整协议元数据，而不是只生成旧 `pubXHex` / `pubYHex`
- `SignPublicKeyV2` 必须按后端当前规则与账户公钥保持一致
- 地址创建成功后，把这些字段保存到 `wallet.addressMsg[address]`
- `createNewAddressOnBackend` / `createNewAddressOnBackendWithPriv` 要统一走新请求构造器

UI 是否需要改：
- 不需要让用户手工填这些字段
- 但地址创建完成后，UI 必须展示“后端同步成功/失败”状态
- 如果后端同步失败，不能再假装成功

必须同时修的现有 bug：
- `js/services/address.ts#registerAddressesOnMainEntry()` 在 `finally` 里无条件把 `mainAddressRegistered=true`
- 这会导致注册失败后也不再重试
- 该逻辑必须改为“全部成功才置 true”，或改成逐地址状态机

### 6.2 `POST /api/v1/{groupID}/assign/flow-apply`

当前前端问题：
- `js/services/group.ts` 仍构造旧版 `FlowApplyRequest`
- 旧结构没有顶层 `SignPublicKeyV2`
- `AddressMsg` 内每个地址也没有 seed 相关字段

按当前后端标准，前端发往该接口的请求体至少必须包含：
- 顶层 `SignPublicKeyV2`
- 每个地址条目都带：`SeedAnchor`、`SeedChainStep`、`DefaultSpendAlgorithm`

修复方案：
- 入组申请不要再从“旧公钥列表”临时拼请求体
- 应从钱包地址状态中读取完整协议元数据后再构造 `AddressMsg`
- 对缺少 seed 状态的地址，直接阻止加入组织流程
- 退组路径也要按当前后端签名规则统一走新签名构造器

UI 是否需要改：
- 需要
- 入组页面在提交前应做协议就绪检查，并列出哪些地址缺少 seed/V2 元数据
- 不需要额外输入框，但需要明确的阻断提示

### 6.3 `POST /api/v1/{groupID}/assign/unbind-address`

当前前端问题：
- 发送的仍是旧版 `UserAddressBindingMsg`
- 缺少 `SignPublicKeyV2`、`SeedAnchor`、`SeedChainStep`、`DefaultSpendAlgorithm`

修复方案：
- 解绑请求必须带上地址当前协议元数据
- 如果本地只有旧地址数据而没有 seed 状态，不能再盲目尝试后端解绑
- 应区分“后端同步解绑”和“仅本地隐藏/删除”两种动作

UI 是否需要改：
- 需要
- 删除地址弹窗要告诉用户这是“同步解绑”还是“仅本地移除”
- 对缺少协议元数据的地址，应提示先修复后再解绑

### 6.4 `POST /api/v1/com/register-address`

当前前端问题：
- `js/services/address.ts#registerAddressOnComNode` 仍使用旧版 `RegisterAddressRequest`
- 仍发送旧 `Sig`

按当前后端标准，前端发往该接口的请求体关键字段是：
- `SignPublicKeyV2`
- `AddressOwnershipSig`
- `SeedAnchor`
- `SeedChainStep`
- `DefaultSpendAlgorithm`

`AddressOwnershipSig` 的签名载荷应至少覆盖：
- `Address`
- `PublicKeyNew`
- `GroupID`
- `TimeStamp`
- `Type`
- `SeedAnchor`
- `SeedChainStep`
- `DefaultSpendAlgorithm`
- `SignPublicKeyV2`

修复方案：
- 新增专门的地址归属签名构造函数，不要复用旧 `signStruct` 直接签老对象
- 该签名输出要改成 `SignatureEnvelope`
- 注册成功与否必须落到地址状态里，例如 `registrationState = registered | pending | failed`

UI 是否需要改：
- 需要
- 主页面必须能看到主地址/散户地址是否已注册到 ComNode
- 注册失败必须可见，不能像现在这样后台失败但页面继续允许转账

## 7. 交易接口修复方案

### 7.1 `POST /api/v1/{groupID}/assign/submit-tx`

当前前端问题：
- `js/services/txBuilder.ts` 仍构造旧版 `Transaction` / `UserNewTX`
- `TXInputNormal` 只有 `InputSignature` 和 `TXOutputHash`
- `TXOutput` 没有 seed 输出字段
- 顶层交易也没有 `UserSignatureV2`

按当前后端标准，前端提交交易时至少必须补齐：
- `Transaction.UserSignatureV2`
- `TXInputNormal.InputSignatureV2`
- `TXInputNormal.SeedReveal`
- `TXInputNormal.SeedPublicKeyV2`
- `TXInputNormal.SeedChainStep`
- `TXOutput.SeedAnchor`
- `TXOutput.SeedChainStep`
- `TXOutput.DefaultSpendAlgorithm`

前端还必须同步对齐的协议细节：
- `serializeUserNewTX` 必须按 Go `[]byte` JSON 语义输出 base64
- 对 `TXOutputHash`、`SeedReveal`、`SeedAnchor` 的 nil/空值处理要对齐后端
- 交易哈希、用户签名、输入签名都要按新结构重算，不能只在旧模型上“补几个字段”

修复方案：
- 先升级 `js/types/blockchain.ts`
- 再升级 `js/services/txBuilder.ts` 的构建、哈希、签名、序列化流程
- `buildTransactionFromLegacy`、`buildNormalTransaction`、`buildAggregateGTX` 这些兼容函数也要同步升级
- 构造输入时，必须从本地 seed 私有状态推导 `SeedReveal` / `SeedPublicKeyV2`
- 构造输出时，必须把接收地址的 `SeedAnchor` / `SeedChainStep` / `DefaultSpendAlgorithm` 填进去

UI 是否需要改：
- 必须改
- 发送前要阻止以下情况：
  - 地址未注册
  - 地址缺少 seed 私有状态
  - 地址协议元数据不完整
  - seed 步数已耗尽或低于安全阈值
- 不需要让用户手输 seed 值，但需要明确错误原因和修复入口

### 7.2 `POST /api/v1/com/submit-noguargroup-tx`

当前前端问题：
- `js/services/transfer.ts` + `js/services/txBuilder.ts#buildNormalTransaction` 仍走旧版散户交易结构
- 当前后端 `VerifyNoGroupTX()` 已经强制 seeded input 校验
- `SubATX` 层也需要 `UserSignatureV2`
- 散户地址如果没有先完成 `register-address` 的 V2 注册，后端不会认

修复方案：
- 散户交易和担保组交易要共用同一套 V2 输入/输出模型
- 不要再把“散户交易”当成只需要旧签名的特例
- 提交前必须先校验地址已在 ComNode 注册，且本地具备 seed 私有状态

UI 是否需要改：
- 必须改
- 散户模式下，发送按钮需要在“未注册”时直接禁用，并给出修复提示

### 7.3 `GET /api/v1/{groupID}/assign/tx-status/{txID}`

结论：
- 这个接口的协议层变化不大，当前可以保留
- 但错误文案和状态机要与新的“地址状态/协议状态”联动

UI 是否需要改：
- 不需要大改
- 只需要把失败原因映射升级，例如新增“地址未注册”“seed 状态缺失”“V2 签名失败”等用户可理解的提示

## 8. Capsule 与公钥相关接口结论

涉及接口：
- `POST /api/v1/{groupID}/assign/capsule/generate`
- `POST /api/v1/com/capsule/generate`
- `GET /api/v1/com/public-key`
- `GET /api/v1/org/publickey`

结论：
- 目前没有证据表明这些接口被这次 seed-chain 重构直接打坏
- 它们主要依赖组织信息、公钥查询和胶囊地址生成逻辑，而不是交易输入花费逻辑
- 这里的风险主要来自前端读接口模型升级后要保持兼容，不是协议本身要重写

UI 是否需要改：
- 当前不需要为了这次修复专门改 UI
- 只要后续地址状态展示接入成功，胶囊地址相关页面自然能受益

## 9. 前端本地数据模型必须补齐的字段

### 9.1 `js/utils/storage.ts#AddressData`

当前只有：
- `type`
- `utxos`
- `txCers`
- `value`
- `estInterest`
- `privHex` / `pubXHex` / `pubYHex`
- `publicKeyNew`

建议新增至少：
- `signPublicKeyV2`
- `seedAnchor`
- `seedChainStep`
- `defaultSpendAlgorithm`
- `registrationState`
- `registrationError`
- `seedRepairRequired`
- `readOnly`
- `lastProtocolSyncAt`
- 本地私有 seed 状态字段，例如 `seedLocalState`

### 9.2 `js/types/blockchain.ts`

建议新增或升级：
- `PublicKeyEnvelope`
- `SignatureEnvelope`
- `TXInputNormal.InputSignatureV2`
- `TXInputNormal.SeedReveal`
- `TXInputNormal.SeedPublicKeyV2`
- `TXInputNormal.SeedChainStep`
- `Transaction.UserSignatureV2`
- `TXOutput.SeedAnchor`
- `TXOutput.SeedChainStep`
- `TXOutput.DefaultSpendAlgorithm`
- `TxCertificate.UserSignatureV2`

### 9.3 钱包迁移策略

必须增加一次本地数据迁移：
- 老账号首次登录后，给缺字段地址自动补默认状态
- 能从后端回包补齐的就补齐
- 不能从后端恢复本地私有 seed 状态的地址，统一标记为“待修复/只读”

## 10. UI 影响总结

| 场景 | 是否必须改 UI | 应怎么改 |
| --- | --- | --- |
| 登录后主页面 | 需要 | 展示地址协议状态，提示哪些地址待修复。 |
| 地址列表 | 需要 | 增加 `已注册 / 待修复 / 不可转出 / seed 步数低` 等状态标识。 |
| 散户主地址注册 | 需要 | 注册失败必须可见，允许重试，不能再静默失败。 |
| 入组页面 | 需要 | 提交前做地址就绪检查，缺少 seed/V2 元数据时阻断。 |
| 转账页面 | 需要 | 发送前阻断未注册或 seed 状态不完整的地址，并显示具体原因。 |
| 胶囊地址页面 | 暂不必须 | 不需要新增协议输入项。 |

一个明确原则：
- 新协议字段应由钱包逻辑自动生成，不应转化为用户手工填写的 UI 表单
- 但这些字段生成失败、缺失、过期、未注册的状态必须对用户可见

## 11. 推荐改造顺序

1. 先统一协议基础层
   - `js/types/blockchain.ts`
   - `js/utils/signature.ts`
   - 新增 V2 envelope 与 base64/seed 序列化工具
2. 再改本地存储和迁移
   - `js/utils/storage.ts`
   - 登录恢复、钱包加载、旧账号迁移
3. 再改所有读接口
   - `auth.ts`
   - `accountQuery.ts`
   - `accountPolling.ts`
4. 再改地址生命周期接口
   - `address.ts`
   - 同时修掉 `mainAddressRegistered` 误置 true 的问题
5. 再改入组接口
   - `group.ts`
6. 最后改交易构造与提交
   - `txBuilder.ts`
   - `transfer.ts`
7. 最后补 UI 阻断与状态展示
   - `pages/main.js`
   - `pages/joinGroup.ts`
   - 转账区相关 UI 模块

这个顺序不能反过来。因为如果先改 `submit-tx`，但钱包里仍没有 seed 状态，本质上还是发不出去。

## 12. 最终执行建议

### 12.1 本轮修复的核心目标

前端下一阶段不要再按“接口一个个修”来做，而应该按下面三件事并行设计：
- 建立 V2 协议模型
- 建立地址协议状态机
- 建立基于 seed-chain 的交易构造器

### 12.2 对后续开发的直接指导

后续所有前端对接修改，都建议遵守以下约束：
- 不再新增任何仅支持旧 `{R,S}` 的新逻辑
- 不再把 seed 元数据当成“只有后端关心”的信息
- 不再允许 UI 在地址未注册或协议状态不完整时继续发交易
- 不再把“读取余额成功”误判为“这个地址已经可用”

### 12.3 一句话结论

以当前后端为准，前端真正需要重做的不是“接口地址”，而是“地址模型、签名模型、交易模型、状态展示”这四层；只要这四层对齐，剩下的大部分路由本身都还能沿用。

