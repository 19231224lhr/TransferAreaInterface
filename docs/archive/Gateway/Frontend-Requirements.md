# 前端（User/Wallet）功能需求文档

> **说明**：User/Wallet 在本系统中扮演前端角色。本文档描述前端需要实现的功能、调用的后端接口、以及如何处理返回数据。前端代码将运行在 JavaScript 环境下，本文档提供了 Go 后端代码参考和 JS 伪代码示例。

---

## 一、前端功能概览

| 功能编号 | 功能名称 | 调用方式 | 后端节点 | 后端接口 | 前端处理方法 |
| --- | --- | --- | --- | --- | --- |
| F01 | 用户登录/重登 | POST | BootNode(Gateway) | `/api/v1/re-online` | `LoginHandle` → `LoginExecutor` |
| F02 | 加入担保组织 | POST | AssignNode(Gateway) | `/api/v1/{groupID}/assign/flow-apply` | `JoinGuarGroup` → `ReceiveJoinReply` |
| F03 | 退出担保组织 | POST | AssignNode(Gateway) | `/api/v1/{groupID}/assign/flow-apply` | `ExitGuarGroup` |
| F04 | 新建子地址 | POST | AssignNode(Gateway) | `/api/v1/{groupID}/assign/new-address` | `NewSubAddress` |
| F05 | 发送交易（组内） | POST | AssignNode(Gateway) | `/api/v1/{groupID}/assign/submit-tx` | `SendNewTXFunction` |
| F06 | 发送交易（散户） | POST | ComNode | `/api/v1/com/submit-noguargroup-tx` | `SendNewTXFunction`（散户分支） |
| F07 | 查询担保组织信息（未入组） | GET | BootNode | `/api/v1/groups/{id}` | `FindGuarGroup` → `AddGroupBootMsg` |
| F08 | 查询担保组织信息（已入组/组内查询） | GET | AssignNode(Gateway) | `/api/v1/{groupID}/assign/group-info` | `FindGuarGroup` → `AddGroupBootMsg` |
| F09 | 查询账户信息 | POST | ComNode | `/api/v1/com/query-address` | `GetAddressData` → `ReceiveAddressData` |
| F10 | 查询地址所属担保组织 | POST | ComNode | `/api/v1/com/query-address-group` | `ReceiveUserQueryAddressGuarGroup` |
| F11 | 轮询账户更新 | GET | AssignNode(Gateway) | `/api/v1/{groupID}/assign/account-update` | `UpdateAccountWallet` |
| F12 | 轮询接收 TXCer | GET | AggrNode | `/api/v1/aggr/txcer` | `ReceiveTXCer` |
| F13 | 轮询 TXCer 状态变动 | GET | AssignNode(Gateway) | `/api/v1/{groupID}/assign/txcer-change` | `UpdateAccountTXCerTable` |
| F14 | 轮询 UTXO 变动（TXCer兑换） | GET | ComNode | `/api/v1/com/utxo-change` | `PrintAddressUTXOChange` |

---

## 二、前端功能详细说明

### F01: 用户登录/重登

**场景**：用户启动钱包应用后，需要向后端同步自己的账户状态。

**调用流程**：
1. 前端构造 `UserReOnlineMsg` 结构体（包含 `UserID`, `Address[]`, `Sig`）
2. 调用 **BootNode 统一入口**：`POST /api/v1/re-online`
3. BootNode 根据 `UserID -> GuarGroupID` 路由表转发到对应担保组织的 AssignNode：`POST /api/v1/{groupID}/assign/re-online`（必要时 fallback 探测并缓存）
4. 前端收到 `ReturnUserReOnlineMsg`，处理登录结果

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/login.go` 131-148
- 前端处理逻辑参考：`wallet/login.go` 16-99（`LoginExecutor`）
- 后端业务逻辑：`assignnode.go` 995-1039（`UserReOnline` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "user_id": "12345678",
    "address": ["addr1...", "addr2..."],
    "sig": { "r": "...", "s": "..." }
}
```

**输出结构**：
```json
{
    "user_id": "12345678",
    "is_in_group": true,
    "guarantor_group_id": "group001",
    "guar_group_boot": { /* GuarGroupTable */ },
    "user_wallet_data": {
        "value": 1000.0,
        "value_division": { "0": 500.0, "1": 500.0 },
        "sub_address_msg": { /* 地址数据 */ }
    }
}
```

