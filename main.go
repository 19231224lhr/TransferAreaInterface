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
