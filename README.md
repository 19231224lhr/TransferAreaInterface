# UTXO Wallet

基于 UTXO 模型的新一代区块链钱包前端界面与后端核心代码实现。

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.18+-00ADD8?style=flat-square&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?style=flat-square&logo=javascript" alt="JS Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📖 项目简介

本项目是一个完整的区块链钱包解决方案，包含：

- **前端界面**：基于原生 HTML/CSS/JavaScript 的现代化钱包 UI
- **后端核心**：Go 语言实现的 UTXO 交易构建与签名逻辑
- **Web 服务器**：提供前端静态资源服务与 API 接口

更多详细信息参考飞书文档：https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc

---

## 🚀 快速开始

### 环境要求

- Go 1.18+ (后端)
- 现代浏览器 (Chrome/Firefox/Edge/Safari)

### 启动项目

```bash
# 克隆项目
git clone https://github.com/19231224lhr/TransferAreaInterface.git
cd TransferAreaInterface

# 启动 Web 服务器
go run ./backend/cmd/webserver/main.go

# 访问钱包界面
# 打开浏览器访问: http://localhost:8081/
```

---

## 🏗️ 项目架构

```
TransferAreaInterface/
├── index.html                 # 主页面入口
├── app.js                     # 前端核心逻辑 (5000+ 行)
├── css/                       # 模块化样式文件
│   ├── base.css              # 基础样式与 CSS 变量
│   ├── animations.css        # 动画效果
│   ├── components.css        # 通用组件样式
│   ├── header.css            # 顶部导航栏
│   ├── welcome.css           # 欢迎页样式
│   ├── wallet.css            # 钱包主页样式
│   ├── transaction.css       # 转账表单样式
│   ├── login.css             # 登录页样式
│   ├── new-user.css          # 注册页样式
│   ├── import-wallet.css     # 导入钱包样式
│   ├── join-group.css        # 加入担保组织样式
│   ├── entry.css             # 入口页样式
│   ├── toast.css             # Toast 提示样式
│   └── utilities.css         # 工具类样式
├── backend/                   # Go 后端代码
│   ├── Account.go            # 账户与钱包结构体
│   ├── NewAccount.go         # 创建新账户
│   ├── GetAddressMsg.go      # 查询地址信息
│   ├── JoinGroup.go          # 加入担保组织
│   ├── SendTX.go             # 构建与发送交易
│   ├── Transaction.go        # 交易结构体定义
│   ├── UTXO.go               # UTXO 数据结构
│   ├── TXCer.go              # 交易凭证
│   ├── core.go               # 通用工具函数
│   ├── core/                 # 核心工具包
│   │   ├── keyformat.go      # 密钥格式转换
│   │   └── util.go           # 通用工具
│   └── cmd/
│       └── webserver/
│           └── main.go       # Web 服务器入口
├── assets/                    # 静态资源
└── tests/                     # 测试文件
```

---

## 💻 前端架构

### UI 设计风格

前端采用现代化的 **Glassmorphism (玻璃拟态)** 设计风格：

- **渐变配色**：主色调为天蓝色 `#0ea5e9` 与紫色 `#8b5cf6` 的渐变
- **毛玻璃效果**：使用 `backdrop-filter: blur()` 实现半透明模糊背景
- **柔和阴影**：多层阴影营造悬浮卡片效果
- **流畅动画**：贝塞尔曲线过渡与入场动画

### 核心页面与路由

| 路由 | 页面 | 功能描述 |
|------|------|----------|
| `#/` | 欢迎页 | 首页展示与功能入口 |
| `#/login` | 登录页 | 私钥登录已有账户 |
| `#/new-user` | 注册页 | 生成新账户与密钥对 |
| `#/entry` | 入口页 | 钱包地址管理与导入 |
| `#/import` | 导入页 | 通过私钥导入子地址 |
| `#/join-group` | 担保组织 | 搜索并加入担保组织 |
| `#/inquiry-main` | 确认页 | 账户与担保组织信息确认 |
| `#/main` | 钱包主页 | 资产概览与转账功能 |

### 国际化 (i18n)

前端实现了完整的双语国际化系统，支持简体中文（zh-CN）和英语（en）：

- **260+ 翻译键**：覆盖所有页面、组件和交互元素
- **核心函数**：`t(key, params)` 翻译函数，支持参数替换
- **HTML 属性**：`data-i18n`、`data-i18n-placeholder`、`data-i18n-title`
- **持久化**：语言偏好存储在 localStorage (`appLanguage`)
- **自动更新**：路由切换时自动更新所有翻译元素
- **语言选择器**：个人信息页面提供 🇨🇳 简体中文 / 🇺🇸 English 切换

