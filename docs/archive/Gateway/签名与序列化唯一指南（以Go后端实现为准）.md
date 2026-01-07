# 签名与序列化唯一指南（以 Go 后端实现为准）

> **适用范围**：前端调用 AssignNode / Gateway 的所有“需要签名”的 HTTP API（如 `flow-apply`、`new-address`、`re-online`、`submit-tx` 等）。  
> **本文件是唯一权威口径**：请勿再参考旧文档或自行推断 JSON 格式/排除字段规则。

---

## 后端到底在做什么（必须完全复刻）

后端对“结构体签名/验签”的核心流程是：

1. **序列化结构体（排除字段用置零值，不是删除）**  
2. 对序列化得到的 **JSON 字节数组** 做 **SHA-256**  
3. 用 **ECDSA P-256** 私钥对哈希签名得到 `(R,S)`  
4. 验签时，对同一份“排除字段置零后的序列化 JSON 字节”求哈希，再用公钥验证 `(R,S)`

对应后端真实实现（务必以此为准）：

```80:224:core/generalmethod.go
// SerializeStruct: 排除字段会被 reflect.Zero() 置零，而不是删除字段
func SerializeStruct(data interface{}, excludeFields ...string) ([]byte, error) {
    // ...
    for _, field := range excludeFields {
        fieldValue := vCopy.FieldByName(field)
        if fieldValue.IsValid() && fieldValue.CanSet() {
            fieldValue.Set(reflect.Zero(fieldValue.Type()))
        } else {
            return nil, fmt.Errorf("field %s not found or cannot be set", field)
        }
    }
    buf, err := json.Marshal(v.Interface())
    return buf, nil
}

// GetStructHash: 对 SerializeStruct 的结果做 sha256
func GetStructHash(data interface{}, excludeFields ...string) ([]byte, error) {
    ser, err := SerializeStruct(data, excludeFields...)
    hash := sha256.Sum256(ser)
    return hash[:], nil
}

// SignStruct / VerifyStructSig
func SignStruct(data interface{}, privateKey ecdsa.PrivateKey, excludeFields ...string) (EcdsaSignature, error) { /*...*/ }
func VerifyStructSig(signature EcdsaSignature, key ecdsa.PublicKey, data interface{}, excludeFields ...string) error { /*...*/ }
```

`UserFlowMsg` 这种消息的签名/验签封装在：

```294:319:core/guargroup.go
func (u *UserFlowMsg) GetFlowUserSig(key ecdsa.PrivateKey) (EcdsaSignature, error) {
    sig, err := SignStruct(u, key, "UserSig")
    return sig, err
}

func (u *UserFlowMsg) VerifyFlowUserSig(key ecdsa.PublicKey) error {
    return VerifyStructSig(u.UserSig, key, u, "UserSig")
}
```

---

## 最关键的 3 个“坑”（照做就不会验签失败）

### 1) 排除字段 **不能 delete，必须置零值**

后端排除字段方式是 `reflect.Zero(fieldType)`，不是“删字段”。  
因此前端签名时 **必须保持字段存在**，只是把值设成零值。

以 `EcdsaSignature` 为例：

```19:31:core/signature.go
type EcdsaSignature struct {
    R   *big.Int
    S   *big.Int
    sig ecdsa.PublicKey
}
```

`R`/`S` 是 `*big.Int` 指针，零值是 `nil`，JSON 序列化为：

```json
{"R":null,"S":null}
```

所以：
- **排除 `UserSig` / `Sig`**：必须设置为 `{"R":null,"S":null}`  
- **不要**把 `UserSig` 字段直接删掉（delete/omit 都不行）

### 2) `*big.Int` 在当前后端 JSON 中是 **数字（不带引号）**

本项目的 `PublicKeyNew.X/Y`、`EcdsaSignature.R/S` 都是 `*big.Int`。  
在你们当前代码与运行环境中（Go 版本、`math/big` 的 JSON 行为），它们会被序列化成 **JSON number**（不带引号）。

