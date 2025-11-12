package core

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
)

// GenerateKeyPair 生成 ECDSA 公私钥对
func GenerateKeyPair() (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	// 选择椭圆曲线，这里使用 secp256k1
	curve := elliptic.P256() // 如果需要 secp256k1，请使用相应的库
	privateKey, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	publicKey := &privateKey.PublicKey
	return privateKey, publicKey, nil
}

// PrivateKeyToHex 将 ECDSA 私钥 D 转换为 Hex 字符串
func PrivateKeyToHex(privateKey *ecdsa.PrivateKey) string {
	return fmt.Sprintf("%x", privateKey.D.Bytes())
}

// PublicKeyToHex 将 ECDSA 公钥 X 和 Y 转换为 Hex 字符串 公钥连成一个字符串，两部分公钥用&符号连接
func PublicKeyToHex(publicKey *ecdsa.PublicKey) string {
	publicKey1 := fmt.Sprintf("%x", publicKey.X.Bytes())
	publicKey2 := fmt.Sprintf("%x", publicKey.Y.Bytes())
	Key := publicKey1 + "&" + publicKey2
	return Key
}

// HexToBigInt 将 Hex 字符串转换为 *big.Int
func HexToBigInt(hexStr string) (*big.Int, error) {
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return nil, fmt.Errorf("无效的 Hex 字符串: %v", err)
	}
	return new(big.Int).SetBytes(bytes), nil
}

// ParsePrivateKey 从 Hex 字符串解析 ECDSA 私钥
func ParsePrivateKey(hexStr string) (*ecdsa.PrivateKey, error) {
	curve := elliptic.P256()
	d, err := HexToBigInt(hexStr)
	if err != nil {
		return nil, fmt.Errorf("解析私钥失败: %v", err)
	}

	if d.Cmp(big.NewInt(0)) == 0 || d.Cmp(curve.Params().N) >= 0 {
		return nil, errors.New("私钥 D 必须在 [1, N-1] 范围内")
	}

	x, y := curve.ScalarBaseMult(d.Bytes())

	privateKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: curve,
			X:     x,
			Y:     y,
		},
		D: d,
	}

	return privateKey, nil
}

// ParsePublicKey 从 Hex 字符串解析 ECDSA 公钥
func ParsePublicKey(publicKeyString string) (*ecdsa.PublicKey, error) {
	// 分割
	xHex, yHex := SplitStringByAmpersand(publicKeyString)
	curve := elliptic.P256()
	x, err := HexToBigInt(xHex)
	if err != nil {
		return nil, fmt.Errorf("解析公钥 X 失败: %v", err)
	}

	y, err := HexToBigInt(yHex)
	if err != nil {
		return nil, fmt.Errorf("解析公钥 Y 失败: %v", err)
	}

	// 验证公钥是否在曲线上
	if !curve.IsOnCurve(x, y) {
		return nil, errors.New("公钥不在指定的椭圆曲线上")
	}

	publicKey := &ecdsa.PublicKey{
		Curve: curve,
		X:     x,
		Y:     y,
	}

	return publicKey, nil
}

// 测试方法已移除，请在 *_test.go 中编写测试以避免引入额外依赖。
