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
	// 测试1：没有 ToPublicKey 的情况（模拟前端 UTXO 中的 output）
	fmt.Println("========== 测试1：没有 ToPublicKey 的 TXOutput ==========")
	output1 := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey:   PublicKeyNew{}, // 空的 PublicKey
		ToInterest:    10,
		Type:          0,
		ToPeerID:      "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
		IsPayForGas:   false,
		IsCrossChain:  false,
		IsGuarMake:    false,
	}
	serialized1, _ := SerializeStruct(output1)
	hash1 := sha256.Sum256(serialized1)
	fmt.Println("序列化结果:")
	fmt.Println(string(serialized1))
	fmt.Println("\nHash:", hex.EncodeToString(hash1[:]))
	fmt.Println("\nHash (decimal bytes):")
	fmt.Print("[")
	for i, b := range hash1[:] {
		if i > 0 {
			fmt.Print(", ")
		}
		fmt.Print(b)
	}
	fmt.Println("]")

	// 测试2：有 ToPublicKey 的情况（正确的后端处理）
	fmt.Println("\n\n========== 测试2：有 ToPublicKey 的 TXOutput ==========")
	xHex := "4794446763d106bc1a9eef4203a2e687b5b09f1b57c8834978371934b4e8aead"
	yHex := "21ad14e8dab098b7f61b11c67f11327e3bfb7fa9291b5152fba60a0f00176633"
	xBytes, _ := hex.DecodeString(xHex)
	yBytes, _ := hex.DecodeString(yHex)

	output2 := TXOutput{
		ToAddress:     "6e7d13d0a7803be1d5132c0f9f88ecbf031ee819",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(xBytes),
			Y:         new(big.Int).SetBytes(yBytes),
		},
		ToInterest:   10,
		Type:         0,
		ToPeerID:     "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}
	serialized2, _ := SerializeStruct(output2)
	hash2 := sha256.Sum256(serialized2)
	fmt.Println("序列化结果:")
	fmt.Println(string(serialized2))
	fmt.Println("\nHash:", hex.EncodeToString(hash2[:]))
	fmt.Println("\nHash (decimal bytes):")
	fmt.Print("[")
	for i, b := range hash2[:] {
		if i > 0 {
			fmt.Print(", ")
		}
		fmt.Print(b)
	}
	fmt.Println("]")

	// 检查提供的hash
	providedHash := []byte{187, 187, 68, 222, 172, 132, 136, 112, 74, 112, 246, 16, 158, 134, 162, 101, 0, 69, 146, 161, 171, 144, 57, 198, 76, 203, 141, 30, 141, 62, 144, 127}
	fmt.Println("\n\n========== 比较结果 ==========")
	fmt.Println("交易中提供的 TXOutputHash:", hex.EncodeToString(providedHash))

	if hex.EncodeToString(hash1[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✅ 与测试1（无 ToPublicKey）匹配!")
	} else if hex.EncodeToString(hash2[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✅ 与测试2（有 ToPublicKey）匹配!")
	} else {
		fmt.Println("❌ 两者都不匹配，需要进一步调查")
	}
}
