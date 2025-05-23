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
	msg := UserFlowMsgReply{} // 模拟返回信息
	err = account.ReceiveJoinReply(msg)
	if err != nil {
		panic(err)
	}

	// 第三步：查询钱包地址信息
	account.GetAddressMsg()
	// RPC返回信息处理
	msg1 := ReturnNodeAddressMsg{} // 模拟返回信息
	account.ReceiveAddressMsg(msg1)

	// 第四步：发送交易
	// 通过前端获取BuildTXInfo结构体变量的值
	buildTXInfo := BuildTXInfo{} // 模拟构造的信息
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