**前端 JS 伪代码**：
```javascript
async function login(userId, addresses, privateKey) {
    // 1. 构造签名消息
    const msgToSign = { user_id: userId, address: addresses };
    const sig = signMessage(msgToSign, privateKey);
    
    const request = {
        user_id: userId,
        address: addresses,
        sig: sig
    };
    
    // 2. 发送登录请求
    const response = await fetch('/api/v1/re-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    // 3. 处理登录结果
    if (result.is_in_group) {
        // 用户在担保组织内
        console.log('用户已加入担保组织:', result.guarantor_group_id);
        saveGuarGroupInfo(result.guarantor_group_id, result.guar_group_boot);
    } else {
        // 散户模式
        console.log('用户是散户，未加入担保组织');
    }
    
    // 4. 同步钱包数据
    syncWalletData(result.user_wallet_data, addresses);
    
    return result;
}

function syncWalletData(walletData, inputAddresses) {
    for (const address of inputAddresses) {
        if (walletData.sub_address_msg[address]) {
            const data = walletData.sub_address_msg[address];
            updateLocalAddress(address, {
                value: data.value,
                type: data.type,
                utxo: data.utxo,
                txcers: data.txcers,
                est_interest: data.est_interest
            });
        } else {
            console.warn('地址未找到:', address);
            removeLocalAddress(address);
        }
    }
}
```

---

### F02: 加入担保组织

**场景**：用户选择加入某个担保组织以享受快速转账服务。

