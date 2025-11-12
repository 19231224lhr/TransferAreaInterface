package main

// 交易凭证相关

// TxCertificate 交易凭证 其他结构体调用
type TxCertificate struct {
	TXCerID          string  // 交易凭证id
	ToAddress        string  // 交易转入钱的地址
	Value            float64 // 转账金额
	ToInterest       float64 // 转账利息
	FromGuarGroupID  string  // 发送用户所属的担保人组织id
	ToGuarGroupID    string  // 接收用户所属的担保人组织id
	ConstructionTime uint64  // 交易凭证构造时间
	Size             byte    // 交易凭证大小

	// 原交易信息
	TXID          string        // 来源交易id
	TxCerPosition TXCerPosition // 来源交易在担保人组织区块链中的位置信息(聚合节点填写)

	// 签名相关
	GuarGroupSignature EcdsaSignature // 担保人组织签名
	UserSignature      EcdsaSignature // 接收用户签名(针对除了UserSignature字段以外的哈希值签名)
}

// TXCerPosition 交易凭证来源交易在担保人组织区块链中的位置
type TXCerPosition struct {
	BlockHeight int // 交易所在区块号
	Index       int // 交易所在区块的担保交易序号
	InIndex     int // 对应于交易的第几个output
}
