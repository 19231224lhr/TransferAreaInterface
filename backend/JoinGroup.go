package main

import (
	"crypto/ecdsa"
)

// 功能3 加入担保组织
// 该功能用于前端新创建一个用户信息后，如何让该用户加入指定的10000000担保组织

// UserFlowMsg 用户加入和退出担保人组织申请
type UserFlowMsg struct {
	Status int // 0为退出，1加入

	UserID      string // 用户id
	UserPeerID  string // 用户通信id
	GuarGroupID string // 所属的担保组织ID

	UserPublicKey PublicKeyNew               // 用户账户公钥 记录在UserMessage中
	AddressMsg    map[string]FlowAddressData // 用户申请担保的地址信息 address钱包子地址-PK

	TimeStamp uint64         // 申请时间戳，用于Address签名
	UserSig   EcdsaSignature // 加入或退出时用户需要签名
}

type FlowAddressData struct {
	AddressData AddressData2 // 只需要写公钥(其实公钥也不用写，因为可以从StoragePoint中获取)
}

// UserFlowMsgReply 回复用户加入担保组织的请求
type UserFlowMsgReply struct {
	Result        bool           // 是否通过
	RefusalReason string         // 拒绝原因
	GroupID       string         // 担保人组织id
	GuarGroupMsg  GuarGroupTable // 担保人组织信息
	BlockHeight   int            // 区块高度高度

	Sig EcdsaSignature // 签名
}

// GetFlowUserSig UserFlowMsg 用户签名
func (u *UserFlowMsg) GetFlowUserSig(key ecdsa.PrivateKey) (EcdsaSignature, error) {
	sig, err := SignStruct(u, key, "UserSig")
	if err != nil {
		return sig, err
	}
	return sig, nil
}

// JoinGuarGroup 示例方法：用户加入10000000担保人组织
func (a *Account) JoinGuarGroup() error {
	flowMsg := UserFlowMsg{
		Status:        1,
		UserID:        a.AccountID,
		UserPeerID:    "QmP2sLTjDUezfsWcBRETu9XNg8KYcwzgBAZcXupU3Z86Vo", // 填入一个伪造的peerID
		GuarGroupID:   "10000000",
		UserPublicKey: ConvertToPublicKeyNew(a.AccountPublicKey, "P256"),
		AddressMsg:    make(map[string]FlowAddressData),
		TimeStamp:     GetTimestamp(),
	}
	// 加入地址信息
	for address, msg := range a.Wallet.AddressMsg {
		flowMsg.AddressMsg[address] = FlowAddressData{
			AddressData: AddressData2{
				PublicKeyNew: ConvertToPublicKeyNew(msg.WPublicKey, "P256"),
			},
		}
	}
	// 签名
	sig, err := flowMsg.GetFlowUserSig(a.AccountPrivateKey)
	flowMsg.UserSig = sig
	if err != nil {
		return err
	}
	// TODO: 通过RPC把flowMsg发送给担保组织

	return nil
}

// ReceiveJoinReply 示例方法：处理加入担保组织申请回复，用户加入担保组织
func (a *Account) ReceiveJoinReply(msg UserFlowMsgReply) (err error) {
	// 验证签名 暂时不验证签名
	// 加入成功，更新本地信息
	a.GuarantorGroupID = msg.GroupID
	a.GuarGroupBootMsg = msg.GuarGroupMsg
	a.Wallet.UpdateBlock = msg.BlockHeight
	return nil
}
