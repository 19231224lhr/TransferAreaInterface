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
	// 第一个输出 - 转给 299954ff8bbd78eda3a686abcf86732cd18533af
	xHex1 := "2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566"
	yHex1 := "c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80"

	xBytes1, _ := hex.DecodeString(xHex1)
	yBytes1, _ := hex.DecodeString(yHex1)

	output1 := TXOutput{
		ToAddress:     "299954ff8bbd78eda3a686abcf86732cd18533af",
		ToValue:       1,
		ToGuarGroupID: "10000000",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(xBytes1),
			Y:         new(big.Int).SetBytes(yBytes1),
		},
		ToInterest:   1,
		Type:         0,
		ToPeerID:     "",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	// 第二个输出 - 找零给 6e7d13d0a7803be1d5132c0f9f88ecbf031ee819
	xHex2 := "4794446763d106bc1a9eef4203a2e687b5b09f1b57c8834978371934b4e8aead"
	yHex2 := "21ad14e8dab098b7f61b11c67f11327e3bfb7fa9291b5152fba60a0f00176633"

	xBytes2, _ := hex.DecodeString(xHex2)
	yBytes2, _ := hex.DecodeString(yHex2)

	output2 := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       9,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(xBytes2),
			Y:         new(big.Int).SetBytes(yBytes2),
		},
		ToInterest:   0,
		Type:         0,
		ToPeerID:     "",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	// 计算原始 UTXO 的 Output Hash (用于 TXInputNormal)
	// 这是从 c79138ae392120c3 交易的第 0 个输出
	xHexUtxo := "4794446763d106bc1a9eef4203a2e687b5b09f1b57c8834978371934b4e8aead"
	yHexUtxo := "21ad14e8dab098b7f61b11c67f11327e3bfb7fa9291b5152fba60a0f00176633"
	xBytesUtxo, _ := hex.DecodeString(xHexUtxo)
	yBytesUtxo, _ := hex.DecodeString(yHexUtxo)

	utxoOutput := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(xBytesUtxo),
			Y:         new(big.Int).SetBytes(yBytesUtxo),
		},
		ToInterest:   10,
		Type:         0,
		ToPeerID:     "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}

	fmt.Println("========== TXOutput 序列化测试 ==========")

	// UTXO Output
	utxoSerialized, _ := SerializeStruct(utxoOutput)
	utxoHash := sha256.Sum256(utxoSerialized)
	fmt.Println("\nUTXO Output (c79138ae392120c3_0) 序列化:")
	fmt.Println(string(utxoSerialized))
	fmt.Println("\nUTXO Output Hash (hex):")
	fmt.Println(hex.EncodeToString(utxoHash[:]))
	fmt.Println("\nUTXO Output Hash (decimal bytes):")
	fmt.Print("[")
	for i, b := range utxoHash[:] {
		if i > 0 {
			fmt.Print(", ")
		}
		fmt.Print(b)
	}
	fmt.Println("]")

	// 验证交易中的 TXOutputHash
	providedHash := []byte{187, 187, 68, 222, 172, 132, 136, 112, 74, 112, 246, 16, 158, 134, 162, 101, 0, 69, 146, 161, 171, 144, 57, 198, 76, 203, 141, 30, 141, 62, 144, 127}
	fmt.Println("\n交易中提供的 TXOutputHash (hex):")
	fmt.Println(hex.EncodeToString(providedHash))

	if hex.EncodeToString(utxoHash[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("\n✅ TXOutputHash 匹配正确!")
	} else {
		fmt.Println("\n❌ TXOutputHash 不匹配!")
	}

	// Output 1
	out1Serialized, _ := SerializeStruct(output1)
	out1Hash := sha256.Sum256(out1Serialized)
	fmt.Println("\n\n========== Output 1 序列化 ==========")
	fmt.Println(string(out1Serialized))
	fmt.Println("\nHash:", hex.EncodeToString(out1Hash[:]))

	// Output 2
	out2Serialized, _ := SerializeStruct(output2)
	out2Hash := sha256.Sum256(out2Serialized)
	fmt.Println("\n\n========== Output 2 序列化 ==========")
	fmt.Println(string(out2Serialized))
	fmt.Println("\nHash:", hex.EncodeToString(out2Hash[:]))
}
