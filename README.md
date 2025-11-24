# 标准流程实例
参考转账区核心代码，目前是go语言版本

`main.go`文件模拟了前端调用改代码的基本业务流程。

其中，`NewAccount.go`、`GetAddressMsg.go`、`JoinGroup.go`、`SendTX.go`四个文件中实现了四个功能，其余文件是一些会被调用的底层结构体和方法。

更多详细信息参考飞书文档：https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc

## 前端纯静态演示（web/）

本项目新增了一个“纯前端钱包演示”，无需后端即可在浏览器侧生成账户信息。

- 目录结构：`web/index.html`、`web/app.js`、`web/style.css`
- 运行预览：
  - 启动本地静态服务器：`go run ./backend/cmd/webserver/main.go`
  - 打开页面：`http://localhost:8081/`
- 页面文案与动效：标题更新为“UTXO快速转账钱包”，新增按钮点击涟漪与入场动画，整体更灵动。
- 功能说明：
  - 在浏览器中通过 WebCrypto 生成 ECDSA P-256 密钥对（与 Go 版本一致）。
  - 用户 ID：以私钥 `d` 的十六进制为输入做 `CRC32(IEEE)`，映射为 8 位数字。
  - 地址：取未压缩公钥 `0x04||X||Y` 做 `SHA-256`，取前 20 字节的十六进制作为地址。
  - 展示：页面显示账户 ID、地址、公私钥（演示用）。
- 注意事项（生产环境建议）：
  - 不直接暴露或保存明文私钥；将密钥设为不可导出（`extractable: false`）。
  - 使用 `IndexedDB` 加密存储，提供加密导入/导出与备份；页面需在 HTTPS 下运行。

## 最近更新与修复

- 修复示例程序 panic：补齐 `BuildTXInfo` 的利息分配与必填项，注入演示 UTXO，确保交易构建与校验通过。
- 模拟 RPC 返回：为“加入担保组织”与“查询地址信息”构造示例数据，以便离线演示。
- 静态服务器入口整理：将根目录的 `webserver.go` 移至 `cmd/webserver/main.go`，解决 `main` 重复声明问题；使用 `go run ./cmd/webserver` 运行前端预览。
- 前端新增并完善了“新建/导入钱包”和“加入担保组织”完整流程，包含加载动效、路由与返回确认、未登录访问限制，以及推荐/搜索合并的交互设计。界面统一为左右分栏布局，动效更柔和、按钮更清晰，并在导入时优先走后端 API，保证体验与稳定性。整体页面更易用、更美观，且逻辑更稳健。
- 新增钱包主页（#/wallet），左侧聚焦地址列表与总余额变化图，右侧提供快速/跨链转账入口；曲线图支持 PGC/BTC/ETH 选择即刻切换并带入场动画。建立本地存储模块 walletAccount，镜像 Account/Wallet/AddressData 结构，登录写入、退出清空，页面渲染统一读取。同步修复登出残留页面、重复地址叠加、搜索按钮状态未重置、加载期按钮过早出现等问题，整体交互更稳健。
- 重构首屏与入口，新增登录/注册与“生成或导入钱包”页，地址列表支持折叠、来源标识与贴身删除确认；导入页自动清空输入并校验重复地址，禁止重复导入。钱包主页子地址与总余额曲线支持 PGC/BTC/ETH 标签即时切换与动画，修复一次性绑定导致总余额图不更新的问题。统一等待覆盖层与反馈弹窗，程序化跳转跳过退出确认；后端新增 /api/account/new 并与前端统一 AccountID 计算口径。视觉与可读性全面优化（灰底黑字的 code、浅灰蓝列表、移除不必要分割线）。
- 新增“正在连接”加载页与“账户与担保组织信息”页，完善登录→入口→问询→确认→主页的流转，并将钱包主页路由统一为 `#/main`。将“快速转账”和“跨链转账”合并为同一功能面板，按钮文案随模式切换，同时在主页右侧新增担保组织详情信息展示。修复入口“下一步”禁用条件与卡片串场问题，登录/导入返回入口时清空简要列表；优化入口胶囊样式与英雄加载动效，整体交互更稳定、更美观。
- 担保组织交互完善：注册/导入/入口“下一步”统一跳转到加入担保组织页；主页进入时同步并渲染担保组织详情与空态。菜单组织号实时同步：统一口径计算 `GroupID`（`guarChoice`→`guarGroup`→`orgNumber`）；加入/退出/存储变更自动刷新 `code#menuOrg`，刷新期间显示“同步中...”。退出流程优化：确认后展示 2s 加载动画，再清理本地 `guarChoice/guarGroup/orgNumber` 并切换为空态模块；菜单与主页面板即时同步。空态动效与点击优化：面板粒子光效加强与响应式尺寸；流光层不拦截点击；SVG 渐变盾形图标采用轻微呼吸效果，按钮不随动画抖动。
- 钱包转账页已完成成体系更新：新增完整转账表单（来源地址、账单网格、找零按币种、交易选项）与实时校验，生成并预览符合后端 BuildTXInfo 的结构体。自定义币种下拉统一风格并加入 PGC/BTC/ETH logo，修复选择后不收回的问题。账单默认一条，删除最后一条自动禁用且悬停提示；“添加一笔”按钮与删除按钮视觉统一为长条形并按浅蓝加深微调。同时优化输入与标签间距、卡片背景层次与动效，整体交互更稳健、可读性更高。

