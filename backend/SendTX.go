package main

import (
	"crypto/ecdsa"
	"crypto/rand"
	"fmt"
)

// 功能2 发送交易

// BuildTXInfo BuildNewTX函数输入结构体
type BuildTXInfo struct {
	Value            float64            // 转账总金额 汇率转换后的金额
	ValueDivision    map[int]float64    // 转账金额类型分配，key为货币类型，value为金额
	Bill             map[string]BillMsg // 转账账单 address - msg
	UserAddress      []string           // 使用的地址
	PriUseTXCer      bool               // 是否优先使用TXCer
	ChangeAddress    map[int]string     // 金额类型不同找零地址，key为货币类型，value为地址
	IsPledgeTX       bool               // 是否是质押交易
	HowMuchPayForGas float64            // 用多少UTXO支付交易手续费 暂定只能使用主货币 盘古币

	IsCrossChainTX bool   // 是否是跨链交易	要求：跨链交易只能使用盘古币，可以使用TXCer，需要支付gas，一对一转账
	Data           []byte // 额外Data字段，目前用于跨区转账，钱包主动连接RPC接口请求该字段

	InterestAssign InterestAssign // 交易手续费数量 已经考虑了额外利息
}

type BillMsg struct {
	MoneyType   int
	Value       float64
	GuarGroupID string
	PublicKey   ecdsa.PublicKey
	ToInterest  float64 // 发送利息数量
}

// UserNewTX 用户发送新交易到担保组织
type UserNewTX struct {
	TX     Transaction // 交易本体
	UserID string      // UserID

	Height int // 交易接收时的高度，分配节点填写，不参与签名

	Sig EcdsaSignature // 使用用户私钥签名
}

