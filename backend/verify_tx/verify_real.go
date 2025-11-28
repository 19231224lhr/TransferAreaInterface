package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
)

// PublicKeyNew 替换ecdsa.PublicKey结构体，转账区公钥格式
type PublicKeyNew struct {
	CurveName string // 曲线类型
	X         *big.Int
	Y         *big.Int
}

// TXOutput 交易输出
type TXOutput struct {
	ToAddress     string       // 目的地址
	ToValue       float64      // 转账金额
	ToGuarGroupID string       // 目的用户所属担保人组织id
	ToPublicKey   PublicKeyNew // 目的地址公钥
	ToInterest    float64      // 分配的利息数量
	Type          int          // 货币类型
	ToPeerID      string       // 目的用户peerID
	IsPayForGas   bool         // 是否用来支付手续费
	IsCrossChain  bool         // 是否是跨链交易的Output
	IsGuarMake    bool         // 是不是担保人自己构造的TXOutput
}

// SerializeStruct 通用序列化方法
func SerializeStruct(data interface{}, excludeFields ...string) ([]byte, error) {
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if len(excludeFields) > 0 {
		vCopy := reflect.New(v.Type()).Elem()
		vCopy.Set(v)
		for _, field := range excludeFields {
			fieldValue := vCopy.FieldByName(field)
			if fieldValue.IsValid() && fieldValue.CanSet() {
				fieldValue.Set(reflect.Zero(fieldValue.Type()))
			}
		}
		v = vCopy
	}
	buf, err := json.Marshal(v.Interface())
	return buf, err
}

func main() {
	// 使用用户提供的真实数据
	// 账户公钥: pubXHex: 4794446763d106bc1a9eef4203a2e687b5b09f1b57c8834978371934b4e8aead
	//           pubYHex: 21ad14e8dab098b7f61b11c67f11327e3bfb7fa9291b5152fba60a0f00176633

	fmt.Println("========== 使用用户账户真实数据验证 ==========")
	fmt.Println()

	// 用户账户的公钥
	pubXHex := "4794446763d106bc1a9eef4203a2e687b5b09f1b57c8834978371934b4e8aead"
	pubYHex := "21ad14e8dab098b7f61b11c67f11327e3bfb7fa9291b5152fba60a0f00176633"
	pubXBytes, _ := hex.DecodeString(pubXHex)
	pubYBytes, _ := hex.DecodeString(pubYHex)

	// UTXO 中的 TXOutput (来自 c79138ae392120c3_0)
	// 这是后端返回给前端的 UTXO 数据，包含完整的公钥
	utxoOutput := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(pubXBytes),
			Y:         new(big.Int).SetBytes(pubYBytes),
		},
		ToInterest:   10,
		Type:         0,
		ToPeerID:     "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	serialized, _ := SerializeStruct(utxoOutput)
	hash := sha256.Sum256(serialized)

	fmt.Println("UTXO Output 序列化结果:")
	fmt.Println(string(serialized))
	fmt.Println()
	fmt.Println("UTXO Output Hash (hex):")
	fmt.Println(hex.EncodeToString(hash[:]))
	fmt.Println()
	fmt.Println("UTXO Output Hash (decimal bytes):")
	fmt.Print("[")
	for i, b := range hash[:] {
		if i > 0 {
			fmt.Print(", ")
		}
		fmt.Print(b)
	}
	fmt.Println("]")
	fmt.Println()

	// 目标收款地址的公钥
	toXHex := "2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566"
	toYHex := "c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80"
	toXBytes, _ := hex.DecodeString(toXHex)
	toYBytes, _ := hex.DecodeString(toYHex)

	// 新交易的第一个输出（转给 299954ff8bbd78eda3a686abcf86732cd18533af）
	output1 := TXOutput{
		ToAddress:     "299954ff8bbd78eda3a686abcf86732cd18533af",
		ToValue:       1,
		ToGuarGroupID: "10000000",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(toXBytes),
			Y:         new(big.Int).SetBytes(toYBytes),
		},
		ToInterest:   1,
		Type:         0,
		ToPeerID:     "",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	serialized1, _ := SerializeStruct(output1)
	hash1 := sha256.Sum256(serialized1)
	fmt.Println()
	fmt.Println("========== 新交易 Output 1 (转账) ==========")
	fmt.Println("序列化结果:")
	fmt.Println(string(serialized1))
	fmt.Println()
	fmt.Println("Hash (hex):", hex.EncodeToString(hash1[:]))

	// 新交易的第二个输出（找零给自己）
	output2 := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       9,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(pubXBytes),
			Y:         new(big.Int).SetBytes(pubYBytes),
		},
		ToInterest:   0,
		Type:         0,
		ToPeerID:     "",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	serialized2, _ := SerializeStruct(output2)
	hash2 := sha256.Sum256(serialized2)
	fmt.Println()
	fmt.Println("========== 新交易 Output 2 (找零) ==========")
	fmt.Println("序列化结果:")
	fmt.Println(string(serialized2))
	fmt.Println()
	fmt.Println("Hash (hex):", hex.EncodeToString(hash2[:]))
}