**翻译键结构**：
```
common.*      - 通用UI元素（按钮、标签）
header.*      - 头部和导航
welcome.*     - 欢迎页
wallet.*      - 钱包管理
transfer.*    - 转账表单
modal.*       - 模态对话框
toast.*       - Toast通知
profile.*     - 个人信息设置
```

### 前端核心功能

#### 1. 密钥生成与管理

使用 **WebCrypto API** 在浏览器端生成 ECDSA P-256 密钥对：

```javascript
// 生成密钥对
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

// 导出为 JWK 格式
const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
```

**账户 ID 生成算法**：
- 输入：私钥 D 的十六进制字符串
- 处理：`CRC32(IEEE)` 校验和
- 输出：映射为 8 位数字 (10000000 - 99999999)

**地址生成算法**：
- 输入：未压缩公钥 `0x04 || X || Y`
- 处理：`SHA-256` 哈希
- 输出：取前 20 字节的十六进制字符串 (40 位)

#### 2. 本地存储结构

使用 `localStorage` 存储账户信息，键名为 `walletAccount`：

```javascript
{
  accountId: "12345678",           // 8 位账户 ID
  address: "5bd548d76dcb...",      // 主地址
  orgNumber: "10000000",           // 担保组织 ID
  keys: {
    privHex: "...",                // 私钥 (十六进制)
    pubXHex: "...",                // 公钥 X 坐标
    pubYHex: "..."                 // 公钥 Y 坐标
  },
  wallet: {
    addressMsg: {                  // 子地址映射
      "address1": {
        type: 0,                   // 币种: 0=PGC, 1=BTC, 2=ETH
        value: { totalValue, utxoValue, txCerValue },
        utxos: { ... },
        estInterest: 0
      }
    },
    totalValue: 1000,              // 总资产
    valueDivision: { 0: 800, 1: 150, 2: 50 },
    history: [...]                 // 余额历史记录
  }
}
```

#### 3. Toast 提示系统

自定义 Toast 组件，支持四种类型：

```javascript
showToast(message, type, title, duration);
// type: 'info' | 'success' | 'warning' | 'error'

// 便捷方法
showSuccessToast('操作成功');
showErrorToast('操作失败');
showWarningToast('请注意');
showInfoToast('提示信息');
```

---

## 🔧 后端架构

### 核心数据结构

#### Account (账户)

```go
type Account struct {
    AccountID         string           // 用户唯一标识 (8 位数字)
    Wallet            Wallet           // 钱包信息
    GuarantorGroupID  string           // 担保组织 ID
    GuarGroupBootMsg  GuarGroupTable   // 担保组织通信信息
    AccountPublicKey  ecdsa.PublicKey  // 账户公钥
    AccountPrivateKey ecdsa.PrivateKey // 账户私钥
}
```

#### Wallet (钱包)

```go
type Wallet struct {
    AddressMsg    map[string]AddressData   // 子地址映射
    TotalTXCers   map[string]TxCertificate // 交易凭证
    TotalValue    float64                  // 总余额 (汇率转换后)
    ValueDivision map[int]float64          // 按币种分类余额
    UpdateTime    uint64                   // 更新时间
    UpdateBlock   int                      // 更新区块高度
}
```

#### Transaction (交易)

```go
type Transaction struct {
    TXID           string              // 交易 ID (SHA-256 哈希)
    Size           int                 // 交易大小 (字节)
    Version        float32             // 版本号
    GuarantorGroup string              // 担保组织 ID
    TXType         int                 // 交易类型
    Value          float64             // 总转账金额
    ValueDivision  map[int]float64     // 分币种金额
    InterestAssign InterestAssign      // 手续费分配
    UserSignature  EcdsaSignature      // 用户签名
    TXInputsNormal []TXInputNormal     // UTXO 输入
    TXOutputs      []TXOutput          // 交易输出
    Data           []byte              // 额外数据 (跨链用)
}
```

#### BuildTXInfo (交易构建参数)

