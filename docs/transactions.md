# 交易类型专项说明 (Transaction Mechanisms)

## 1. 交易体系概览
本项目完全遵循 UTXO (Unspent Transaction Output) 模型。每一笔交易都包含若干 Inputs（引用之前的 Outputs）和新的 Outputs。
前端核心职责是**在浏览器端完成交易的完整构造、签名与序列化**，后端节点仅负责验证与广播。

### 三大交易模式
| 特性 | 普通转账 (Normal Transfer) | 快速转账 (Fast/Organization) | 跨链转账 (Cross-Chain) |
| :--- | :--- | :--- | :--- |
| **适用人群** | 散户 (未加入组织) | 组织成员 | 组织成员 (需跨域资产) |
| **底层类型** | `AggregateGTX` | `UserNewTX` | `UserNewTX` (Type=6) |
| **提交节点** | ComNode | AssignNode | AssignNode |
| **共识速度** | 标准 (需聚合) | **极速** (分配节点直接出块) | 标准 (需跨链协议确认) |
| **费用机制** | Gas 竞价 | 组织内定额/免费 | 跨链协议费 |
| **输入源** | 仅 UTXO | UTXO + TXCer (凭证) | UTXO + TXCer |

---

## 2. 交易构造深度解析 (Under the Hood)

交易构造并非简单的字段拼接，而是一个包含**资产调度**与**密码学计算**的复杂过程。

### 2.1 UTXO 选择算法 (Greedy Strategy)
前端使用贪心算法 (Greedy Algorithm) 选择 Input UTXOs：
1.  **资产过滤**：筛选出所有属于当前账户且未被锁定的 UTXO。
2.  **金额排序**：按金额从大到小排序。
3.  **累加逻辑**：
    *   遍历 UTXO 列表，累加金额直到 `total >= targetAmount`。
    *   若遍历结束仍不足，抛出 `Insufficient Balance` 错误。
4.  **找零机制**：
    *   若 `total > targetAmount`，自动生成一个指向自己的 `Change Output`（找零输出）。
    *   `Change Output` 的金额 = `total - targetAmount - GasFee`。

### 2.2 离线签名流程 (Offline Signing Flow)
每一笔输入的 spending 必须由对应的私钥签名解锁。
*   **Step 1: Pre-Image 构建**
    *   提取待引用 Output 的关键特征（TxID, Index, Amount）。
    *   提取当前正在构造的交易摘要（Transaction Digest）。
*   **Step 2: ECDSA 计算**
    *   使用 `elliptic` 库的 P-256 曲线。
    *   `Signature = sign(hash(Pre-Image), PrivateKey)`。
*   **Step 3: 填充**
    *   将生成的 `(R, S)` 填入 `TXInput.InputSignature`。

---

## 3. 详细数据结构 (Data Structures)

### 3.1 普通转账 (AggregateGTX) 载体
提交至 ComNode 的数据包是一个“聚合交易请求”。

```json
{
  "AggrTXType": 2,          // 固定为 2 (Normal)
  "AllTransactions": [
    {
      "TXType": 8,          // 普通 UTXO 交易
      "TXInputsNormal": [
        {
          "FromTXID": "e8a93...", 
          "FromTxPosition": { "Blocknum": 120, "IndexZ": 3 },
          "InputSignature": { "R": "1234...", "S": "5678..." }
        }
      ],
      "TXOutputs": [
        {
          "ToAddress": "1A1zP1...",
          "ToValue": 5000000,
          "ToPublicKey": { "CurveName": "P256", "X": "...", "Y": "..." }
        },
        { "ToAddress": "ChangeAddr...", "ToValue": 1000 } // 找零
      ],
      "InterestAssign": { "Gas": 100 } // 矿工费
    }
  ],
  "TXNum": 1
}
```

### 3.2 快速/跨链转账 (UserNewTX) 载体
提交至 AssignNode 的是带有用户身份签名的“用户请求”。

```json
{
  "TX": {
    "TXID": "calc_by_hash...",
    "TXType": 0,            // 0=普通转账, 6=跨链转账
    "GuarantorGroup": "8888", // 必须指定组织ID
    "TXInputsNormal": [...],
    "TXOutputs": [...]
  },
  "UserID": "User_Account_ID", // 用户的唯一身份ID
  "Sig": { "R": "...", "S": "..." } // 对整个 TX 对象的签名
}
```

---

## 4. 跨链特殊规则 (Cross-Chain Rules)
跨链交易 (`TXType=6`) 是系统中最敏感的操作，前端包含额外的校验层：

1.  **单接收方限制**：`TXOutputs` 数组大小必须严格为 1（不计入找零）。
2.  **地址格式校验**：
    *   目标为 ETH：必须以 `0x` 开头，长度 42 位的 hex 字符串。
    *   目标为 BTC：符合 BTC 地址编码规范（Base58Check 或 Bech32）。
3.  **资产纯度**：跨链仅支持原生积分 PGC，严禁混入其他代币。
4.  **找零隔离**：找零 Output 必须标识为非跨链 (`IsCrossChain=false`)，防止找零资金丢失。

---

## 5. 常见错误代码 (Error Handling)
| 错误类型 | 原因 | 解决方案 |
| :--- | :--- | :--- |
| `ERR_INSUFFICIENT_FUNDS` | UTXO 总和不足以支付转账+手续费 | 提示用户充值或减少金额 |
| `ERR_SIGNATURE_FAILED` | 私钥解密失败或签名校验不通过 | 检查密码或重置账户 |
| `ERR_UTXO_LOCKED` | 选中的 UTXO 正处于 Pending 状态 | 等待上一笔交易上链 (Settle) |
| `ERR_INVALID_CROSS_ADDR` | 跨链目标地址格式错误 | 检查 ETH/BTC 地址格式 |

---

## 6. 开发者调试建议
*   **查看构造结果**：在 `js/services/txBuilder.ts` 中打断点，观察 `buildTransaction` 返回的 JSON 对象。
*   **验证签名**：使用 `js/utils/signature.ts` 提供的 `verify` 方法自测生成的签名是否可以通过公钥验证。
*   **模拟状态**：在开发环境中即使没有后端，也可以通过 Mock UTXO 数据来测试 UTXO 选择算法的正确性。
