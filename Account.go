package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
)

// 账户钱包相关

// Account 账户
type Account struct {
	AccountID string // 用户身份唯一标识
	Wallet    Wallet // 用户拥有的钱包

	GuarantorGroupID string         // 用户对应担保组织id
	GuarGroupBootMsg GuarGroupTable // 用户加入担保组织后，担保组织通信信息 TODO: 改为担保组织发送后才能加入担保组织

	// 账户公私钥对
	AccountPublicKey  ecdsa.PublicKey  `json:"-"`
	AccountPrivateKey ecdsa.PrivateKey `json:"-"`
}

// Wallet 钱包
type Wallet struct {
	AddressMsg    map[string]AddressData   // map address - AddressData
	TotalTXCers   map[string]TxCertificate // 交易凭证 ExTXCerID - TXCer
	TotalValue    float64                  // 钱包余额 记得包括交易凭证的金额 汇率转换后的金额
	ValueDivision map[int]float64          // 钱包余额类型 0：盘古币(包含TXCer)；1：比特币；2：以太坊，和为TotalValue TODO: 理论上可以支持任意一种代币，但是需要提前写好转换利率
	UpdateTime    uint64                   // 更新时间
	UpdateBlock   int                      // 更新区块高度
}

// AddressData 钱包子地址详细信息
type AddressData struct {
	WPublicKey  ecdsa.PublicKey  `json:"-"` // 公钥
	WPrivateKey ecdsa.PrivateKey `json:"-"` // 私钥

	Type int // 钱的类型 0：盘古币；1：比特币；2：以太坊

	UTXO   map[string]UTXOData // UTXO数据
	TXCers map[string]float64  // 交易凭证 ExTXCerID - float64 交易凭证金额

	Value       Value   // 子地址余额信息 原倍率
	EstInterest float64 // 预估利息 不计算TXCer的利息
}

// AddressData2 子钱包信息 简化版
type AddressData2 struct {
	PublicKeyNew PublicKeyNew        // 子钱包对应的新公钥
	Value        Value               // 子钱包余额信息
	Type         int                 // 货币类型
	UTXO         map[string]UTXOData // 子钱包拥有的UTXO信息 map UTXO标识 - UTXO内容
	TXCers       map[string]float64  // 交易凭证 ExTXCerID - uint64是TXCer金额
	EstInterest  float64             // 预估利息
}

// Value Value分类
type Value struct {
	TotalValue float64 // 总金额 = UTXO金额 + TXCer金额
	UTXOValue  float64 // UTXO金额
	TXCerValue float64 // TXCer金额
}

// UserNewAddressInfo 用户新建子地址信息
type UserNewAddressInfo struct {
	NewAddress   string
	PublicKeyNew PublicKeyNew
	UserID       string
	Type         int

	Sig EcdsaSignature // 使用用户私钥签名
}

// GenerateKeyPair 用户新建钱包公私钥
func GenerateKeyPair() (ecdsa.PublicKey, ecdsa.PrivateKey, error) {
	// 这里指定secp256k1椭圆曲线
	curve := elliptic.P256()
	privateKey, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		return ecdsa.PublicKey{}, ecdsa.PrivateKey{}, err
	}
	publicKey := privateKey.PublicKey
	return publicKey, *privateKey, nil
}

// GenerateAddress 对公钥进行哈希运算来生成钱包子地址 Type 是货币类型
func GenerateAddress(publicKey ecdsa.PublicKey, Type int) string {
	// 将公钥转换为字节数组
	pubKeyBytes := elliptic.Marshal(publicKey.Curve, publicKey.X, publicKey.Y)
	// 计算 SHA-256 哈希
	hash := sha256.Sum256(pubKeyBytes)
	return fmt.Sprintf("%x", hash[:20])
}

// NewSubAddress 用户新建子钱包
func (a *Account) NewSubAddress(Type int) (address string, addressData AddressData, err error) {
	// 生成钱包公私钥对
	publicKey, privateKey, err := GenerateKeyPair()
	if err != nil {
		return "", addressData, err
	}
	// 生成钱包地址
	address = GenerateAddress(publicKey, Type)
	addressData = AddressData{
		WPublicKey:  publicKey,
		WPrivateKey: privateKey,
		UTXO:        make(map[string]UTXOData),
		Type:        Type,
		TXCers:      make(map[string]float64),
		Value: Value{
			TotalValue: 0,
			UTXOValue:  0,
			TXCerValue: 0,
		},
		EstInterest: 0,
	}
	// 赋值
	a.Wallet.AddressMsg[address] = addressData
	return address, addressData, nil
}