```go
type BuildTXInfo struct {
    Value            float64            // 转账总金额
    ValueDivision    map[int]float64    // 按币种分配
    Bill             map[string]BillMsg // 转账账单
    UserAddress      []string           // 来源地址列表
    PriUseTXCer      bool               // 是否优先使用交易凭证
    ChangeAddress    map[int]string     // 找零地址 (按币种)
    IsPledgeTX       bool               // 是否质押交易
    HowMuchPayForGas float64            // 额外 Gas 支付
    IsCrossChainTX   bool               // 是否跨链交易
    Data             []byte             // 跨链数据
    InterestAssign   InterestAssign     // 手续费分配
}
```

### 核心功能模块

| 文件 | 功能 | 主要方法 |
|------|------|----------|
| `NewAccount.go` | 创建账户 | `NewUser()` |
| `GetAddressMsg.go` | 查询地址 | `GetAddressMsg()`, `ReceiveAddressMsg()` |
| `JoinGroup.go` | 加入组织 | `JoinGuarGroup()`, `ReceiveJoinReply()` |
| `SendTX.go` | 发送交易 | `BuildNewTX()`, `SendTX()` |
| `Transaction.go` | 交易结构 | `GetTXHash()`, `GetTXID()`, `GetTXSize()` |
| `Account.go` | 账户管理 | `NewSubAddress()`, `GenerateAddress()` |
| `core.go` | 工具函数 | `SignStruct()`, `SerializeStruct()` |

### 交易类型说明

| TXType | 类型 | 说明 |
|--------|------|------|
| 0 | 普通交易 | 担保组织内部转账 |
| 6 | 跨链交易 | 跨担保组织/跨链转账 |
| 8 | 散户转账 | 未加入担保组织的转账 |
| -1 | 质押交易 | 资产质押操作 |

---

## 📱 功能流程

### 完整业务流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   欢迎页    │ ─→ │ 创建/登录   │ ─→ │ 加入担保组织 │ ─→ │  钱包主页   │
│  Welcome    │    │ New/Login   │    │ Join Group  │    │   Wallet    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                  │                  │
                          ▼                  ▼                  ▼
                   生成/导入密钥对      RPC 申请加入       资产查看/转账
```

### 第一步：新建用户

调用 `NewAccount.go` 的 `NewUser()` 方法：

```go
account, err := NewUser()
// 返回包含密钥对和默认子地址的 Account 结构体
```

### 第二步：加入担保组织

调用 `JoinGroup.go` 的相关方法：

```go
// 发起加入申请
err := account.JoinGuarGroup()

// 处理 RPC 返回
err = account.ReceiveJoinReply(msg)
```

### 第三步：查询地址信息

调用 `GetAddressMsg.go` 的相关方法：

```go
// 发起查询请求
account.GetAddressMsg()

// 处理 RPC 返回
account.ReceiveAddressMsg(msg)
```

### 第四步：发送交易

调用 `SendTX.go` 的相关方法：

```go
// 构建交易
tx, err := account.BuildNewTX(buildTXInfo)

// 发送交易
err = account.SendTX(tx)
```

---

## 🧪 测试数据

可用于测试的地址和公钥信息：

**测试地址 1**
- ToAddress: `299954ff8bbd78eda3a686abcf86732cd18533af`
- ToGroup: `10000000`
- ToPubKey: `2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566&c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80`

**测试地址 2**
- ToAddress: `d76ec4020140d58c35e999a730bea07bf74a7763`
- ToGroup: `None`
- ToPubKey: `11970dd5a7c3f6a131e24e8f066416941d79a177579c63d889ef9ce90ffd9ca8&037d81e8fb19883cc9e5ed8ebcc2b75e1696880c75a864099bec10a5821f69e0`

- 测试私钥：
`963f75db05b159d60bb1b554bed2c204dd66e0033dc95fe19d77c4745980ff03`
- 对应地址：
`b0b43b638f4bcc0fb941fca7e7b26d15612eb64d`
---

## 🔐 API 接口

### POST /api/account/new

创建新账户，返回密钥对与地址信息。

**响应示例**：
```json
{
  "accountId": "12345678",
  "address": "5bd548d76dcb3f9db1d213db01464406bef5dd09",
  "privHex": "a1b2c3d4...",
  "pubXHex": "e5f6a7b8...",
  "pubYHex": "c9d0e1f2..."
}
```

### POST /api/account/from-priv

通过私钥恢复账户信息。

**请求体**：
```json
{
  "privHex": "a1b2c3d4..."
}
```

---

## 🛡️ 安全建议

生产环境部署时请注意：

1. **私钥保护**：不直接暴露或保存明文私钥
2. **密钥不可导出**：将 WebCrypto 密钥设为 `extractable: false`
3. **加密存储**：使用 IndexedDB 加密存储敏感信息
4. **HTTPS**：确保在 HTTPS 环境下运行
5. **备份机制**：提供加密的密钥导入/导出功能

---

## 📝 更新日志

### 最新更新

- ✅ **国际化系统**：完整的中英文双语支持，260+ 翻译键，覆盖所有页面和组件
- ✅ **完整的钱包转账表单**：来源地址选择、账单网格、按币种找零、交易选项与实时校验
- ✅ **自定义币种下拉组件**：统一风格，支持 PGC/BTC/ETH Logo
- ✅ **担保组织交互完善**：注册/导入/入口统一跳转流程，实时同步组织信息
- ✅ **现代化 UI 重构**：欢迎页、登录页、注册页、钱包主页全新设计
- ✅ **Toast 提示系统**：四种类型提示，支持自动消失与手动关闭
- ✅ **本地存储模块**：完整的 Account/Wallet/AddressData 结构镜像
- ✅ **余额历史图表**：支持 PGC/BTC/ETH 切换与入场动画

---

## 📄 完整示例

```go
package main

