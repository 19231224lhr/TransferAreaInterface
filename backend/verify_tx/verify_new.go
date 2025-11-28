package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
)

// PublicKeyNew 替换ecdsa.PublicKey结构体
type PublicKeyNew struct {
	CurveName string
	X         *big.Int
	Y         *big.Int
}

// TXOutput 交易输出
type TXOutput struct {
	ToAddress     string
	ToValue       float64
	ToGuarGroupID string
	ToPublicKey   PublicKeyNew
	ToInterest    float64
	Type          int
	ToPeerID      string
	IsPayForGas   bool
	IsCrossChain  bool
	IsGuarMake    bool
}

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
	fmt.Println("========== 验证新交易的 TXOutputHash ==========\n")

	// 用户的交易数据
	// 账户公钥
	pubXHex := "e2dd015dacf8a18408eb2f56bbe0291fa4ba03c9a26284618135e0832da240f9"
	pubYHex := "f055108f925592b01acaef93a45564c1b6137e28f1dd7b66b856db9ae01d6db4"
	pubXBytes, _ := hex.DecodeString(pubXHex)
	pubYBytes, _ := hex.DecodeString(pubYHex)

	// 交易中提供的 TXOutputHash
	providedHash := []byte{147, 242, 107, 239, 86, 84, 37, 161, 229, 173, 170, 115, 40, 230, 92, 166, 43, 11, 63, 172, 24, 109, 110, 0, 243, 232, 106, 150, 74, 28, 119, 39}
	fmt.Println("交易中的 TXOutputHash (hex):", hex.EncodeToString(providedHash))

	// 我们需要知道原始 UTXO 的 output 数据
	// 从 FromTXID: 16b8703b66d49a47 的第 0 个输出
	// 假设它的值是 10，利息是 10，有 ToPeerID

	// 情况1: 有完整公钥，有 ToPeerID (类似 coinbase 交易)
	fmt.Println("\n--- 情况1: 有公钥 + 有 ToPeerID ---")
	output1 := TXOutput{
		ToAddress:     "e26010aebe0e19325e584bdf50d7a6270ddbfb03",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(pubXBytes),
			Y:         new(big.Int).SetBytes(pubYBytes),
		},
		ToInterest:   10,
		Type:         0,
		ToPeerID:     "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D", // 假设有 PeerID
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}
	ser1, _ := SerializeStruct(output1)
	hash1 := sha256.Sum256(ser1)
	fmt.Println("序列化:", string(ser1))
	fmt.Println("Hash:", hex.EncodeToString(hash1[:]))
	if hex.EncodeToString(hash1[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✓ 匹配!")
	}

	// 情况2: 有公钥，无 ToPeerID
	fmt.Println("\n--- 情况2: 有公钥 + 无 ToPeerID ---")
	output2 := TXOutput{
		ToAddress:     "e26010aebe0e19325e584bdf50d7a6270ddbfb03",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey: PublicKeyNew{
			CurveName: "P256",
			X:         new(big.Int).SetBytes(pubXBytes),
			Y:         new(big.Int).SetBytes(pubYBytes),
		},
		ToInterest:   10,
		Type:         0,
		ToPeerID:     "",
		IsPayForGas:  false,
		IsCrossChain: false,
		IsGuarMake:   false,
	}
	ser2, _ := SerializeStruct(output2)
	hash2 := sha256.Sum256(ser2)
	fmt.Println("序列化:", string(ser2))
	fmt.Println("Hash:", hex.EncodeToString(hash2[:]))
	if hex.EncodeToString(hash2[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✓ 匹配!")
	}

	// 情况3: 无公钥
	fmt.Println("\n--- 情况3: 无公钥 ---")
	output3 := TXOutput{
		ToAddress:     "e26010aebe0e19325e584bdf50d7a6270ddbfb03",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey:   PublicKeyNew{}, // 空公钥
		ToInterest:    10,
		Type:          0,
		ToPeerID:      "",
		IsPayForGas:   false,
		IsCrossChain:  false,
		IsGuarMake:    false,
	}
	ser3, _ := SerializeStruct(output3)
	hash3 := sha256.Sum256(ser3)
	fmt.Println("序列化:", string(ser3))
	fmt.Println("Hash:", hex.EncodeToString(hash3[:]))
	if hex.EncodeToString(hash3[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✓ 匹配!")
	}

	// 情况4: 无公钥 + 有 ToPeerID
	fmt.Println("\n--- 情况4: 无公钥 + 有 ToPeerID ---")
	output4 := TXOutput{
		ToAddress:     "e26010aebe0e19325e584bdf50d7a6270ddbfb03",
		ToValue:       10,
		ToGuarGroupID: "",
		ToPublicKey:   PublicKeyNew{},
		ToInterest:    10,
		Type:          0,
		ToPeerID:      "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
		IsPayForGas:   false,
		IsCrossChain:  false,
		IsGuarMake:    false,
	}
	ser4, _ := SerializeStruct(output4)
	hash4 := sha256.Sum256(ser4)
	fmt.Println("序列化:", string(ser4))
	fmt.Println("Hash:", hex.EncodeToString(hash4[:]))
	if hex.EncodeToString(hash4[:]) == hex.EncodeToString(providedHash) {
		fmt.Println("✓ 匹配!")
	}
}