### 第一步
> **新建用户**

调用NewAccount.go文件中的NewUser方法新建账户，返回Account，钱包本地需要保存Account信息

### 第二步
> **新用户申请加入指定担保组织10000000**

调用JoinGroup.go文件中的JoinGuarGroup方法，申请加入担保组织，等待回应
RPC返回申请加入担保组织回执信息，调用ReceiveJoinReply方法处理

### 第三步
> **获取钱包地址信息**

调用GetAddressMsg.go文件中的GetAddressMsg方法，获取钱包地址信息，等待回应
RPC返回钱包地址信息，调用ReceiveAddressMsg方法处理

### 第四步
> **发送交易**

先通过前端ui收集构造交易信息，获得BuildTXInfo结构体变量
调用SendTX.go文件中的BuildNewTX方法，构造交易
调用SendTX方法，发送交易

### 第五步
> **获取钱包地址信息，查看交易是否上链**

参考第三步

## 示例演示

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
    // 打印新账户信息
    fmt.Println("Account ID:", account.AccountID)
    fmt.Println("Account Public Key:", account.AccountPublicKey)
    fmt.Println("Account Private Key:", account.AccountPrivateKey)
    fmt.Println("Wallet Address Msg:", account.Wallet.AddressMsg)

    // 第二步：申请加入担保组织
    err = account.JoinGuarGroup()
    if err != nil {
        panic(err)
    }
    // RPC返回信息处理
    msg := UserFlowMsgReply{ // 模拟返回信息（加入担保组织成功）
        Result:      true,
        GroupID:     "10000000",
        GuarGroupMsg: GuarGroupTable{},
        BlockHeight: 1,
    }
    err = account.ReceiveJoinReply(msg)
    if err != nil {
        panic(err)
    }

    // 第三步：查询钱包地址信息
    account.GetAddressMsg()
    // RPC返回信息处理
    // 构造示例地址数据：给用户默认子地址填充一个可用UTXO
    var addr string
    for a := range account.Wallet.AddressMsg {
        addr = a
        break
    }
    demoOutput := TXOutput{
        ToAddress:     addr,
        ToValue:       100, // 给予演示用余额
        ToGuarGroupID: account.GuarantorGroupID,
        ToPublicKey:   ConvertToPublicKeyNew(account.Wallet.AddressMsg[addr].WPublicKey, "P256"),
        Type:          0,
    }
    demoATX := SubATX{
        TXID:    "prev-demo-txid",
        TXType:  0,
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

    // 第四步：发送交易
    // 通过前端获取BuildTXInfo结构体变量的值
    // 构造一个有效的演示交易：用默认地址支付10主币，找零回到同一地址
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
                addr: 1, // 将可回退利息全部分配给使用的地址
            },
        },
    }
    // 构造交易
    tx, err := account.BuildNewTX(buildTXInfo)
    if err != nil {
        panic(err)
    }
    // 发送交易
    err = account.SendTX(tx)
    if err != nil {
        panic(err)
    }

    // 第五步：获取钱包地址信息，查询交易是否成功上链
    // 参考第三步
}
```
