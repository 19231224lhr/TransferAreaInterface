# 查询账户信息（query-address）前端对接指南

> 目标：前端通过 HTTP/Gateway 调用 ComNode (Leader) 的"查询账户信息"接口，获取指定地址的**余额、UTXO、利息、所属担保组织**等完整账户数据。

---

## 接口信息

- **方法**：`POST`
- **路径**：`/api/v1/com/query-address`
- **说明**：
  - 该接口由 **担保委员会的 Leader 节点**提供服务（非 Leader 节点不处理请求）。
  - **无需签名**：这是纯查询接口，不会修改状态，因此不需要用户签名。
  - **支持批量查询**：一次请求可查询多个地址的信息。
  - **实时利息计算**：返回的利息是根据当前区块高度实时计算的最新值。

### 如何获取 ComNode 的端口？

由于 ComNode 可能运行在不同的端口（如 8081），前端需要先查询 ComNode 的 API 端点。

**快速示例：**
```javascript
// 查询 ComNode 端点
const endpointResp = await fetch('http://localhost:8080/api/v1/committee/endpoint');
const endpointData = await endpointResp.json();
const comNodeURL = `http://localhost${endpointData.endpoint}`;

// 使用查询到的端点访问 ComNode API
const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
  method: 'POST',
  body: JSON.stringify({ address: [...] })
});
```

> **详细说明**：关于如何查询和缓存 ComNode 端点的完整指南，请参阅：[查询担保委员会端口前端对接指南](./查询担保委员会端口(committee-endpoint)前端对接指南.md)

---

## 适用场景

1. **用户登录后查询钱包余额**：展示用户所有地址的当前余额和利息
2. **散户地址查询**：查询不在担保组织内的地址（散户）的账户信息
3. **交易前余额确认**：构造交易前确认 UTXO 可用余额
4. **实时利息查询**：查看地址累积的最新利息

---

## 请求结构

### 请求体（JSON）

```json
{
  "address": ["地址1", "地址2", ...]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| **address** | string[] | 是 | 要查询的地址列表（十六进制字符串） |

### 示例

```json
{
  "address": [
    "43ead0582ac853f1fbdc664a6d4b1e4602728769",
    "9e968838ad797337c9e75f07048615fad4f503df",
    "b26703a6876afc3eb95d280c7c5eb582c90c8d67"
  ]
}
```

---

## 响应结构：`ReturnNodeAddressMsg`

后端结构体定义：

```go
type ReturnNodeAddressMsg struct {
    FromGroupID string                      // 响应的委员会组ID
    AddressData map[string]PointAddressData // 地址 → 账户数据
    Sig         EcdsaSignature              // 委员会签名（Gateway 场景暂未启用）
}

type PointAddressData struct {
    Value        float64             // 地址总余额
    Type         int                 // 金额类型（0:盘古币, 1:比特币, 2:以太坊）
    Interest     float64             // 地址总利息（实时计算）
    GroupID      string              // 所属担保组织ID（空字符串表示散户）
    PublicKeyNew PublicKeyNew        // 地址对应的公钥
    UTXO         map[string]UTXOData // 地址拥有的UTXO信息（UTXO标识 → UTXO内容）
    LastHeight   int                 // 上次更新此地址时的区块高度
}
```

### 响应字段说明

#### ReturnNodeAddressMsg

| 字段 | 类型 | 说明 |
|-----|------|------|
| **FromGroupID** | string | 响应的委员会ID（当前系统中固定） |
| **AddressData** | map | 地址到账户数据的映射表 |
| **Sig** | EcdsaSignature | 委员会签名（当前 Gateway 版本可忽略） |

#### PointAddressData

| 字段 | 类型 | 说明 |
|-----|------|------|
| **Value** | float64 | 地址总余额 |
| **Type** | int | 金额类型（0=盘古币, 1=比特币, 2=以太坊） |
| **Interest** | float64 | 地址总利息（已按当前区块高度实时计算） |
| **GroupID** | string | 所属担保组织ID（`""` 表示散户，`"1"` 或其他表示在担保组织内） |
| **PublicKeyNew** | PublicKeyNew | 地址对应的公钥（包含 CurveName, X, Y） |
| **UTXO** | map[string]UTXOData | 地址拥有的 UTXO 列表（键为 UTXO 标识符） |
| **LastHeight** | int | 该地址上次更新时的区块高度 |

---

## 响应示例

### 成功响应（HTTP 200）

```json
{
  "FromGroupID": "10000000",
  "AddressData": {
    "43ead0582ac853f1fbdc664a6d4b1e4602728769": {
      "Value": 1000.5,
      "Type": 0,
      "Interest": 12.345,
      "GroupID": "10000000",
      "PublicKeyNew": {
        "CurveName": "P256",
        "X": 11472735721830145684965955956148475109025964549154844719363009593499415380274,
        "Y": 30934572422511172547106483385470583118388942792255160130322980067747597230459
      },
      "UTXO": {
        "txid1:0": {
          "Value": 500.0,
          "Type": 0
        },
        "txid2:1": {
          "Value": 500.5,
          "Type": 0
        }
      },
      "LastHeight": 12345
    },
    "9e968838ad797337c9e75f07048615fad4f503df": {
      "Value": 0,
      "Type": 0,
      "Interest": 0,
      "GroupID": "",
      "PublicKeyNew": {
        "CurveName": "P256",
        "X": 0,
        "Y": 0
      },
      "UTXO": {},
      "LastHeight": 0
    }
  },
  "Sig": {
    "R": 0,
    "S": 0
  }
}
```

### 失败响应

#### 503 - Leader 节点不可用

```json
{
  "error": "ComNode (Leader) not registered"
}
```

或

```json
{
  "error": "not leader node, please retry later"
}
```

#### 400 - 请求格式错误

```json
{
  "error": "Invalid request body"
}
```

---

## 地址状态说明

### 1. 地址存在且有余额

```json
{
  "Value": 1000.5,      // 有余额
  "Interest": 12.345,   // 有利息
  "GroupID": "10000000", // 在担保组织内
  "UTXO": { ... }       // 有 UTXO
}
```

### 2. 地址存在但无余额（散户）

```json
{
  "Value": 0,
  "Interest": 0,
  "GroupID": "",        // 空字符串表示散户
  "UTXO": {}
}
```

### 3. 地址不存在

返回空的 `PointAddressData` 对象（所有字段为零值）：

```json
{
  "Value": 0,
  "Type": 0,
  "Interest": 0,
  "GroupID": "",
  "PublicKeyNew": {
    "CurveName": "",
    "X": 0,
    "Y": 0
  },
  "UTXO": {},
  "LastHeight": 0
}
```

---

## 推荐前端对接流程

### 1. 获取用户地址列表

前端应维护用户的地址列表，可从以下途径获取：
- **登录时**：`POST /api/v1/re-online` 返回的 `UserWalletData.SubAddressMsg`
- **新建地址后**：`POST /api/v1/{groupID}/assign/new-address` 成功后缓存
- **本地存储**：LocalStorage 或 IndexedDB 中缓存的地址列表

### 2. 构造查询请求

```javascript
// 示例：查询用户所有地址的账户信息
const userAddresses = [
  "43ead0582ac853f1fbdc664a6d4b1e4602728769",
  "9e968838ad797337c9e75f07048615fad4f503df"
];

const queryRequest = {
  address: userAddresses
};
```

### 3. 发送请求

```javascript
try {
  // 获取 ComNode 端点（关于如何获取和缓存端点，请参阅"查询担保委员会端口前端对接指南"）
  const comNodeURL = 'http://localhost:8081';  // 示例：假设已从 BootNode 查询到

  const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(queryRequest)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('查询失败:', error.error);
    
    // 如果是 503，Leader 节点可能正在切换，提示用户稍后重试
    if (response.status === 503) {
      console.log('Leader 节点暂时不可用，请稍后重试');
    }
    return;
  }

  const result = await response.json();
} catch (error) {
  console.error('请求失败:', error);
}
```

> **提示**：关于如何动态获取 ComNode 端点、缓存策略、错误处理等完整实现，请参阅：[查询担保委员会端口前端对接指南](./查询担保委员会端口(committee-endpoint)前端对接指南.md)

### 4. 处理响应数据

```javascript
// result.AddressData 是一个对象，键为地址，值为账户数据
const addressData = result.AddressData;

// 计算总余额
let totalBalance = 0;
let totalInterest = 0;

for (const [address, data] of Object.entries(addressData)) {
  if (data.Value > 0) {
    totalBalance += data.Value;
    totalInterest += data.Interest;
    
    console.log(`地址 ${address}:`);
    console.log(`  余额: ${data.Value}`);
    console.log(`  利息: ${data.Interest}`);
    console.log(`  所属组织: ${data.GroupID || '散户'}`);
    console.log(`  UTXO 数量: ${Object.keys(data.UTXO).length}`);
  }
}

console.log(`总余额: ${totalBalance}`);
console.log(`总利息: ${totalInterest}`);
```

### 5. 展示余额和 UTXO

```javascript
// 渲染余额卡片
function renderBalanceCard(address, data) {
  return {
    address: address,
    balance: data.Value,
    interest: data.Interest,
    totalAssets: data.Value + data.Interest,
    utxoCount: Object.keys(data.UTXO).length,
    isInGroup: data.GroupID !== "",
    groupId: data.GroupID,
    lastUpdated: `区块高度 ${data.LastHeight}`
  };
}

// 处理所有地址
const balanceCards = Object.entries(addressData)
  .filter(([_, data]) => data.Value > 0 || data.Interest > 0)
  .map(([address, data]) => renderBalanceCard(address, data));
```

---

## 完整调用示例（curl）

```bash
# 注意：ComNode 端口可能是 8081 或其他，需要先通过 BootNode 查询
# 查询端口：curl http://localhost:8080/api/v1/committee/endpoint

curl -X POST "http://localhost:8081/api/v1/com/query-address" \
  -H "Content-Type: application/json" \
  -d '{
    "address": [
      "43ead0582ac853f1fbdc664a6d4b1e4602728769",
      "9e968838ad797337c9e75f07048615fad4f503df"
    ]
  }'
```

---

## 常见问题

### 1. 为什么这个接口不需要签名？

因为这是**纯查询接口**，不会修改任何状态。任何人都可以通过地址查询公开的账户信息（余额、UTXO 等），这符合区块链的透明性原则。

### 2. 如果查询的地址不存在会怎样？

不会报错，而是返回一个**空的 `PointAddressData` 对象**（所有字段为零值）。前端可以通过 `Value === 0 && LastHeight === 0` 来判断地址是否存在。

### 3. 返回的利息是如何计算的？

利息是**实时计算**的：

```
新增利息 = 余额 × (当前区块高度 - 上次更新高度) × 汇率 × 利率
总利息 = 历史累积利息 + 新增利息
```

后端会在返回前自动计算到最新区块高度的利息，所以前端无需再次计算。

### 4. 如果 Leader 节点不可用（503）怎么办？

Leader 节点可能因为以下原因不可用：
- 节点正在启动
- Leader 正在切换
- 节点暂时下线

**建议处理方式**：
```javascript
if (response.status === 503) {
  // 提示用户稍后重试
  setTimeout(() => retryQuery(), 3000); // 3秒后重试
}
```

### 5. UTXO 数据的格式是什么？

`UTXO` 是一个 map，键为 UTXO 标识符（格式：`txid:index`），值为 `UTXOData`：

```json
"UTXO": {
  "abc123def456:0": {
    "Value": 100.0,
    "Type": 0
  },
  "abc123def456:1": {
    "Value": 50.5,
    "Type": 0
  }
}
```

前端可以用这些 UTXO 来构造交易输入。

### 6. 如何判断地址是在担保组织内还是散户？

通过 `GroupID` 字段判断：
- `GroupID === ""` 或 `GroupID === "1"`：散户
- `GroupID === "10000000"` 等其他值：在担保组织内

```javascript
function isUserInGroup(data) {
  return data.GroupID !== "" && data.GroupID !== "1";
}
```

### 7. 可以一次查询多少个地址？

理论上没有硬性限制，但建议**单次请求不超过 100 个地址**，以避免：
- 请求体过大
- 响应时间过长
- 超出后端处理能力

如果需要查询更多地址，可以分批查询。

### 8. 查询频率有限制吗？

当前实现**没有频率限制**，但建议：
- **登录时查询一次**，缓存结果
- **用户主动刷新时查询**
- **交易前查询确认余额**
- 避免高频轮询（如每秒一次），推荐使用轮询间隔 ≥ 5 秒

---

## 与登录接口的关系

### 登录时已返回钱包数据，为什么还需要这个接口？

1. **登录返回的数据可能过期**：
   - 登录后用户余额可能发生变化（收到转账、利息增长）
   - 需要实时查询最新状态

2. **登录接口只返回用户所属担保组织的数据**：
   - 如果用户是散户，登录接口返回的数据有限
   - 此接口可以查询**任意地址**，无论是否在担保组织内

3. **支持查询其他用户的地址**：
   - 前端可以查询其他用户的公开地址信息
   - 用于显示转账对象的余额等

### 推荐使用场景

| 场景 | 推荐接口 | 说明 |
|-----|---------|------|
| 用户登录 | `POST /api/v1/re-online` | 登录时拿到初始钱包数据 + 担保组织信息 |
| 刷新余额 | `POST /api/v1/com/query-address` | 实时查询最新余额和利息 |
| 交易前确认 | `POST /api/v1/com/query-address` | 确认 UTXO 可用余额 |
| 查询他人地址 | `POST /api/v1/com/query-address` | 查询转账对象的地址状态 |

---

## 注意事项

1. **只有 Leader 节点提供服务**：
   - 如果 Leader 不可用，请求会返回 503
   - 非 Leader 的委员会成员节点不会响应此接口

2. **利息是实时计算的**：
   - 返回的 `Interest` 字段已经是最新值
   - 前端无需再次计算利息

3. **地址不存在不会报错**：
   - 不存在的地址返回空数据对象
   - 前端需要自行判断地址是否有效

4. **UTXO 数据可能很大**：
   - 如果地址有大量 UTXO，响应体可能较大
   - 建议前端做好加载状态提示

5. **`big.Int` 字段是 JSON number**：
   - `PublicKeyNew.X/Y` 在 JSON 中是数字字面量
   - 前端需要使用 `BigInt` 或字符串来处理（避免精度丢失）

6. **批量查询建议分批**：
   - 单次请求建议 ≤ 100 个地址
   - 如果需要查询更多，可以分批并发请求

---

## TypeScript 类型定义参考

```typescript
// 请求
interface QueryAddressRequest {
  address: string[];
}

// 响应
interface ReturnNodeAddressMsg {
  FromGroupID: string;
  AddressData: Record<string, PointAddressData>;
  Sig: EcdsaSignature;
}

interface PointAddressData {
  Value: number;
  Type: number;
  Interest: number;
  GroupID: string;
  PublicKeyNew: PublicKeyNew;
  UTXO: Record<string, UTXOData>;
  LastHeight: number;
}

interface PublicKeyNew {
  CurveName: string;
  X: string | number;  // 建议前端处理为 string
  Y: string | number;
}

interface UTXOData {
  Value: number;
  Type: number;
}

interface EcdsaSignature {
  R: string | number;
  S: string | number;
}
```

---

## 完整前端示例（React）

```typescript
import { useState, useEffect } from 'react';

interface AddressBalance {
  address: string;
  balance: number;
  interest: number;
  total: number;
  utxoCount: number;
  isInGroup: boolean;
  groupId: string;
}

function useAddressBalances(addresses: string[]) {
  const [balances, setBalances] = useState<AddressBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    if (addresses.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // 注意：实际使用时应先查询 ComNode 端点
      // 完整实现请参阅"查询担保委员会端口前端对接指南"
      const comNodeURL = 'http://localhost:8081';  // 示例端口
      
      const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addresses })
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Leader 节点暂时不可用，请稍后重试');
        }
        throw new Error('查询失败');
      }

      const result = await response.json();
      const balanceList: AddressBalance[] = [];

      for (const [addr, data] of Object.entries(result.AddressData)) {
        const addressData = data as any;
        balanceList.push({
          address: addr,
          balance: addressData.Value,
          interest: addressData.Interest,
          total: addressData.Value + addressData.Interest,
          utxoCount: Object.keys(addressData.UTXO || {}).length,
          isInGroup: addressData.GroupID !== "" && addressData.GroupID !== "1",
          groupId: addressData.GroupID
        });
      }

      setBalances(balanceList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [addresses.join(',')]);

  return { balances, loading, error, refetch: fetchBalances };
}

// 使用示例
function BalanceView() {
  const userAddresses = [
    "43ead0582ac853f1fbdc664a6d4b1e4602728769",
    "9e968838ad797337c9e75f07048615fad4f503df"
  ];

  const { balances, loading, error, refetch } = useAddressBalances(userAddresses);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  const totalAssets = balances.reduce((sum, b) => sum + b.total, 0);

  return (
    <div>
      <h2>总资产: {totalAssets.toFixed(2)}</h2>
      <button onClick={refetch}>刷新</button>
      {balances.map(b => (
        <div key={b.address}>
          <p>地址: {b.address}</p>
          <p>余额: {b.balance} + 利息: {b.interest}</p>
          <p>UTXO: {b.utxoCount} 个</p>
          <p>状态: {b.isInGroup ? `在组织 ${b.groupId}` : '散户'}</p>
        </div>
      ))}
    </div>
  );
}
```

