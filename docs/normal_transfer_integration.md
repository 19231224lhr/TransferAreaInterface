# 前端对接文档：普通转账 (Normal Transfer)

本文档详细描述了当用户未加入担保组织时，如何构建并发送“普通转账”交易。

## 1. 触发条件与场景

*   **场景**：用户未加入任何担保组织（散户）。
*   **判断条件**：前端检查用户的 `GuarantorGroupID` 为空字符串 `""`。
*   **特点**：
    *   无法使用 TXCer（交易凭证），只能使用 UTXO。
    *   **不经过担保节点**（AssignNode），直接发送给 **ComNode**（担保委员会）。
    *   交易结构不同：普通转账需要被包装在 `AggregateGTX` 中直接提交。
    *   速度可能较慢，Gas 费计算可能不同（目前暂按标准计算）。

## 2. 交易构建流程

普通转账的构建过程与现有转账有显著差异，主要体现在**交易类型**和**外层包装**上。

### A. 核心交易结构 (`core.Transaction`)

构建内部的 `Transaction` 对象：

| 字段 | 值/说明 | 备注 |
| :--- | :--- | :--- |
| **TXType** | **8** | **关键差异**：普通转账类型为 8 |
| **TXInputsNormal** | 选中的 UTXO 列表 | 只能使用 UTXO，不能使用 TXCer |
| **TXInputsCertificate** | 空数组 `[]` | 散户无法使用 TXCer |
| **TXOutputs** | 目标 Output 列表 | 与普通交易一致 |
| **IsGuarMake** | `false` | Input/Output 中均设为 false |
| **InterestAssign** | 正常计算 | 包含 Gas 和利息分配 |
| **UserSignature** | 用户私钥签名 | 对整个 TX 进行签名 |

### B. 外层包装结构 (`core.AggregateGTX`)

构建完 `Transaction` 后，**不要**像担保交易那样封装进 `UserNewTX`，而是必须封装进 **`AggregateGTX`**。

#### 1. 结构体定义

前端需构造与后端完全一致的 JSON 结构，用于哈希计算和验签。

```typescript
// 类型定义参考
interface AggregateGTXWrapper {
    AggrTXType: number;       // 固定为 2 (散户交易聚合)
    IsGuarCommittee: boolean; // 固定为 false
    IsNoGuarGroupTX: boolean; // 固定为 true
    GuarantorGroupID: string; // 固定为 ""
    GuarantorGroupSig: {      // 空签名结构
        R: null;
        S: null;
    };
    TXNum: number;            // 固定为 1
    TotalGas: number;         // 0 (散户转账暂不涉及聚合层面的额外 Gas)
    TXHash: string;           // 计算出的 AggregateGTX 哈希 (Hex 字符串，后端为 []byte)
    TXSize: number;           // 0 (构造时暂填 0，后端会自动计算)
    Version: number;          // 1.0
    AllTransactions: any[];   // 包含上面构建的 core.Transaction 数组
}
```

#### 2. 哈希计算逻辑 (GetATXHash)

后端 `GetATXHash` 的逻辑是：
1.  **序列化**：将结构体转为 JSON 字符串。
2.  **排除字段**：在序列化时**必须排除** `GuarantorGroupSig`、`TXHash`、`TXSize` 三个字段。
3.  **计算哈希**：对生成的 JSON 字符串进行 SHA-256 计算。

**前端实现步骤 (JS/TS):**

```typescript
import { sha256 } from 'js-sha256'; // 或其他 crypto 库

function calculateATXHash(atx: any): string {
    // 1. 创建副本并移除排除字段
    const hashPayload = { ...atx };
    delete hashPayload.GuarantorGroupSig;
    delete hashPayload.TXHash;
    delete hashPayload.TXSize;

    // 2. 序列化 (关键：Key 顺序必须与后端一致，或者后端使用标准 JSON 库通常按字母序或定义序？)
    // ⚠️ 后端 Go 的 json.Marshal 默认按结构体定义顺序，但 map 是无序的。
    // 该项目核心库 `SerializeStruct` 使用的是标准 `json.Marshal`。
    // 为确保一致性，前端建议严格按照后端结构体字段顺序构建对象进行 stringify，
    // 或者最好只依赖后端验证（如果可以的话）。
    // 但此处我们需要 TXHash 字段本身，所以必须在前端算。
    
    // 建议：前端构造完整对象，移除字段后，使用 canonical-json 库或确定的 Key 顺序。
    // 如果后端校验严格，这里是最大的坑。
    // 对于 Go json.Marshal，只要字段名匹配即可。
    
    const jsonString = JSON.stringify(hashPayload); 
    
    // 3. 计算 SHA-256
    // 注意：后端返回是 []byte，JSON 中通常表现为 Base64 字符串。
    // 但此处 TXHash 字段在 JSON 中定义为 []byte 类型。
    // 如果是 Hex 字符串交互，需转换。
    // 根据 `gateway.go`，接收的是 JSON，TXHash 字段是 []byte (在 JSON 中是 Base64字符串)。
    
    // 修正：后端 `AggregateGTX` 中 `TXHash` 是 `[]byte`。在 Go JSON 中，`[]byte` 默认编码为 Base64 字符串。
    // 因此前端 calculatedHash 应该转为 Base64 赋值给 TXHash。
    
    // 下面假设使用 Hex 也可以（取决于后端怎么解析，标准库是 Base64）。
    // 实际上查看 `comnode.go`：
    // VerifyNoGroupTX -> 验证逻辑并没有重新计算 Hash 来比对 TXHash 字段，
    // 而是验证签名是否匹配。
    // 但作为唯一标识，TXHash 最好正确。
    
    return sha256.base64(jsonString); // 假设后端需要 Base64
}
```

