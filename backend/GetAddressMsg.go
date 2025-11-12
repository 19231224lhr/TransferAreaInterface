package main

import (
	"math/rand"
	"time"
)

// 功能1 获取地址钱包信息

// GetNodeAddressMsg 用户查询账户地址信息
type GetNodeAddressMsg struct {
	FromPeerID string   // rpc中不使用，随便填
	Address    []string // 用户填入钱包地址
	Random     int      // rpc中不使用，随便填
}

// ReturnNodeAddressMsg 返回给前端查询的地址信息
type ReturnNodeAddressMsg struct {
	FromGroupID string                      // 用户所属担保组织
	AddressData map[string]PointAddressData // 地址与对应的数据
	Sig         EcdsaSignature              // 担保委员会签名 可以暂时不验证
}

// PointAddressData 用户子信息 ReturnNodeAddressMsg结构体调用
type PointAddressData struct {
	Value        float64             // 地址总余额
	Type         int                 // 金额类型
	Interest     float64             // 地址总利息
	GroupID      string              // 所属担保组织ID
	PublicKeyNew PublicKeyNew        // 地址对应的公钥
	UTXO         map[string]UTXOData // 地址拥有的UTXO信息 map UTXO标识 - UTXO内容
	LastHeight   int                 // 上次更新此地址时的区块高度
}

// GetAddressMsg 示例方法：主动查询用户地址钱包信息
func (a *Account) GetAddressMsg() {
	// 设置随机种子，确保每次运行生成的随机数不同
	rand.Seed(time.Now().UnixNano())
	// 生成 0 到 1,000,000 之间的随机数
	RandomIndex := rand.Intn(1000001)
	msg := GetNodeAddressMsg{
		FromPeerID: "",
		Address:    make([]string, 0),
		Random:     RandomIndex,
	}
	for address, _ := range a.Wallet.AddressMsg {
		msg.Address = append(msg.Address, address)
	}
	// 发送
	// TODO: RPC发送给对应的担保组织
}

// ReceiveAddressMsg 示例方法：处理返回的地址信息
func (a *Account) ReceiveAddressMsg(msg ReturnNodeAddressMsg) {
	// 重置本地钱包信息
	a.Wallet.TotalValue = 0
	a.Wallet.ValueDivision = make(map[int]float64)
	// 更新钱包子地址信息
	for address, data := range msg.AddressData {
		// 更新本地地址信息
		temp := a.Wallet.AddressMsg[address]
		temp.UTXO = data.UTXO
		temp.Value.TotalValue = data.Value
		temp.Value.UTXOValue = data.Value
		temp.EstInterest = data.Interest
		a.Wallet.AddressMsg[address] = temp
		a.Wallet.TotalValue += data.Value
		a.Wallet.ValueDivision[data.Type] += data.Value
	}
}