import "fmt"

func main() {
    fmt.Println("开始运行示例程序...")
    
    // 第一步：新建用户
    account, err := NewUser()
    if err != nil {
        panic(err)
    }
    fmt.Println("Account ID:", account.AccountID)

    // 第二步：申请加入担保组织
    err = account.JoinGuarGroup()
    if err != nil {
        panic(err)
    }
    
    // 模拟 RPC 返回
    msg := UserFlowMsgReply{
        Result:       true,
        GroupID:      "10000000",
        GuarGroupMsg: GuarGroupTable{},
        BlockHeight:  1,
    }
    account.ReceiveJoinReply(msg)

    // 第三步：查询钱包地址信息
    account.GetAddressMsg()
    
    // 获取默认地址
    var addr string
    for a := range account.Wallet.AddressMsg {
        addr = a
        break
    }
    
    // 模拟 RPC 返回 UTXO 数据
    demoOutput := TXOutput{
        ToAddress:     addr,
        ToValue:       100,
        ToGuarGroupID: account.GuarantorGroupID,
        ToPublicKey:   ConvertToPublicKeyNew(account.Wallet.AddressMsg[addr].WPublicKey, "P256"),
        Type:          0,
    }
    demoATX := SubATX{
        TXID:      "prev-demo-txid",
        TXType:    0,
        TXOutputs: []TXOutput{demoOutput},
    }
    demoUTXO := UTXOData{
        UTXO:     demoATX,
        Value:    100,
        Type:     0,
        Time:     GetTimestamp(),
        Position: TxPosition{Blocknum: 1, IndexX: 0, IndexY: 0, IndexZ: 0},
    }
    msg1 := ReturnNodeAddressMsg{
        FromGroupID: account.GuarantorGroupID,
        AddressData: map[string]PointAddressData{
            addr: {
                Value:        100,
                Type:         0,
                Interest:     0,
                GroupID:      account.GuarantorGroupID,
                PublicKeyNew: ConvertToPublicKeyNew(account.Wallet.AddressMsg[addr].WPublicKey, "P256"),
                UTXO:         map[string]UTXOData{"demo": demoUTXO},
                LastHeight:   1,
            },
        },
    }
    account.ReceiveAddressMsg(msg1)

    // 第四步：构建并发送交易
    buildTXInfo := BuildTXInfo{
        Value:         10,
        ValueDivision: map[int]float64{0: 10},
        Bill: map[string]BillMsg{
            addr: {
                MoneyType:   0,
                Value:       10,
                GuarGroupID: account.GuarantorGroupID,
                PublicKey:   account.Wallet.AddressMsg[addr].WPublicKey,
                ToInterest:  0,
            },
        },
        UserAddress:      []string{addr},
        PriUseTXCer:      false,
        ChangeAddress:    map[int]string{0: addr},
        IsPledgeTX:       false,
        HowMuchPayForGas: 0,
        IsCrossChainTX:   false,
        Data:             nil,
        InterestAssign: InterestAssign{
            Gas:    0,
            Output: 0,
            BackAssign: map[string]float64{
                addr: 1,
            },
        },
    }
    
    tx, err := account.BuildNewTX(buildTXInfo)
    if err != nil {
        panic(err)
    }
    
    err = account.SendTX(tx)
    if err != nil {
        panic(err)
    }
    
    fmt.Println("交易发送成功！TXID:", tx.TXID)
}
```

---

## 📜 License

MIT License © 2024