// BuildNewTX 新建交易
func (a *Account) BuildNewTX(buildTXInfo BuildTXInfo) (tx Transaction, err error) {
	TotalMoney := make(map[int]float64) // 选择的地址金额 按类型分类
	for _, address := range buildTXInfo.UserAddress {
		TotalMoney[a.Wallet.AddressMsg[address].Type] += a.Wallet.AddressMsg[address].Value.TotalValue
	}

	// 阶段一：检查构造参数是否正确
	// 是否是跨链交易或质押交易 都只能使用盘古币
	if buildTXInfo.IsCrossChainTX || buildTXInfo.IsPledgeTX {
		// 只能输出单一地址
		if len(buildTXInfo.Bill) != 1 {
			return Transaction{}, fmt.Errorf("cross-chain transactions can only transfer to one address")
		}
		// 只能输出主货币
		for _, msg := range buildTXInfo.Bill {
			if msg.MoneyType != 0 {
				return Transaction{}, fmt.Errorf("cross-chain transactions can only use the main currency")
			}
		}
		// 只能使用主货币
		for _, address := range buildTXInfo.UserAddress {
			if a.Wallet.AddressMsg[address].Type != 0 {
				return Transaction{}, fmt.Errorf("cross-chain transactions can only use the main currency")
			}
		}
		// 跨链交易与质押交易的找零地址只能有一个主货币地址
		if len(buildTXInfo.ChangeAddress) != 1 || buildTXInfo.ChangeAddress[0] == "" {
			return Transaction{}, fmt.Errorf("cross-chain transactions can only have one change address")
		}
	}
	// 跨链交易必须满足单点输入
	if buildTXInfo.IsCrossChainTX {
		// 跨链交易必须是担保组织交易
		if a.GuarantorGroupID == "" {
			return Transaction{}, fmt.Errorf("cross-chain transactions must join the guarantor group")
		}
		if len(buildTXInfo.UserAddress) != 1 {
			return Transaction{}, fmt.Errorf("cross-chain transactions can only have one input address")
		}
	}

	IsGuarGroupTX := true // 用户是否加入了担保组织

	// 检查找零地址
	for typeID, address := range buildTXInfo.ChangeAddress {
		if a.Wallet.AddressMsg[address].Type != typeID {
			return Transaction{}, fmt.Errorf("the change address is incorrect")
		}
	}

	// 每个类型的钱是否足够
	for typeID, value := range TotalMoney {
		if buildTXInfo.ValueDivision[typeID] > value {
			return Transaction{}, fmt.Errorf("insufficient account balance")
		}
	}
	// 用的钱和花的钱能否对应
	usedMoney := make(map[int]float64) // 支出的分类金钱
	for _, v := range buildTXInfo.Bill {
		usedMoney[v.MoneyType] += v.Value
	}
	// 额外支付gas
	if buildTXInfo.HowMuchPayForGas != 0 {
		usedMoney[0] += buildTXInfo.HowMuchPayForGas
	}
	for typeID, value := range usedMoney {
		if value != buildTXInfo.ValueDivision[typeID] { // input = value + exGas, value = output
			return Transaction{}, fmt.Errorf("the bill is incorrect")
		}
	}
	// 利息是否正确
	BackInterest := float64(0)     // Back利息
	AddressInterest := float64(0)  // 可用利息
	OutInterest := float64(0)      // 转出利息
	BackInterestRate := float64(0) // Back利息比例
	// OutInterest是否对应
	for _, v := range buildTXInfo.Bill {
		if v.ToInterest < 0 {
			return Transaction{}, fmt.Errorf("the OutInterest ratio is incorrect")
		}
		OutInterest += v.ToInterest
	}
	if OutInterest != buildTXInfo.InterestAssign.Output {
		return Transaction{}, fmt.Errorf("the OutInterest ratio is incorrect")
	}
	// Back利息比例是否为1
	for _, address := range buildTXInfo.UserAddress {
		AddressInterest += a.Wallet.AddressMsg[address].EstInterest // 计算地址可用利息之和
		// 判断比例不能为负数
		if buildTXInfo.InterestAssign.BackAssign[address] < 0 {
			return Transaction{}, fmt.Errorf("the BackInterestRate ratio is incorrect")
		}
		BackInterestRate += buildTXInfo.InterestAssign.BackAssign[address] // 计算Back利息比例之和
	}
	if BackInterestRate != 1 {
		return Transaction{}, fmt.Errorf("the Interest ratio is incorrect : sum typeTargetValue is not equal to 1")
	}
	AddressInterest += buildTXInfo.HowMuchPayForGas // 加上额外利息
	// 利息金额验证
	if buildTXInfo.InterestAssign.Gas+buildTXInfo.InterestAssign.Output > AddressInterest || buildTXInfo.InterestAssign.Output < 0 || buildTXInfo.InterestAssign.Gas < 0 {
		return Transaction{}, fmt.Errorf("the OutInterest ratio is incorrect")
	}
	// Back利息计算
	BackInterest = AddressInterest - buildTXInfo.InterestAssign.Gas - buildTXInfo.InterestAssign.Output

	// Back地址是否一致 BackAssign信息，不使用gas的交易也需要填写，作为使用地址信息更新地址利息
	for i := 0; i < len(buildTXInfo.UserAddress); i++ {
		_, isExist := buildTXInfo.InterestAssign.BackAssign[buildTXInfo.UserAddress[i]]
		if !isExist {
			return Transaction{}, fmt.Errorf("the BackInterestRate ratio is incorrect")
		}
	}

	// 第二步：检查结束，开始构造交易
	UsedWallet := make(map[string]AddressData) // Initialize the map // 记录使用的钱包数据，TXCer中的Value存储的是TXCer的金额
	// 构造outputs
	for address, bill := range buildTXInfo.Bill {
		output := TXOutput{
			ToAddress:     address,
			ToValue:       bill.Value,
			IsCrossChain:  false,
			ToGuarGroupID: bill.GuarGroupID,                              // 跨链交易不需要填写
			ToPublicKey:   ConvertToPublicKeyNew(bill.PublicKey, "P256"), // 跨链交易不需要填写
			IsGuarMake:    false,                                         // 跨链交易不需要填写
			ToInterest:    bill.ToInterest,                               // 跨链交易不需要填写

			Type: bill.MoneyType, // 金钱类型 跨链交易必须为0
		}
		// 是否是跨链交易
		if buildTXInfo.IsCrossChainTX {
			output.IsCrossChain = true
		}
		tx.TXOutputs = append(tx.TXOutputs, output)
	}

	// 存在主动支付手续费
	if buildTXInfo.HowMuchPayForGas != 0 {
		output := TXOutput{
			ToValue:     buildTXInfo.HowMuchPayForGas,
			IsPayForGas: true,

			Type: 0, // 金钱类型
		}
		tx.TXOutputs = append(tx.TXOutputs, output)
	}

	isUTXOEnough := false // UTXO是否已经足够支付交易

	tx.TXType = 0 // 普通交易类型是0
	// 默认先使用用户选择地址的UTXO作为TXInput
	for typeID, typeTargetValue := range buildTXInfo.ValueDivision {
		TypeValueCount := float64(0) // 每种货币已收集金额
		for _, address := range buildTXInfo.UserAddress {
			// 初始化
			// 检查并初始化AddressData
			if _, exists := UsedWallet[address]; !exists {
				UsedWallet[address] = AddressData{
					UTXO:   make(map[string]UTXOData),
					TXCers: make(map[string]float64),
					// 初始化其他必要字段
				}
			}
			// 不是同一种货币，跳过
			if a.Wallet.AddressMsg[address].Type != typeID {
				continue
			}
			for utxoID, utxoData := range a.Wallet.AddressMsg[address].UTXO {
				input := TXInputNormal{
					FromTXID:       utxoData.UTXO.TXID,
					FromTxPosition: utxoData.Position,
					FromAddress:    address,
					IsGuarMake:     false,
				}
				// 签名
				hash, err := utxoData.UTXO.TXOutputs[utxoData.Position.IndexZ].GetTXOutputHash()
				if err != nil {
					return Transaction{}, err
				}
				input.TXOutputHash = hash
				priKey := a.Wallet.AddressMsg[address].WPrivateKey
				r, s, err := ecdsa.Sign(rand.Reader, &priKey, hash)
				if err != nil {
					return Transaction{}, err
				}
				input.InputSignature.R = r
				input.InputSignature.S = s
				tx.TXInputsNormal = append(tx.TXInputsNormal, input)

				TypeValueCount += utxoData.Value
				// 记录使用的钱包数据
				UsedWallet[address].UTXO[utxoID] = utxoData
				if TypeValueCount >= typeTargetValue {
					// 最后一个满足条件的utxo
					isUTXOEnough = true
					// 找零
					if TypeValueCount != typeTargetValue {
						change := TXOutput{
							ToAddress:     buildTXInfo.ChangeAddress[typeID], // 按照金额类型分类找零地址
							ToValue:       TypeValueCount - typeTargetValue,
							ToGuarGroupID: a.GuarantorGroupID,
							ToPublicKey:   ConvertToPublicKeyNew(a.Wallet.AddressMsg[buildTXInfo.ChangeAddress[typeID]].WPublicKey, "P256"),
							IsGuarMake:    false,  // 用户找零输出一定不是担保组织构造
							IsPayForGas:   false,  // 找零输出一定不是额外gas
							IsCrossChain:  false,  // 找零输出一定不是跨链交易
							Type:          typeID, // 找零输出的货币类型
						}
						tx.TXOutputs = append(tx.TXOutputs, change)
					}
					break
				}
			}
		}
		// 如果UTXO不够，当前版本报错
		if !isUTXOEnough {
			return Transaction{}, fmt.Errorf("insufficient account balance")
		}
	}

	// 分配Back利息
	for address, rate := range buildTXInfo.InterestAssign.BackAssign {
		temp := a.Wallet.AddressMsg[address]
		temp.EstInterest = BackInterest * rate
		a.Wallet.AddressMsg[address] = temp
	}

	tx.Version = 0.1
	tx.GuarantorGroup = a.GuarantorGroupID
	// 填写tx交易费信息
	tx.InterestAssign = buildTXInfo.InterestAssign
	// 计算TXID
	id, err := tx.GetTXID()
	if err != nil {
		return Transaction{}, err
	}
	tx.TXID = id
	// 计算TXSize
	size, err := tx.GetTXSize()
	if err != nil {
		return Transaction{}, err
	}
	tx.Size = size
	// 填写金额
	tx.ValueDivision = buildTXInfo.ValueDivision
	// 计算交易金额
	value := 0.0
	for t, v := range buildTXInfo.ValueDivision {
		value += v * ExchangeRate(t)
	}
	tx.Value = value

	// 散户交易处理
	if !IsGuarGroupTX {
		// 普通转账直接发送前要转为AggregateTX格式
		tx.TXType = 8 // 散户转账
	} else if buildTXInfo.IsCrossChainTX {
		tx.TXType = 6              // 跨链交易
		tx.Data = buildTXInfo.Data // 跨链交易需要填写Data字段
	}
	// 质押交易处理
	if buildTXInfo.IsPledgeTX {
		// 质押交易
		tx.TXType = -1
	}

	// 交易签名
	var key ecdsa.PrivateKey
	if tx.TXInputsNormal != nil {
		key = a.Wallet.AddressMsg[tx.TXInputsNormal[0].FromAddress].WPrivateKey
	} else {
		key = a.Wallet.AddressMsg[tx.TXInputsCertificate[0].ToAddress].WPrivateKey
	}
	sig, err := tx.GetTXUserSignature(key)
	if err != nil {
		return tx, err
	}
	tx.UserSignature = sig

	// 阶段三：交易构造完成，更新本地账户信息 现在先不处理本地待确认信息
	for address, addressData := range UsedWallet {
		// UTXO现钱更新
		for utxoID, utxo := range addressData.UTXO {
			temp := a.Wallet.AddressMsg[address]
			// 更新金额
			temp.Value.UTXOValue -= utxo.Value                                 // 子钱包 现钱金额
			temp.Value.TotalValue -= utxo.Value                                // 子钱包 总金额
			a.Wallet.TotalValue -= utxo.Value * ExchangeRate(addressData.Type) // 钱包总金额 存在利率转换
			a.Wallet.ValueDivision[addressData.Type] -= utxo.Value             // 钱包分类货币 更新金额

			// 更新剩余UTXO
			delete(temp.UTXO, utxoID)
			a.Wallet.AddressMsg[address] = temp
		}
		// TXCer交易凭证更新 实际上现在暂时不使用TXCer
		for txcerID, txcerValue := range addressData.TXCers {
			temp := a.Wallet.AddressMsg[address]
			// 只有主货币才能使用和更新TXCer信息
			if temp.Type != 0 {
				return Transaction{}, fmt.Errorf("non-main currency cannot use TXCer")
			}
			// 子钱包金额
			temp.Value.TXCerValue -= txcerValue
			temp.Value.TotalValue -= txcerValue
			// 钱包总金额
			a.Wallet.TotalValue -= txcerValue
			a.Wallet.ValueDivision[0] -= txcerValue
			// 删除使用过的TXCer
			delete(temp.TXCers, txcerID)          // 删除子地址使用的TXCer
			delete(a.Wallet.TotalTXCers, txcerID) // 删除钱包使用的TXCer
			a.Wallet.AddressMsg[address] = temp
		}
	}
	return tx, nil
}

// SendTX 示例方法：发送交易给担保组织
func (a *Account) SendTX(tx Transaction) error {
	// 构造结构体
	userNewTX := UserNewTX{
		TX:     tx,
		UserID: a.AccountID,
	}
	// 签名
	sig, err := SignStruct(userNewTX, a.AccountPrivateKey, "Sig", "Height") // Height不参与签名
	if err != nil {
		return err
	}
	userNewTX.Sig = sig
	// TODO: 通过RPC把userNewTX发送给担保组织

	return nil
}