**调用流程**：
1. 前端先调用 `GET /api/v1/groups/{id}` 查询目标担保组织信息
2. 前端构造 `UserFlowMsg`（`Status=1` 表示加入）
3. 调用 `POST /api/v1/{groupID}/assign/flow-apply`
4. 后端 AssignNode 调用 `ProcessUserFlowApplyForGateway` 处理
5. 前端收到 `UserFlowMsgReply`，处理结果

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 408-459（`joingroup` 命令）
- 前端处理逻辑参考：`wallet/handle.go` 45-56（case 24）
- 后端业务逻辑：`manage.go` 71-190（`ProcessUserFlowApply` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "status": 1,
    "user_id": "12345678",
    "user_peer_id": "",
    "guar_group_id": "group001",
    "user_public_key": { "x": "...", "y": "..." },
    "address_msg": {
        "addr1...": {
            "address_data": { "public_key": {...} }
        }
    },
    "timestamp": 1702300000000,
    "user_sig": { "r": "...", "s": "..." }
}
```

**输出结构**：
```json
{
    "status": 1,
    "user_id": "12345678",
    "guar_group_id": "group001",
    "result": true,
    "message": "Successfully joined the guarantor group"
}
```

**前端 JS 伪代码**：
```javascript
async function joinGuarGroup(groupId, addresses, userPublicKey, privateKey) {
    // 1. 检查是否已加入担保组织
    if (currentGuarGroupId) {
        throw new Error('请先退出当前担保组织');
    }
    
    // 2. 查询担保组织信息
    const groupInfo = await fetch(`/api/v1/groups/${groupId}`).then(r => r.json());
    console.log('担保组织信息:', groupInfo);
    
    // 3. 构造地址信息
    const addressMsg = {};
    for (const addr of addresses) {
        addressMsg[addr] = {
            address_data: {
                public_key: getAddressPublicKey(addr)
            }
        };
    }
    
    // 4. 构造加入请求
    const timestamp = Date.now();
    const msgToSign = {
        status: 1,
        user_id: userId,
        guar_group_id: groupId,
        user_public_key: userPublicKey,
        address_msg: addressMsg,
        timestamp: timestamp
    };
    
    const request = {
        ...msgToSign,
        user_peer_id: '',
        user_sig: signMessage(msgToSign, privateKey)
    };
    
    // 5. 发送请求
    const response = await fetch(`/api/v1/${groupId}/assign/flow-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    // 6. 处理结果
    if (result.result) {
        console.log('加入成功:', result.message);
        setCurrentGuarGroupId(groupId);
        saveGuarGroupInfo(groupId, groupInfo);
    } else {
        console.error('加入失败:', result.message);
    }
    
    return result;
}
```

**注意事项**：
- 时间戳有 5 分钟有效期，超时后签名失效
- 地址信息中的公钥需要与链上记录匹配

---

### F03: 退出担保组织

**场景**：用户选择退出当前担保组织。

**调用流程**：
1. 前端构造 `UserFlowMsg`（`Status=0` 表示退出）
2. 调用 `POST /api/v1/{groupID}/assign/flow-apply`
3. 后端处理并返回结果

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 460-482（`exitgroup` 命令）
- 后端业务逻辑：`manage.go` 71-190（`ProcessUserFlowApply` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "status": 0,
    "user_id": "12345678",
    "guar_group_id": "group001",
    "user_sig": { "r": "...", "s": "..." }
}
```

**前端 JS 伪代码**：
```javascript
async function exitGuarGroup(privateKey) {
    if (!currentGuarGroupId) {
        throw new Error('您尚未加入担保组织');
    }
    
    const request = {
        status: 0,
        user_id: userId,
        guar_group_id: currentGuarGroupId,
        user_sig: signMessage({ status: 0, user_id: userId, guar_group_id: currentGuarGroupId }, privateKey)
    };
    
    const response = await fetch(`/api/v1/${currentGuarGroupId}/assign/flow-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    if (result.result) {
        console.log('退出成功');
        setCurrentGuarGroupId(null);
    }
    
    return result;
}
```

---

### F04: 新建子地址

**场景**：用户创建新的钱包子地址。

**调用流程**：
1. 前端本地生成新的公私钥对
2. 前端计算地址（SHA256 公钥取前 20 字节的 hex）
3. 构造 `UserNewAddressInfo` 并签名
4. 调用 `POST /api/v1/{groupID}/assign/new-address`
5. 后端验证并存储

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 483-515（`newwallet` 命令）
- 后端业务逻辑：`manage.go` 33-68（`ProcessUserNewAddress` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "new_address": "abc123...",
    "public_key": { "x": "...", "y": "..." },
    "user_id": "12345678",
    "type": 0,
    "sig": { "r": "...", "s": "..." }
}
```

**输出结构**：
```json
{
    "success": true,
    "message": "Address created successfully"
}
```

**前端 JS 伪代码**：
```javascript
async function createNewAddress(type, userPrivateKey) {
    // type: 0=盘古币, 1=比特币, 2=以太坊
    
    // 1. 生成新的密钥对
    const { privateKey, publicKey } = generateECDSAKeyPair();
    
    // 2. 计算地址 (SHA256 公钥，取前 40 字符 hex = 20 字节)
    const pubKeyBytes = encodePublicKey(publicKey);
    const hash = sha256(pubKeyBytes);
    const address = hash.slice(0, 40);
    
    // 3. 构造请求
    const msgToSign = {
        new_address: address,
        public_key: publicKey,
        user_id: userId,
        type: type
    };
    
    const request = {
        ...msgToSign,
        sig: signMessage(msgToSign, userPrivateKey)
    };
    
    // 4. 发送到后端
    const response = await fetch(`/api/v1/${currentGuarGroupId}/assign/new-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    if (result.success) {
        // 5. 本地保存（重要！私钥必须安全存储）
        saveAddressLocally(address, {
            privateKey: privateKey,
            publicKey: publicKey,
            type: type
        });
        
        console.log('新地址创建成功:', address);
        console.log('请妥善保管私钥！');
    }
    
    return { address, privateKey, publicKey };
}
```

**注意事项**：
- **私钥安全**：新生成的私钥必须由前端安全存储，后端不保存私钥
- 地址类型：0=盘古币，1=比特币，2=以太坊

---

### F05 & F06: 发送交易

**场景**：用户发起转账交易。

**调用流程**：
- **组内用户（F05）**：调用 `POST /api/v1/{groupID}/assign/submit-tx`（AssignNode 处理）
- **散户用户（F06）**：调用 `POST /api/v1/com/submit-noguargroup-tx`（ComNode 处理）

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 516-524（`newtx` 命令）
- 后端业务逻辑：`assignnode.go` 218-223（`ReceiveUserNewTX`）和 `comnode.go` 172-210（`ReceiveNewATX`）

**组内交易输入结构**：
```json
{
    "tx": {
        "tx_inputs_normal": [...],
        "tx_outputs": [
            { "to_address": "dest_addr...", "value": 100.0 }
        ],
        "interest_assign": {...}
    },
    "user_id": "12345678"
}
```

**散户交易输入结构**：
```json
{
    "aggr_tx_type": 2,
    "is_no_guar_group_tx": true,
    "tx_num": 1,
    "total_gas": 0.1,
    "tx_hash": "...",
    "all_transactions": [...]
}
```

**前端 JS 伪代码**：
```javascript
async function sendTransaction(fromAddresses, toAddress, amount) {
    // 1. 构造交易输入（选择 UTXO）
    const txInputs = selectUTXOs(fromAddresses, amount);
    
    // 2. 构造交易输出
    const txOutputs = [
        { to_address: toAddress, value: amount }
    ];
    
    // 3. 计算找零（如果有）
    const totalInput = txInputs.reduce((sum, u) => sum + u.value, 0);
    const change = totalInput - amount - GAS_FEE;
    if (change > 0) {
        txOutputs.push({ to_address: fromAddresses[0], value: change });
    }
    
    // 4. 构造交易并签名
    const tx = buildTransaction(txInputs, txOutputs);
    signTransaction(tx, getPrivateKeys(fromAddresses));
    
    // 5. 根据用户状态选择接口
    let endpoint, payload;
    
    if (currentGuarGroupId) {
        // 组内用户
        endpoint = `/api/v1/${currentGuarGroupId}/assign/submit-tx`;
        payload = { tx: tx, user_id: userId };
    } else {
        // 散户用户
        endpoint = '/api/v1/com/submit-noguargroup-tx';
        payload = buildAggregateGTX(tx);
        payload.is_no_guar_group_tx = true;
    }
    
    // 6. 发送交易
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success) {
        console.log('交易已提交:', result.tx_id || result.tx_hash);
        // 更新本地 UTXO 状态（标记为待确认）
        markUTXOsAsPending(txInputs);
    }
    
    return result;
}
```

---

### F07 & F08: 查询担保组织信息

**场景**：用户查询某个担保组织的详细信息。

**调用流程**：
- **未入组用户（F07）**：调用 `GET /api/v1/groups/{id}`（BootNode 处理）
- **已入组用户（F08）**：调用 `GET /api/v1/{groupID}/assign/group-info`（AssignNode 处理）

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 395-407（`findgroup` 命令）
- 前端处理逻辑参考：`wallet/handle.go` 92-103（case 4）
- 后端业务逻辑：`bootnodetrans.go` 176-200（`ReturnGroupInfoForGateway` - 已实现）

**输出结构**：
```json
{
    "group_id": "group001",
    "peer_group_id": "peer123...",
    "assi_peer_id": "assi456...",
    "aggr_peer_id": "aggr789...",
    "guar_table": {
        "guar1": "peerid1",
        "guar2": "peerid2"
    },
    "assi_public_key": {...},
    "aggr_public_key": {...},
    "assign_api_endpoint": ":8081",
    "aggr_api_endpoint": ":8082"
}
```

**前端 JS 伪代码**：
```javascript
async function findGuarGroup(groupId) {
    // 根据是否已入组选择不同接口
    const endpoint = currentGuarGroupId
        ? `/api/v1/${currentGuarGroupId}/assign/group-info`
        : `/api/v1/groups/${groupId}`;
    
    const response = await fetch(endpoint);
    
    if (!response.ok) {
        if (response.status === 404) {
            console.error('担保组织不存在');
            return null;
        }
        throw new Error('查询失败');
    }
    
    const groupInfo = await response.json();
    
    // 本地缓存
    saveOtherGroupInfo(groupId, groupInfo);
    
    // 可以获取该组织的 API 端点信息
    console.log('担保组织信息:', groupInfo);
    console.log('AssignNode API:', groupInfo.assign_api_endpoint);
    console.log('AggrNode API:', groupInfo.aggr_api_endpoint);
    
    return groupInfo;
}
```

---

### F09: 查询账户信息

**场景**：用户查询指定地址的余额、利息等信息。

**调用流程**：
1. 前端构造地址列表
2. 调用 `POST /api/v1/com/query-address`
3. 后端 ComNode 返回 `ReturnNodeAddressMsg`
4. 前端更新本地账户数据

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 585-587（`getwalletmsg` 命令）
- 前端处理逻辑参考：`wallet/handle.go` 124-137（case 20）
- 后端业务逻辑：`comnode.go` 950-986（`GetNodeAddressMsgRequest` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "address": ["addr1...", "addr2..."]
}
```

**输出结构**：
```json
{
    "from_group_id": "GuarCommittee",
    "address_data": {
        "addr1...": {
            "value": 1000.0,
            "interest": 5.5,
            "last_height": 100,
            "group_id": "group001",
            "type": 0
        }
    }
}
```

**前端 JS 伪代码**：
```javascript
async function queryAddressInfo(addresses) {
    const response = await fetch('/api/v1/com/query-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addresses })
    });
    
    const result = await response.json();
    
    // 更新本地数据
    for (const [addr, data] of Object.entries(result.address_data)) {
        updateLocalAddress(addr, {
            value: data.value,
            interest: data.interest,
            lastHeight: data.last_height,
            groupId: data.group_id,
            type: data.type
        });
    }
    
    return result;
}
```

---

### F10: 查询地址所属担保组织

**场景**：用户查询多个地址分别属于哪个担保组织。

**调用流程**：
1. 前端构造地址列表
2. 调用 `POST /api/v1/com/query-address-group`
3. 后端 ComNode 返回 `UserQueryAddressGuarGroupReply`
4. 前端处理返回结果

**Go 后端代码参考**：
- 前端发送逻辑参考：`wallet/handle.go` 601-625（`agroup` 命令）
- 前端处理逻辑参考：`wallet/handle.go` 179-190（case 25）
- 后端业务逻辑：`comnode.go` 1071-1121（`GetAddressGuarGroup` - ForGateway 版本应复用此逻辑）

**输入结构**：
```json
{
    "address": ["addr1...", "addr2..."]
}
```

**输出结构**：
```json
{
    "address_to_group": {
        "addr1...": {
            "group_id": "group001",
            "public_key": {...}
        },
        "addr2...": {
            "group_id": "1",
            "public_key": {...}
        }
    }
}
```

**返回值说明**：
- `group_id = "0"`：地址错误/不存在于链上
- `group_id = "1"`：地址存在但未加入任何担保组织
- 其他值：所属的担保组织 ID

**前端 JS 伪代码**：
```javascript
async function queryAddressGroups(addresses) {
    const response = await fetch('/api/v1/com/query-address-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addresses })
    });
    
    const result = await response.json();
    
    for (const [addr, info] of Object.entries(result.address_to_group)) {
        if (info.group_id === '0') {
            console.log(`地址 ${addr} 不存在于链上`);
        } else if (info.group_id === '1') {
            console.log(`地址 ${addr} 未加入担保组织`);
            saveAddressPublicKey(addr, info.public_key);
        } else {
            console.log(`地址 ${addr} 属于担保组织: ${info.group_id}`);
            saveAddressGroupInfo(addr, info.group_id, info.public_key);
        }
    }
    
    return result;
}
```

---

## 三、轮询接口说明

### 轮询策略

前端需要定期轮询以下接口获取后端主动推送的信息：

| 功能 | 接口 | 轮询间隔 | 数据结构 | 前端处理参考 |
| --- | --- | --- | --- | --- |
| F11 账户更新 | `GET /api/v1/{groupID}/assign/account-update?userID=...` | 3-5秒 | `AccountUpdateInfo[]` | `wallet/handle.go` 167-178 |
| F12 接收 TXCer | `GET /api/v1/aggr/txcer?address=...` | 3-5秒 | `TXCerToUser[]` | `wallet/handle.go` 138-154 |
| F13 TXCer 状态变动 | `GET /api/v1/{groupID}/assign/txcer-change?userID=...` | 3-5秒 | `TXCerChangeToUser[]` | `wallet/handle.go` 155-166 |
| F14 UTXO 变动通知 | `GET /api/v1/com/utxo-change?address=...` | 5-10秒 | `AddressUTXOChange[]` | `wallet/handle.go` 191-207 |

---

### F11: 轮询账户更新

**输出结构**：
```json
[
    {
        "user_id": "12345678",
        "wallet_change_data": {
            "in": { "addr1": [...] },
            "out": ["utxo1", "utxo2"]
        },
        "txcer_change_data": [...],
        "used_txcer_change_data": [...],
        "timestamp": 1702300000000,
        "block_height": 101,
        "is_no_wallet_change": false
    }
]
```

**字段说明**：
- `is_no_wallet_change = true`：仅区块高度更新，无账户变动
- `wallet_change_data.in`：新增的 UTXO（转入）
- `wallet_change_data.out`：已使用的 UTXO 标识符（转出确认）

---

### F12: 轮询接收 TXCer

**输出结构**：
```json
{
    "txcers": [
        {
            "to_address": "addr1...",
            "txcer": {
                "txcer_id": "txcer001",
                "value": 100.0,
                "to_address": "addr1...",
                "timestamp": 1702300000000
            }
        }
    ],
    "total": 1,
    "has_more": false,
    "next_since": 1702300000001
}
```

**过滤逻辑**：前端需根据 `to_address` 判断是否属于自己的地址。

---

### F13: 轮询 TXCer 状态变动

**输出结构**：
```json
[
    {
        "txcer_id": "txcer001",
        "status": 0,
        "utxo": "utxo_identifier"
    }
]
```

**状态说明**：
- `status = 0`：前置交易已上链，TXCer 可兑换为 UTXO
- `status = 1`：TXCer 验证失败

---

### F14: 轮询 UTXO 变动通知

**输出结构**：
```json
[
    {
        "address": "addr1...",
        "utxo": {
            "txid1": "txcer001"
        },
        "value": 100.0
    }
]
```

---

### 轮询实现示例

```javascript
class PollingManager {
    constructor(userId, addresses) {
        this.userId = userId;
        this.addresses = addresses;
        this.intervals = {};
        this.lastTimestamps = {};
    }
    
    start() {
        // 账户更新轮询
        this.intervals.accountUpdate = setInterval(
            () => this.pollAccountUpdate(),
            3000
        );
        
        // TXCer 轮询
        this.intervals.txcer = setInterval(
            () => this.pollTXCer(),
            3000
        );
        
        // TXCer 状态变动轮询
        this.intervals.txcerChange = setInterval(
            () => this.pollTXCerChange(),
            3000
        );
        
        // UTXO 变动轮询
        this.intervals.utxoChange = setInterval(
            () => this.pollUTXOChange(),
            5000
        );
    }
    
    stop() {
        Object.values(this.intervals).forEach(clearInterval);
    }
    
    async pollAccountUpdate() {
        try {
            const updates = await fetch(
                `/api/v1/${currentGuarGroupId}/assign/account-update?userID=${this.userId}`
            ).then(r => r.json());
            
            for (const update of updates) {
                if (!update.is_no_wallet_change) {
                    // 处理账户变动
                    this.handleWalletChange(update.wallet_change_data);
                    this.handleTXCerChange(update.txcer_change_data);
                }
                // 更新区块高度
                setBlockHeight(update.block_height);
            }
        } catch (error) {
            console.error('账户更新轮询失败:', error);
        }
    }
    
    async pollTXCer() {
        try {
            for (const address of this.addresses) {
                const since = this.lastTimestamps[`txcer_${address}`] || 0;
                const result = await fetch(
                    `/api/v1/aggr/txcer?address=${address}&since=${since}`
                ).then(r => r.json());
                
                for (const item of result.txcers) {
                    // 检查是否是发给自己的
                    if (this.addresses.includes(item.to_address)) {
                        // 去重检查
                        if (!hasTXCer(item.txcer.txcer_id)) {
                            saveTXCer(item.to_address, item.txcer);
                            console.log('收到新 TXCer:', item.txcer.txcer_id);
                        }
                    }
                }
                
                this.lastTimestamps[`txcer_${address}`] = result.next_since;
            }
        } catch (error) {
            console.error('TXCer 轮询失败:', error);
        }
    }
    
    async pollTXCerChange() {
        try {
            const changes = await fetch(
                `/api/v1/${currentGuarGroupId}/assign/txcer-change?userID=${this.userId}`
            ).then(r => r.json());
            
            for (const change of changes) {
                if (change.status === 0) {
                    // TXCer 可兑换
                    updateTXCerStatus(change.txcer_id, 'redeemable', change.utxo);
                } else {
                    // TXCer 验证失败
                    updateTXCerStatus(change.txcer_id, 'invalid');
                }
            }
        } catch (error) {
            console.error('TXCer 状态变动轮询失败:', error);
        }
    }
    
    async pollUTXOChange() {
        try {
            for (const address of this.addresses) {
                const changes = await fetch(
                    `/api/v1/com/utxo-change?address=${address}`
                ).then(r => r.json());
                
                for (const change of changes) {
                    if (change.address === address) {
                        console.log(`地址 ${address} 有 UTXO 变动，金额: ${change.value}`);
                        updateAddressUTXO(address, change.utxo, change.value);
                    }
                }
            }
        } catch (error) {
            console.error('UTXO 变动轮询失败:', error);
        }
    }
    
    handleWalletChange(data) {
        // 处理转入
        for (const [addr, utxos] of Object.entries(data.in || {})) {
            for (const utxo of utxos) {
                addUTXO(addr, utxo);
            }
        }
        // 处理转出确认
        for (const utxoId of data.out || []) {
            confirmUTXOSpent(utxoId);
        }
    }
    
    handleTXCerChange(changes) {
        for (const change of changes || []) {
            updateTXCerStatus(change.txcer_id, change.status === 0 ? 'confirmed' : 'invalid');
        }
    }
}

// 使用示例
const polling = new PollingManager(userId, myAddresses);
polling.start();

// 退出时停止轮询
window.addEventListener('beforeunload', () => polling.stop());
```

---

## 四、前端与后端接口对应关系

| 前端功能 | 后端节点 | 后端 ForGateway 方法 | HTTP 接口 |
| --- | --- | --- | --- |
| 用户登录 | BootNode(Gateway) | （BootNode 转发） | `POST /api/v1/re-online` |
| 加入/退出组织 | AssignNode(Gateway) | `ProcessUserFlowApplyForGateway` | `POST /api/v1/{groupID}/assign/flow-apply` |
| 新建子地址 | AssignNode(Gateway) | `ProcessUserNewAddressForGateway` | `POST /api/v1/{groupID}/assign/new-address` |
| 发送交易（组内） | AssignNode(Gateway) | `ReceiveUserNewTXForGateway` | `POST /api/v1/{groupID}/assign/submit-tx` |
| 发送交易（散户） | ComNode | `ReceiveNoGuarGroupTXForGateway` | `POST /api/v1/com/submit-noguargroup-tx` |
| 查询组织（未入组） | BootNode | `ReturnGroupInfoForGateway` | `GET /api/v1/groups/{id}` |
| 查询组织（已入组） | AssignNode(Gateway) | `GetGroupMsgForGateway` | `GET /api/v1/{groupID}/assign/group-info` |
| 查询账户信息 | ComNode | `GetNodeAddressMsgRequestForGateway` | `POST /api/v1/com/query-address` |
| 查询地址所属组织 | ComNode | `GetAddressGuarGroupForGateway` | `POST /api/v1/com/query-address-group` |
| 轮询账户更新 | AssignNode(Gateway) | - | `GET /api/v1/{groupID}/assign/account-update` |
| 轮询 TXCer | AggrNode | - | `GET /api/v1/aggr/txcer` |
| 轮询 TXCer 变动 | AssignNode(Gateway) | - | `GET /api/v1/{groupID}/assign/txcer-change` |
| 轮询 UTXO 变动 | ComNode | - | `GET /api/v1/com/utxo-change` |

---

## 五、前端实施建议

### 实施优先级

1. **第一阶段（核心功能）**
   - F01 用户登录
   - F07/F08 查询担保组织
   - F09 查询账户信息

2. **第二阶段（加入组织）**
   - F02 加入担保组织
   - F03 退出担保组织
   - F04 新建子地址

3. **第三阶段（交易功能）**
   - F05 发送交易（组内）
   - F06 发送交易（散户）

4. **第四阶段（轮询功能）**
   - F11 轮询账户更新
   - F12 轮询接收 TXCer
   - F13 轮询 TXCer 变动
   - F14 轮询 UTXO 变动

5. **第五阶段（辅助功能）**
   - F10 查询地址所属组织

### 安全注意事项

1. **私钥管理**：私钥必须在前端安全存储，不可传输到后端
2. **签名验证**：所有写入操作都需要用户签名
3. **时间戳**：部分操作有时间窗口限制（如加入组织 5 分钟有效期）
4. **去重处理**：轮询数据需要按唯一标识去重（如 TXCerID）