后端单测输出可直接证明这一点（`core/core_test/signature_test.go` 会打印）：`X`/`Y` 没有引号。

因此前端发给后端时，必须用 **十进制数字字面量（不带引号）**，例如：

```json
{
  "CurveName": "P256",
  "X": 123456789,
  "Y": 987654321
}
```

同理签名 `(R,S)` 也应发成：

```json
{"R":123,"S":456}
```

#### ⚠️ 常见错误：出现“带双引号的字符串”（会直接反序列化失败）

你必须传的是 **JSON number**（不带引号）：

```json
{ "X": 4769 }
```

**不要**把字符串再 `JSON.stringify` 一次或人为拼上引号，导致变成：

```json
{ "X": "4769" }
```

后端看到这种值会报类似错误（你日志里的根因就是这个）：

```
math/big: cannot unmarshal "\"4769...\"" into a *big.Int
```

> 结论：`X/Y/R/S/D` 这类 `*big.Int` 字段，前端必须以 **不带引号的数字**发送。

### 3) 时间戳不是 Unix epoch，而是 **从 2020-01-01 UTC 起算的秒数**

后端时间戳实现：

```28:41:core/generalmethod.go
func GetTimestamp() uint64 {
    customStartTime := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
    duration := time.Now().Sub(customStartTime)
    return uint64(duration.Seconds())
}
```

所以前端的 `TimeStamp` 必须按同样纪元计算（否则会触发“5 分钟过期”校验）。

---

## 前端应该如何生成“与后端一致”的签名输入 JSON

### 签名输入 = SerializeStruct(data, excludeFields...) 的输出

前端必须生成一段 **UTF-8 JSON 字节**，其语义等价于：

1. 取要签名的对象（例如 `UserFlowMsg`）
2. 对每个排除字段（如 `UserSig` / `Sig`）：
   - 如果字段类型是签名结构体：置为 `{"R":null,"S":null}`
   - 其它字段：置为类型零值（字符串=空串，数字=0，布尔=false，对象=零值对象）
3. 按 JSON 规则序列化为字符串，并以 UTF-8 编码成字节
4. 对字节做 SHA-256

> 后端对 **struct 字段**输出顺序由 Go `json.Marshal` 决定（按结构体字段定义顺序）。  
> 对 `map[string]...`，Go 会按 key 排序输出。  
> ⚠️ 前端不要对“整个对象”做全局 key 排序（会改变 struct 字段顺序导致签名不一致）。前端只需要对 **map 字段**（如 `AddressMsg`）做 key 排序即可。

---

## flow-apply（加入/退出担保组织）请求体与签名规则

### 请求体结构（字段名必须与 Go 结构体导出字段一致）

后端 `core.UserFlowMsg` 定义如下（无 json tag，字段名就是 JSON key）：

```104:117:core/guargroup.go
type UserFlowMsg struct {
    Status int
    UserID      string
    UserPeerID  string
    GuarGroupID string
    UserPublicKey PublicKeyNew
    AddressMsg    map[string]FlowAddressData
    TimeStamp uint64
    UserSig   EcdsaSignature
}
```

### 签名规则

- **签名算法**：ECDSA P-256  
- **哈希算法**：SHA-256  
- **排除字段**：`UserSig`（置零值，不能删除）  
- **签名输入 JSON**：对“置零后的整包 `UserFlowMsg`”做 JSON 序列化得到的 UTF-8 字节  
- **签名输出**：`UserSig = {R,S}`，其中 R/S 是十进制字符串

### 退出（Status=0）最小示例

```json
{
  "Status": 0,
  "UserID": "12345678",
  "UserPeerID": "",
  "GuarGroupID": "10000000",
  "UserPublicKey": {"CurveName":"P256","X":"...","Y":"..."},
  "AddressMsg": {},
  "TimeStamp": 157024800,
  "UserSig": {"R":"...","S":"..."}
}
```

