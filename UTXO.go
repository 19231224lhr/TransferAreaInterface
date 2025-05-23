package main

// UTXO相关

// UTXOData UTXO信息
type UTXOData struct {
	UTXO     SubATX     // 来源交易
	Value    float64    // 转账金额，这里不是UTXO的总金额，而是这个UTXO实际转账的Output的金额
	Type     int        // 货币类型
	Time     uint64     // 构造时间
	Position TxPosition // 位置信息

	IsTXCerUTXO bool // 是否是交易凭证对应的UTXO，AssignNode统计用户账户更新信息时
}
