package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"math/big"
	"reflect"
	"time"
)

// 通用结构体和方法

// EcdsaSignature ecdsa签名
type EcdsaSignature struct {
	R   *big.Int
	S   *big.Int
	sig ecdsa.PublicKey
}

// PublicKeyNew 替换ecdsa.PublicKey结构体，转账区公钥格式
type PublicKeyNew struct {
	CurveName string // 曲线类型
	X         *big.Int
	Y         *big.Int
}

// GuarGroupTable 担保人组织通信表，钱包前端存储，用于验证相关信息是否正确
type GuarGroupTable struct {
	PeerGroupID        string            // 通信组id
	AggrID             string            // 聚合节点id
	AggrPeerID         string            // 聚合节点通信id
	AssiID             string            // 分配节点id
	AssiPeerID         string            // 分配节点id
	PledgeAddress      string            // 质押地址(聚合节点拥有)
	AggrPublicKeyNew   PublicKeyNew      // 担保人组织公钥(聚合节点)
	AssignPublicKeyNew PublicKeyNew      // 人员管理公钥(分配节点)
	GuarTable          map[string]string // 担保人id 担保人通信id
}

// ConvertToPublicKeyNew 将ecdsa.PublicKey转换为PublicKeyNew
func ConvertToPublicKeyNew(key ecdsa.PublicKey, curve string) PublicKeyNew {
	return PublicKeyNew{
		CurveName: curve,
		X:         key.X,
		Y:         key.Y,
	}
}

// ConvertToPublicKey 将PublicKeyNew转换为ecdsa.PublicKeyNew
func ConvertToPublicKey(keyNew PublicKeyNew) ecdsa.PublicKey {
	var curve elliptic.Curve // 椭圆曲线
	// 目前只有一种类型公钥，为后续可更换密钥体系做准备
	switch keyNew.CurveName {
	case "P256":
		curve = elliptic.P256()
		break
	default:
		// 默认为P256椭圆曲线
		curve = elliptic.P256()
		break
	}
	return ecdsa.PublicKey{
		Curve: curve,
		X:     keyNew.X,
		Y:     keyNew.Y,
	}
}

// PrivateKeyToHex 将 ECDSA 私钥 D 转换为 Hex 字符串
func PrivateKeyToHex(privateKey *ecdsa.PrivateKey) string {
	return fmt.Sprintf("%x", privateKey.D.Bytes())
}

// GetTimestamp 求时间戳
func GetTimestamp() uint64 {
	// 自定义起始时间点
	customStartTime := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)

	// 获取当前时间
	currentTime := time.Now()

	// 计算当前时间与自定义起始时间点之间的时间差（以秒为单位）
	duration := currentTime.Sub(customStartTime)
	customTimestampSeconds := uint64(duration.Seconds())
	return customTimestampSeconds
}

// SerializeStruct 通用序列化方法，适用于任何结构体类型
func SerializeStruct(data interface{}, excludeFields ...string) ([]byte, error) {
	// 获取传入数据的反射值
	v := reflect.ValueOf(data)
	// 如果是指针类型，解引用
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	// 如果有字段需要排除，创建副本并进行操作
	if len(excludeFields) > 0 {
		vCopy := reflect.New(v.Type()).Elem()
		vCopy.Set(v)

		// 排除指定的字段
		for _, field := range excludeFields {
			fieldValue := vCopy.FieldByName(field)
			if fieldValue.IsValid() && fieldValue.CanSet() {
				fieldValue.Set(reflect.Zero(fieldValue.Type()))
			} else {
				return nil, fmt.Errorf("field %s not found or cannot be set", field)
			}
		}

		// 赋值为修改后的副本
		v = vCopy
	}
	buf, err := json.Marshal(v.Interface())
	if err != nil {
		fmt.Println("err in AddSelfGuarantorNode")
	}
	return buf, nil
}

// GetStructHash 获得结构体哈希值
func GetStructHash(data interface{}, excludeFields ...string) ([]byte, error) {
	// 1 序列化结构体
	ser, err := SerializeStruct(data, excludeFields...)
	if err != nil {
		return nil, err
	}
	// 2 计算哈希值
	hash := sha256.Sum256(ser)
	return hash[:], nil
}

// SignStruct 使用ECDSA私钥对任意结构体数据进行签名 excludeFields是不签名的字段 适用于单层结构体
func SignStruct(data interface{}, privateKey ecdsa.PrivateKey, excludeFields ...string) (EcdsaSignature, error) {
	// 1 计算哈希值
	hash, err := GetStructHash(data, excludeFields...)
	if err != nil {
		return EcdsaSignature{}, err
	}

	// 2 使用私钥进行签名
	r, s, err := ecdsa.Sign(rand.Reader, &privateKey, hash[:])
	if err != nil {
		return EcdsaSignature{}, err
	}

	return EcdsaSignature{R: r, S: s}, nil
}

// VerifyStructSig 验证签名 不返回错误说明验证通过
func VerifyStructSig(signature EcdsaSignature, key ecdsa.PublicKey, data interface{}, excludeFields ...string) error {
	// 1 计算哈希值
	hash, err := GetStructHash(data, excludeFields...)
	if err != nil {
		return err
	}
	// 2 验证签名
	result := ecdsa.Verify(&key, hash, signature.R, signature.S)
	if !result {
		return fmt.Errorf("signature verification error")
	}
	return nil
}

// ExchangeRate 汇率转换 外币转成本币的汇率
func ExchangeRate(MoneyType int) float64 {
	switch MoneyType {
	case 0:
		// 盘古币
		return 1
	case 1:
		// 比特币
		return 10000000
	case 2:
		// 以太坊
		return 1000
	default:
		return 1
	}
}

// Generate8DigitNumberBasedOnInput 根据输入字符串生成一个8位的数字类型字符串，结果是确定的
func Generate8DigitNumberBasedOnInput(input string) string {
	// 使用crc32.IEEE算法计算输入字符串的哈希值
	hash := crc32.ChecksumIEEE([]byte(input))
	// 将哈希值映射到10000000到99999999的范围
	num := int(hash%90000000) + 10000000
	return fmt.Sprintf("%08d", num)
}
