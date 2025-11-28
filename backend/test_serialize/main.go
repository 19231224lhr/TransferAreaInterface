package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
)

// EcdsaSignature 签名结构体 - 注意要和后端完全一致！
type EcdsaSignature struct {
	R   *big.Int
	S   *big.Int
	sig interface{} // 私有字段
}

// PublicKeyNew 公钥结构体
type PublicKeyNew struct {
	CurveName string
	X         *big.Int
	Y         *big.Int
}

// TxPosition 交易位置
type TxPosition struct {
	Blocknum int
	IndexX   int
	IndexY   int
	IndexZ   int
}

// InterestAssign gas费分配
type InterestAssign struct {
	Gas        float64
	Output     float64
	BackAssign map[string]float64
}

// TXInputNormal 常规输入
type TXInputNormal struct {
	FromTXID        string
	FromTxPosition  TxPosition
	FromAddress     string
	IsGuarMake      bool
	IsCommitteeMake bool
	IsCrossChain    bool
	InputSignature  EcdsaSignature
	TXOutputHash    []byte
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

// Transaction 交易结构体
type Transaction struct {
	TXID                string
	Size                int
	Version             float32
	GuarantorGroup      string
	TXType              int
	Value               float64
	ValueDivision       map[int]float64
	NewValue            float64
	NewValueDiv         map[int]float64
	InterestAssign      InterestAssign
	UserSignature       EcdsaSignature
	TXInputsNormal      []TXInputNormal
	TXInputsCertificate []interface{}
	TXOutputs           []TXOutput
	Data                []byte
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
			} else {
				return nil, fmt.Errorf("field %s not found or cannot be set", field)
			}
		}
		v = vCopy
	}
	buf, err := json.Marshal(v.Interface())
	if err != nil {
		fmt.Println("err in SerializeStruct:", err)
	}
	return buf, nil
}

func main() {
	// 创建大数
	bigR, _ := new(big.Int).SetString("12345678901234567890123456789012345678901234567890", 10)
	bigS, _ := new(big.Int).SetString("98765432109876543210987654321098765432109876543210", 10)
	bigX, _ := new(big.Int).SetString("111111111111111111111111111111111111111111111111111", 10)
	bigY, _ := new(big.Int).SetString("222222222222222222222222222222222222222222222222222", 10)

	// 创建一个测试交易
	tx := Transaction{
		TXID:           "",
		Size:           100,
		Version:        0.1,
		GuarantorGroup: "10000000",
		TXType:         0,
		Value:          10,
		ValueDivision:  map[int]float64{0: 10},
		NewValue:       0,
		NewValueDiv:    nil,
		InterestAssign: InterestAssign{
			Gas:    0,
			Output: 0,
			BackAssign: map[string]float64{
				"abc123": 1,
			},
		},
		UserSignature: EcdsaSignature{R: nil, S: nil},
		TXInputsNormal: []TXInputNormal{
			{
				FromTXID:       "prev-txid",
				FromTxPosition: TxPosition{Blocknum: 1, IndexX: 0, IndexY: 0, IndexZ: 0},
				FromAddress:    "abc123def456",
				IsGuarMake:     false,
				InputSignature: EcdsaSignature{
					R: bigR,
					S: bigS,
				},
				TXOutputHash: []byte{0x12, 0x34, 0x56, 0x78},
			},
		},
		TXOutputs: []TXOutput{
			{
				ToAddress:     "dest123",
				ToValue:       10,
				ToGuarGroupID: "10000000",
				ToPublicKey: PublicKeyNew{
					CurveName: "P256",
					X:         bigX,
					Y:         bigY,
				},
				ToInterest: 0,
				Type:       0,
			},
		},
		Data: nil,
	}

	fmt.Println("=== 测试 Go JSON 序列化 ===")
	fmt.Println()

	// 1. 测试完整序列化
	fullJSON, _ := json.MarshalIndent(tx, "", "  ")
	fmt.Println("1. 完整交易 JSON:")
	fmt.Println(string(fullJSON))
	fmt.Println()

	// 2. 测试排除字段后的序列化 (模拟签名时的情况)
	serialized, _ := SerializeStruct(tx, "Size", "NewValue", "UserSignature", "TXType")
	fmt.Println("2. 排除字段后的 JSON (Size, NewValue, UserSignature, TXType):")
	fmt.Println(string(serialized))
	fmt.Println()

	// 3. 计算哈希
	hash := sha256.Sum256(serialized)
	fmt.Printf("3. SHA256 哈希: %x\n", hash)
	fmt.Println()

	// 4. 测试 big.Int 的 JSON 序列化
	fmt.Println("4. 测试 *big.Int 序列化:")
	sig := EcdsaSignature{
		R: bigR,
		S: bigS,
	}
	sigJSON, _ := json.Marshal(sig)
	fmt.Printf("   EcdsaSignature JSON: %s\n", sigJSON)
	fmt.Println()

	// 5. 测试 nil big.Int
	fmt.Println("5. 测试 nil *big.Int 序列化:")
	nilSig := EcdsaSignature{R: nil, S: nil}
	nilJSON, _ := json.Marshal(nilSig)
	fmt.Printf("   nil EcdsaSignature JSON: %s\n", nilJSON)
	fmt.Println()

	// 6. 测试 []byte 序列化
	fmt.Println("6. 测试 []byte 序列化:")
	type ByteTest struct {
		Data []byte
	}
	bt := ByteTest{Data: []byte{0x12, 0x34, 0x56, 0x78}}
	btJSON, _ := json.Marshal(bt)
	fmt.Printf("   []byte JSON: %s\n", btJSON)
	fmt.Println()

	// 7. 测试 nil []byte
	fmt.Println("7. 测试 nil []byte 序列化:")
	btNil := ByteTest{Data: nil}
	btNilJSON, _ := json.Marshal(btNil)
	fmt.Printf("   nil []byte JSON: %s\n", btNilJSON)
	fmt.Println()

	// 8. 测试 map 键排序
	fmt.Println("8. 测试 map[int]float64 键排序:")
	vd := map[int]float64{2: 20, 0: 10, 1: 15}
	vdJSON, _ := json.Marshal(vd)
	fmt.Printf("   map[int]float64 JSON: %s\n", vdJSON)
	fmt.Println()

	// 9. 测试 map[string]float64 键排序
	fmt.Println("9. 测试 map[string]float64 键排序:")
	ba := map[string]float64{"zebra": 1, "alpha": 2, "beta": 3}
	baJSON, _ := json.Marshal(ba)
	fmt.Printf("   map[string]float64 JSON: %s\n", baJSON)
}