> 退出时 `AddressMsg` 可以为空对象 `{}`。  
> 但签名输入里 `UserSig` 必须先置为 `{"R":null,"S":null}` 再做 hash/sign。

---

## TypeScript 参考实现（可直接使用/改造）

> 目标：**生成与 Go 后端 `SerializeStruct` 等价**的 JSON 字符串（UTF-8），再做 sha256 + ECDSA。

```ts
import { ec as EC } from "elliptic";
import { sha256 } from "js-sha256";

const ec = new EC("p256");

export type EcdsaSigWire = { R: bigint; S: bigint };

// 1) 置零排除字段（与后端 reflect.Zero 对齐：签名字段置为 {R:null,S:null}）
function applyExcludeZeroValue(obj: any, exclude: string[]) {
  for (const k of exclude) {
    if (k === "UserSig" || k === "Sig" || k === "GroupSig" || k === "UserSignature") {
      obj[k] = { R: null, S: null };
    }
  }
}

// 2) big.Int wire：本项目约定传十进制字符串
//    如果你本地用 bigint 保存，请在 stringify 前转成 decimal string
function bigintReplacer(_k: string, v: any) {
  // JSON 不支持 bigint；先转成十进制字符串，稍后再把特定字段去引号变成 number 字面量
  return typeof v === "bigint" ? v.toString(10) : v;
}

// 3) 仅对“map 字段”做 key 排序（匹配 Go 对 map[string] 的排序输出）
function sortKeysShallow(obj: Record<string, any>) {
  const keys = Object.keys(obj).sort();
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

// 4) 将 big.Int 相关字段（十进制字符串）去引号，变成 JSON number 字面量
//    仅针对固定字段名：X/Y/R/S/D
function serializeForBackend(obj: any): string {
  let json = JSON.stringify(obj, bigintReplacer);
  json = json.replace(/"(X|Y|R|S|D)":"(\d+)"/g, '"$1":$2');
  return json;
}

export function signStructLikeBackend<T extends Record<string, any>>(
  data: T,
  privateKeyHex: string,
  excludeFields: string[]
): EcdsaSigWire {
  // 深拷贝 + bigint -> string
  const copy = JSON.parse(JSON.stringify(data, bigintReplacer));

  // 置零排除字段（不能 delete）
  applyExcludeZeroValue(copy, excludeFields);

  // 注意：不要全局排序 key！struct 字段顺序必须与后端一致。
  // 这里只对 map 字段 AddressMsg 做排序（如你有更多 map 字段，也在这里逐个处理）
  if (copy.AddressMsg && typeof copy.AddressMsg === "object" && !Array.isArray(copy.AddressMsg)) {
    copy.AddressMsg = sortKeysShallow(copy.AddressMsg);
  }

  // JSON 字符串（必须先去掉 X/Y/R/S 的引号，变成 number 字面量，才能和 Go 的 json.Marshal 一致）
  const json = serializeForBackend(copy);

  // SHA-256
  const hashBytes = sha256.array(json);

  // ECDSA P-256 签名
  const key = ec.keyFromPrivate(privateKeyHex, "hex");
  const sig = key.sign(hashBytes);

  // 注意：R/S 内部用 bigint，最终发送时通过 serializeForBackend 去引号为 number
  return {
    R: BigInt(sig.r.toString(10)),
    S: BigInt(sig.s.toString(10)),
  };
}
```

---

## 验签失败排查清单（按优先级）

1. **排除字段是否被 delete 了**（必须是置零值 `{"R":null,"S":null}`）  
2. **X/Y/R/S 是否使用十进制字符串**（不要 hex、不要 number）  
3. **TimeStamp 纪元是否是 2020-01-01 UTC**，且在 5 分钟有效期内  
4. `AddressMsg` 是否做了稳定序列化（key 顺序是否一致）  


