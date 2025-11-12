package main

import "fmt"

// 方法：新建账户

// NewUser 用户注册账户
func NewUser() (Account, error) {
	publicKey, privateKey, err := GenerateKeyPair()
	if err != nil {
		return Account{}, err
	}

	userID := Generate8DigitNumberBasedOnInput(PrivateKeyToHex(&privateKey))

	// 生成用户
	a := Account{
		AccountID: userID,
		Wallet: Wallet{
			AddressMsg:    make(map[string]AddressData),
			TotalTXCers:   make(map[string]TxCertificate),
			TotalValue:    0,
			ValueDivision: make(map[int]float64),
			UpdateTime:    0,
			UpdateBlock:   0,
		},
		AccountPublicKey:  publicKey,
		AccountPrivateKey: privateKey,
	}
	// 新建用户子钱包
	sAddress, _, _ := a.NewSubAddress(0) // 默认新建一个主货币子钱包
	if sAddress == "" {
		return Account{}, fmt.Errorf("error in NewUser: failed to create a new sub-wallet")
	}
	return a, nil
}