#### 3. 构造最终对象

```typescript
// 1. 准备基础对象
const atxCheck = {
    AggrTXType: 2,
    IsGuarCommittee: false,
    IsNoGuarGroupTX: true,
    GuarantorGroupID: "",
    GuarantorGroupSig: { R: null, S: null }, // 空签名占位
    TXNum: 1,
    TotalGas: 0,
    // TXHash: 待计算
    // TXSize: 0
    Version: 1.0,
    AllTransactions: [ { ...tx, TXType: 8 } ]
};

// 2. 计算 Hash（模拟后端排除字段后的序列化）
// 注意：前端可能很难完全模拟 Go 的 json.Marshal 细节（如浮点数精度、空值处理）。
// 若遇到 "Hash Mismatch" 错误，需要调试后端日志。
// 但对于普通转账，主要验证的是内部 AllTransactions[0] 的 UserSignature。
// 外层的 TXHash 主要用于索引，**签名验证才是关键**。

// 3. 填充
const finalATX = {
    ...atxCheck,
    TXHash: calculateATXHash(atxCheck), // 赋值计算出的 Hash (Base64)
    TXSize: 0 
};
```

**关于签名的特别说明**：
普通转账（散户交易）**不需要**外层的 `GuarantorGroupSig`（因为没有担保组织）。后端 `VerifyNoGroupTX` 主要验证内部 `Transaction` 的 `UserSignature`（针对 UTXO 的花费签名）。因此外层 `GuarantorGroupSig` 留空即可。

### C. 序列化与编码细节

1.  **字段顺序与空值**：Go 的 `json.Marshal` 会忽略 `omitempty` 标签的空字段。如果后端结构体没有 `omitempty`，则包含了零值。
    *   `AggregateGTX` 中大多字段无 `omitempty`。
    *   **浮点数**：Go `float64` 序列化时，整数如 `1.0` 可能变为 `1`。前端需注意 `Version: 1.0` 可能变为 `1`。
2.  **字节数组 (`[]byte`)**：
    *   `TXHash`、`Data` 等 `[]byte` 类型字段，在 JSON 中必须须编码为 **Base64 字符串**。
    *   例如：如果 Hash 是 `0x1234...`，需转为 Base64 `"EjR..."`。
3.  **大整数 (`big.Int`)**：
    *   签名中的 `R` 和 `S` 是 `*big.Int`。Go JSON 默认将其序列化为数字（如果小）或字符串？
    *   不，Go `math/big` 默认 marshal 为 **数字**（JSON Number）。但如果是非常大的数，可能会溢出 JS 的 Number。
    *   然而，项目中的 `EcdsaSignature` 包含 `R` 和 `S` (*big.Int)。
    *   建议：前端发送时尝试使用 **数字** 或 **字符串**。通常为了安全，区块链项目常自定义 Marshal 为字符串。需检查 `core` 库是否自定义了 `MarshalJSON`。
    *   (根据之前的文件查看，未发现自定义 MarshalJSON，默认行为是数字。如果 JS 精度不足，可以尝试传字符串，看后端能否解析。或者后端使用 `json.Number`)。

**最佳实践**：鉴于前端 JS 对于 64 位整数和浮点数的精度问题，建议在测试阶段重点关注 JSON 序列化格式的兼容性。


## 3. 接口调用

*   **目标节点**：ComNode (Gateway)
*   **HTTP 方法**：`POST`
*   **端点 (Endpoint)**：`/api/v1/com/submit-noguargroup-tx`
*   **请求体**：JSON 格式的 `AggregateGTX` 对象。

### 请求示例

```http
POST /api/v1/com/submit-noguargroup-tx
Content-Type: application/json

{
    "AggrTXType": 2,
    "IsNoGuarGroupTX": true,
    "IsGuarCommittee": false,
    "TXNum": 1,
    "Version": "1.0",
    "AllTransactions": [
        {
            "TXType": 8,
            "TXID": "...",
            "TXInputsNormal": [...],
            "TXOutputs": [...],
            "UserSignature": "..."
        }
    ],
    "TXHash": "..."
}
```

### 响应示例

```json
{
    "success": true,
    "tx_hash": "0000..."
}
```

## 4. 前端开发 Checklist

- [ ] **状态判断**：在 `transfer.ts` 或 `txBuilder.ts` 中，检查当前用户是否已加入担保组织。
- [ ] **分支处理**：
    -   **已加入**：走现有流程（构建 `UserNewTX` -> 发送给 `AssignNode`）。
    -   **未加入**：走新流程（构建 `AggregateGTX` -> 发送给 `ComNode`）。
- [ ] **TXType 设置**：确保未加入组织的交易 `TXType` 设为 `8`。
- [ ] **Hash 计算**：前端需要实现 `AggregateGTX` 的哈希计算逻辑（用于填充 `TXHash` 字段）。
- [ ] **API 适配**：在 `comNodeEndpoint.ts` 中新增 `submitNoGuarGroupTX` 方法。

## 5. 差异对比总结

| 特性 | 担保交易 (Guarantor Transfer) | 普通转账 (Normal Transfer) |
| :--- | :--- | :--- |
| **适用人群** | 加入担保组织的用户 | 未加入组织的散户 |
| **交易类型 (TXType)** | 0 (普通), 1 (TXCer), 6 (跨链) | **8** |
| **可以使用 TXCer** | 是 | **否** |
| **包装结构** | `UserNewTX` | **`AggregateGTX`** |
| **接收节点** | AssignNode (担保节点) | **ComNode (担保委员会)** |
| **API 端点** | `/api/v1/{gid}/assign/submit-tx` | **`/api/v1/com/submit-noguargroup-tx`** |
