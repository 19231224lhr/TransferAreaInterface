package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
)

// 交易结构体相关

// Transaction 用户发送的交易结构体
type Transaction struct {
	// 交易基础信息
	TXID           string          // 交易id，由哈希值生成 不包含TXID和Size
	Size           int             // 交易大小(字节长度) 最后生成
	Version        float32         // 交易版本号
	GuarantorGroup string          // 此交易负责的担保人组织身份信息（id），与账户中的担保人组织一样
	TXType         int             // 交易类型
	Value          float64         // 总转账金额
	ValueDivision  map[int]float64 // 转账金额类型分配，key为货币类型，value为金额
	NewValue       float64         // 担保人组织修改后的金额(不参与用户签名)
	NewValueDiv    map[int]float64 // 担保人组织修改后的金额类型(不参与用户签名)

	InterestAssign InterestAssign // 交易手续费

	// Signature
	UserSignature EcdsaSignature // 用户签名(不含担保人组织构造的in，out和NewValue，使用input或txcer第一个公私钥签名)

	// TXInput
	TXInputsNormal      []TXInputNormal // 常规TXInput
	TXInputsCertificate []TxCertificate // 交易凭证类型的TXInput，目前前端不用支持

	// TXOutput
	TXOutputs []TXOutput // 交易输出

	// 额外Data字段，目前用于跨区转账
	Data []byte
}

// SubATX 聚合交易结构体 其他结构体调用
type SubATX struct {
	// 交易基础信息
	TXID   string // 交易id
	TXType int    // 交易类型

	// TXInput
	TXInputsNormal      []TXInputNormal // 常规TXInput
	TXInputsCertificate []TxCertificate // 交易凭证类型的TXInput，当TXType=1时启用，其余时间为空

	// TXOutput
	TXOutputs []TXOutput // 交易输出

	// Gas
	InterestAssign InterestAssign // 交易手续费

	// ExTXCerID
	ExTXCerID []string // 对应的交易凭证id，当TXType = 3时启用，其余时间为空，由担保委员会构造

	// Data字段，目前用于跨区转账
	Data []byte
}

// TxPosition 交易位置 其他结构体调用
type TxPosition struct {
	Blocknum int // 交易所在区块号 Blocknum.Blocknum表示区
	IndexX   int // 交易所在区块的担保交易序号
	IndexY   int // 交易所在担保交易内部序号
	IndexZ   int // 交易用的是哪个输出
}

// TXInputNormal 常规TXInput
type TXInputNormal struct {
	FromTXID        string         // 输入交易id
	FromTxPosition  TxPosition     // 交易位置信息
	FromAddress     string         // 来源钱包子地址
	IsGuarMake      bool           // 是否是担保组织构造的input
	IsCommitteeMake bool           // 是否是担保委员会构造的input，用来兑换TXCer
	IsCrossChain    bool           // 是否是跨链交易的Input，如果为真，则该TXInput不用验证 相当于Coinbase交易
	InputSignature  EcdsaSignature // 私钥对引用的Output交易哈希值签名作为验证

	TXOutputHash []byte // 使用的utxo的哈希值
}

// TXOutput 交易输出 其他结构体调用
type TXOutput struct {
	ToAddress     string       // 目的地址
	ToValue       float64      // 转账金额
	ToGuarGroupID string       // 目的用户所属担保人组织id
	ToPublicKey   PublicKeyNew // 目的地址公钥(用户锁定交易)
	ToInterest    float64      // 分配的利息数量，加起来应该等于InterestAssign.Output
	Type          int          // 货币类型
	ToPeerID      string       // 目的用户peerID

	IsPayForGas bool // 是否用来支付手续费

	IsCrossChain bool // 是否是跨链交易的Output，考虑到跨链转账也需要找零

	IsGuarMake bool // 是不是担保人自己构造的TXOutput
}

// InterestAssign gas费分配比例
type InterestAssign struct {
	Gas        float64            // 交易手续费
	Output     float64            // 输出
	BackAssign map[string]float64 // 回退分配 address - 比例 加起来为1
}

// GetTXOutputHash 计算TXOutput哈希值
func (t *TXOutput) GetTXOutputHash() ([]byte, error) {
	// 计算output哈希值
	serialize, err := SerializeStruct(t)
	//output.SignTXOutput()
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(serialize)
	return hash[:], nil
}

// GetTXHash 普通交易计算哈希值
func (t *Transaction) GetTXHash() ([]byte, error) {
	// GuarTX后续可能会使用该函数，验证是否是担保人组织构造的TXInput和TXOutput
	var txInputs []TXInputNormal
	var oldTxInputs []TXInputNormal
	var txOutputs []TXOutput
	var oldTXOutputs []TXOutput
	for _, input := range t.TXInputsNormal {
		if !input.IsGuarMake {
			txInputs = append(txInputs, input)
		}
	}
	for _, output := range t.TXOutputs {
		if !output.IsGuarMake {
			txOutputs = append(txOutputs, output)
		}
	}
	oldTxInputs = t.TXInputsNormal
	oldTXOutputs = t.TXOutputs
	t.TXInputsNormal = txInputs
	t.TXOutputs = txOutputs

	// 序列化结构体
	serializeStruct, err := SerializeStruct(t, "Size", "NewValue", "UserSignature", "TXType")
	if err != nil {
		return nil, err
	}
	// 求哈希值
	hash := sha256.Sum256(serializeStruct)

	// 还原交易
	t.TXInputsNormal = oldTxInputs
	t.TXOutputs = oldTXOutputs

	return hash[:], nil
}

// GetTXID 普通交易计算TXID 取前八位
func (t *Transaction) GetTXID() (string, error) {
	hash, err := t.GetTXHash()
	if err != nil {
		return "", err
	}
	// 将哈希值转换为十六进制字符串，并取前八位
	return fmt.Sprintf("%x", hash[:8]), nil
}

// GetTXSize 普通交易计算交易大小
func (t *Transaction) GetTXSize() (int, error) {
	// 序列化结构体
	serializeStruct, err := SerializeStruct(t, "Size")
	if err != nil {
		return 0, err
	}
	return len(serializeStruct), nil
}

// GetTXUserSignature 获得TX用户签名
func (t *Transaction) GetTXUserSignature(priKey ecdsa.PrivateKey) (EcdsaSignature, error) {
	hash, err := t.GetTXHash()
	if err != nil {
		return EcdsaSignature{}, err
	}
	r, s, err := ecdsa.Sign(rand.Reader, &priKey, hash)
	if err != nil {
		fmt.Println("err in SigTX")
		return EcdsaSignature{}, err
	}
	return EcdsaSignature{R: r, S: s}, nil
}
