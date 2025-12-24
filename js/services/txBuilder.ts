/**
 * Transaction Builder Service
 * 
 * 快速转账交易构造模块
 * 
 * ⚠️ 重要：本实现严格遵循后端文档
 * 参考文档：docs/Gateway/用户快速转账交易构造指南.md
 * 
 * 签名规则：
 * 1. TXInputNormal.InputSignature：使用【地址私钥】对 TXOutput 哈希签名
 * 2. UserNewTX.Sig：使用【账户私钥】对整个 UserNewTX 签名（排除 Sig, Height）
 * 
 * @module services/txBuilder
 */

import { sha256 } from 'js-sha256';
import { ec as EC } from 'elliptic';
import { User, AddressData } from '../utils/storage';
import { UTXOData } from '../types/blockchain';

// 初始化 P-256 曲线
const ec = new EC('p256');

// ============================================================================
// 类型定义（严格匹配后端 Go 结构体）
// ============================================================================

/**
 * ECDSA 签名（内部使用 bigint）
 */
export interface EcdsaSignature {
  R: bigint;
  S: bigint;
}

/**
 * 用于 JSON 序列化的签名格式
 * 
 * ⚠️ 重要：Go 的 *big.Int 序列化为 JSON number（不带引号）
 * 但 JavaScript 的 Number 无法精确表示 256 位整数
 * 解决方案：内部用字符串存储，序列化时去掉引号
 */
export interface EcdsaSignatureJSON {
  R: string | null;  // 十进制字符串，序列化时去引号
  S: string | null;  // 十进制字符串，序列化时去引号
}

/**
 * P-256 公钥
 */
export interface PublicKeyNew {
  CurveName: string;  // 固定为 "P256"
  X: bigint;
  Y: bigint;
}


/**
 * 用于 JSON 序列化的公钥格式
 * 
 * ⚠️ 重要：Go 的 *big.Int 序列化为 JSON number（不带引号）
 * 但 JavaScript 的 Number 无法精确表示 256 位整数
 * 解决方案：内部用字符串存储，序列化时去掉引号
 */
export interface PublicKeyNewJSON {
  CurveName: string;
  X: string;  // 十进制字符串，序列化时去引号
  Y: string;  // 十进制字符串，序列化时去引号
}

/**
 * 交易位置
 */
export interface TxPosition {
  Blocknum: number;
  IndexX: number;
  IndexY: number;
  IndexZ: number;
}

/**
 * 交易输出
 */
export interface TXOutput {
  ToAddress: string;
  ToValue: number;
  ToGuarGroupID: string;
  ToPublicKey: PublicKeyNewJSON;
  ToInterest: number;
  Type: number;              // 货币类型：0=PGC, 1=BTC, 2=ETH
  ToPeerID: string;
  IsPayForGas: boolean;
  IsGuarMake: boolean;
  IsCrossChain: boolean;
}

/**
 * UTXO 输入
 */
export interface TXInputNormal {
  FromTXID: string;
  FromTxPosition: TxPosition;
  FromAddress: string;
  IsGuarMake: boolean;
  IsCommitteeMake: boolean;
  IsCrossChain: boolean;
  TXOutputHash: number[];           // 被引用 TXOutput 的 SHA256 哈希（字节数组）
  InputSignature: EcdsaSignatureJSON;  // 地址私钥签名
}

/**
 * 手续费分配
 */
export interface InterestAssign {
  Gas: number;
  Output: number;
  BackAssign: Record<string, number>;  // address -> 比例（和为1）
}

/**
 * 交易本体
 */
export interface Transaction {
  TXID: string;
  Size: number;
  Version: number;
  GuarantorGroup: string;
  TXType: number;                      // 0=普通转账
  Value: number;
  ValueDivision: Record<number, number>;
  NewValue: number;
  NewValueDiv: Record<number, number>;
  InterestAssign: InterestAssign;
  UserSignature: EcdsaSignatureJSON;
  TXInputsNormal: TXInputNormal[];
  TXInputsCertificate: any[];          // 快速转账填空数组
  TXOutputs: TXOutput[];
  Data: number[];
}


/**
 * 用户新交易（提交给后端的顶层结构）
 */
export interface UserNewTX {
  TX: Transaction;
  UserID: string;
  Height: number;
  Sig: EcdsaSignatureJSON;
}

/**
 * 构建交易参数
 */
export interface BuildTransactionParams {
  /** 发送方地址列表 */
  fromAddresses: string[];
  /** 收款方信息 */
  recipients: Array<{
    address: string;
    amount: number;
    coinType: number;           // 0=PGC, 1=BTC, 2=ETH
    publicKeyX: string;         // hex 格式
    publicKeyY: string;         // hex 格式
    guarGroupID: string;
    interest?: number;          // 分配的利息
  }>;
  /** 找零地址（按币种） */
  changeAddresses: Record<number, string>;
  /** Gas 费 */
  gas: number;
  /** 是否跨链交易 */
  isCrossChain?: boolean;
}

// ============================================================================
// 序列化工具函数
// ============================================================================

/**
 * bigint 替换器（用于 JSON.stringify）
 * 将 bigint 转为十进制字符串
 */
function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString(10);
  }
  return value;
}

/**
 * 将对象序列化为 JSON 字符串
 * 
 * ⚠️ 重要规则：
 * 1. 不要全局排序 key，只对 map 字段排序
 * 2. X/Y/R/S 必须是 JSON number（不带引号）
 * 
 * @param obj 要序列化的对象
 * @param sortMapFields 需要排序的 map 字段名
 */
function serializeToJSON(obj: unknown, sortMapFields: string[] = []): string {
  // 深拷贝并转换 bigint
  const copy = JSON.parse(JSON.stringify(obj, bigintReplacer));
  
  // 只对指定的 map 字段做 key 排序
  for (const field of sortMapFields) {
    if (copy[field] && typeof copy[field] === 'object' && !Array.isArray(copy[field])) {
      const mapValue = copy[field] as Record<string, unknown>;
      const sortedKeys = Object.keys(mapValue).sort();
      const sorted: Record<string, unknown> = {};
      for (const k of sortedKeys) {
        sorted[k] = mapValue[k];
      }
      copy[field] = sorted;
    }
  }
  
  // JSON 序列化
  let json = JSON.stringify(copy);
  
  // 把 X/Y/R/S 字段的引号去掉，变成 JSON number
  json = json.replace(/"(X|Y|R|S)":"(\d+)"/g, '"$1":$2');
  
  return json;
}


/**
 * 将排除字段设置为零值
 * 
 * @param obj 要处理的对象
 * @param excludeFields 要排除的字段名数组
 */
function applyExcludeZeroValue(obj: Record<string, unknown>, excludeFields: string[]): void {
  for (const field of excludeFields) {
    if (!(field in obj)) continue;
    
    if (field === 'Sig' || field === 'UserSignature' || field === 'InputSignature') {
      // 签名字段的零值是 {R: null, S: null}
      obj[field] = { R: null, S: null };
    } else if (field === 'Height' || field === 'Size' || field === 'NewValue' || field === 'TXType') {
      // 数字字段的零值是 0
      obj[field] = 0;
    } else if (field === 'TXID') {
      // 字符串字段的零值是空字符串
      obj[field] = '';
    } else if (field === 'NewValueDiv') {
      // map 字段的零值是空对象
      obj[field] = {};
    }
  }
}

// ============================================================================
// 哈希计算函数
// ============================================================================

/**
 * 计算 TXOutput 的 SHA256 哈希
 * 
 * 后端实现：对 TXOutput 整个结构体 JSON 序列化后求 SHA256
 * ⚠️ 注意：序列化时不排除任何字段
 * 
 * @param output TXOutput 对象
 * @returns 32字节哈希值（数字数组）
 */
export function getTXOutputHash(output: TXOutput): number[] {
  // JSON 序列化（不排除任何字段，不排序）
  const jsonStr = serializeToJSON(output);
  
  // SHA256 哈希
  const hashBytes = sha256.array(jsonStr);
  
  return hashBytes;
}

/**
 * 计算交易哈希（用于生成 TXID）
 * 
 * 后端实现逻辑：
 * 1. 过滤掉 IsGuarMake=true 的 Input 和 Output
 * 2. 序列化时排除字段：Size, NewValue, UserSignature, TXType
 * 3. SHA256 哈希
 * 
 * @param tx Transaction 对象
 * @returns 32字节哈希值
 */
export function getTXHash(tx: Transaction): number[] {
  // 1. 过滤掉担保组织构造的 Input 和 Output
  const filteredInputs = tx.TXInputsNormal.filter(input => !input.IsGuarMake);
  const filteredOutputs = tx.TXOutputs.filter(output => !output.IsGuarMake);
  
  // 2. 创建临时交易对象
  const txForHash = {
    ...tx,
    TXInputsNormal: filteredInputs,
    TXOutputs: filteredOutputs
  };
  
  // 3. 深拷贝并设置排除字段为零值
  const copy = JSON.parse(JSON.stringify(txForHash, bigintReplacer));
  applyExcludeZeroValue(copy, ['Size', 'NewValue', 'UserSignature', 'TXType']);
  
  // 4. 序列化（对 ValueDivision, NewValueDiv, BackAssign 排序）
  const jsonStr = serializeToJSON(copy, ['ValueDivision', 'NewValueDiv', 'BackAssign']);
  
  // 5. SHA256 哈希
  return sha256.array(jsonStr);
}


/**
 * 计算 TXID
 * 
 * 后端实现：取交易哈希的前8字节，转为16进制字符串
 * 结果：16个字符的十六进制字符串
 * 
 * @param tx Transaction 对象
 * @returns TXID（16字符 hex）
 */
export function calculateTXID(tx: Transaction): string {
  const hash = getTXHash(tx);
  
  // 取前8字节，转为十六进制
  let txid = '';
  for (let i = 0; i < 8; i++) {
    txid += hash[i].toString(16).padStart(2, '0');
  }
  
  return txid;
}

// ============================================================================
// 签名函数
// ============================================================================

/**
 * 对 TXOutput 签名（用于 TXInputNormal.InputSignature）
 * 
 * 流程：
 * 1. 计算 TXOutput 的 SHA256 哈希
 * 2. 使用地址私钥对哈希签名
 * 
 * @param output 被引用的 TXOutput
 * @param addressPrivateKeyHex 地址私钥（hex 格式）
 * @returns { hash: number[], signature: EcdsaSignature }
 */
export function signTXOutput(
  output: TXOutput,
  addressPrivateKeyHex: string
): { hash: number[]; signature: EcdsaSignature } {
  // 1. 计算 TXOutput 哈希
  const hash = getTXOutputHash(output);
  
  // 2. 使用地址私钥签名
  const key = ec.keyFromPrivate(addressPrivateKeyHex, 'hex');
  const sig = key.sign(hash);
  
  return {
    hash,
    signature: {
      R: BigInt('0x' + sig.r.toString(16)),
      S: BigInt('0x' + sig.s.toString(16))
    }
  };
}

/**
 * 对 UserNewTX 签名
 * 
 * 后端验证逻辑：
 * 1. 使用用户账户公钥验证
 * 2. 排除字段：Sig, Height
 * 
 * @param userNewTX UserNewTX 对象
 * @param accountPrivateKeyHex 账户私钥（hex 格式）
 * @returns EcdsaSignature
 */
export function signUserNewTX(
  userNewTX: UserNewTX,
  accountPrivateKeyHex: string
): EcdsaSignature {
  // 1. 深拷贝
  const copy = JSON.parse(JSON.stringify(userNewTX, bigintReplacer));
  
  // 2. 将排除字段设为零值
  applyExcludeZeroValue(copy, ['Sig', 'Height']);
  
  // 3. 递归处理嵌套的 TX 对象中的 map 字段
  if (copy.TX) {
    // 对 TX 内部的 map 字段排序
    const mapFields = ['ValueDivision', 'NewValueDiv', 'BackAssign'];
    for (const field of mapFields) {
      if (copy.TX[field] && typeof copy.TX[field] === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(copy.TX[field]).sort()) {
          sorted[k] = copy.TX[field][k];
        }
        copy.TX[field] = sorted;
      }
    }
    // InterestAssign.BackAssign
    if (copy.TX.InterestAssign?.BackAssign) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(copy.TX.InterestAssign.BackAssign).sort()) {
        sorted[k] = copy.TX.InterestAssign.BackAssign[k];
      }
      copy.TX.InterestAssign.BackAssign = sorted;
    }
  }
  
  // 4. JSON 序列化
  let jsonStr = JSON.stringify(copy);
  jsonStr = jsonStr.replace(/"(X|Y|R|S)":"(\d+)"/g, '"$1":$2');
  
  // 5. SHA256 哈希
  const hashBytes = sha256.array(jsonStr);
  
  // 6. 使用账户私钥签名
  const key = ec.keyFromPrivate(accountPrivateKeyHex, 'hex');
  const sig = key.sign(hashBytes);
  
  return {
    R: BigInt('0x' + sig.r.toString(16)),
    S: BigInt('0x' + sig.s.toString(16))
  };
}


// ============================================================================
// 公钥工具函数
// ============================================================================

/**
 * 从私钥获取公钥
 * 
 * @param privateKeyHex 私钥（hex 格式）
 * @returns PublicKeyNew
 */
export function getPublicKeyFromPrivate(privateKeyHex: string): PublicKeyNew {
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  const pubPoint = key.getPublic();
  return {
    CurveName: 'P256',
    X: BigInt('0x' + pubPoint.getX().toString(16)),
    Y: BigInt('0x' + pubPoint.getY().toString(16))
  };
}

/**
 * 将 PublicKeyNew 转换为 JSON 格式
 * 
 * @param pubKey PublicKeyNew
 * @returns PublicKeyNewJSON
 */
export function publicKeyToJSON(pubKey: PublicKeyNew): PublicKeyNewJSON {
  return {
    CurveName: pubKey.CurveName,
    X: pubKey.X.toString(10),  // 转为十进制字符串
    Y: pubKey.Y.toString(10)   // 转为十进制字符串
  };
}

/**
 * 将 hex 格式公钥转换为 JSON 格式
 * 
 * @param pubXHex 公钥 X 坐标（hex 格式）
 * @param pubYHex 公钥 Y 坐标（hex 格式）
 * @returns PublicKeyNewJSON
 */
export function hexToPublicKeyJSON(pubXHex: string, pubYHex: string): PublicKeyNewJSON {
  const x = BigInt('0x' + pubXHex.replace(/^0x/i, ''));
  const y = BigInt('0x' + pubYHex.replace(/^0x/i, ''));
  return {
    CurveName: 'P256',
    X: x.toString(10),  // 转为十进制字符串
    Y: y.toString(10)   // 转为十进制字符串
  };
}

/**
 * 将 EcdsaSignature 转换为 JSON 格式
 * 
 * @param sig EcdsaSignature
 * @returns EcdsaSignatureJSON
 */
export function signatureToJSON(sig: EcdsaSignature): EcdsaSignatureJSON {
  return {
    R: sig.R.toString(10),  // 转为十进制字符串
    S: sig.S.toString(10)   // 转为十进制字符串
  };
}

// ============================================================================
// UTXO 选择
// ============================================================================

/**
 * 选择 UTXO 以满足转账需求
 * 
 * @param addresses 可用地址列表
 * @param walletData 钱包数据
 * @param requiredAmounts 各币种需要的金额
 * @returns 选中的 UTXO 列表
 */
function selectUTXOs(
  addresses: string[],
  walletData: Record<string, AddressData>,
  requiredAmounts: Record<number, number>
): Array<{
  address: string;
  utxoKey: string;
  utxoData: UTXOData;
  coinType: number;
}> {
  const selected: Array<{
    address: string;
    utxoKey: string;
    utxoData: UTXOData;
    coinType: number;
  }> = [];
  
  // 按币种统计已收集金额
  const collected: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  
  console.log('[UTXO选择] 可用地址:', addresses);
  console.log('[UTXO选择] 需要金额:', requiredAmounts);
  console.log('[UTXO选择] 钱包数据地址列表:', Object.keys(walletData));
  
  for (const address of addresses) {
    const addrData = walletData[address];
    if (!addrData) {
      console.warn('[UTXO选择] 地址不存在于钱包数据中:', address.slice(0, 16) + '...');
      continue;
    }
    
    const coinType = addrData.type || 0;
    const utxos = addrData.utxos || {};
    const utxoKeys = Object.keys(utxos);
    
    console.log(`[UTXO选择] 地址 ${address.slice(0, 16)}...`);
    console.log(`  - 币种: ${coinType}`);
    console.log(`  - UTXO 数量: ${utxoKeys.length}`);
    console.log(`  - 有私钥: ${!!addrData.privHex}`);
    
    // 检查该币种是否还需要更多
    const needed = requiredAmounts[coinType] || 0;
    if (collected[coinType] >= needed) {
      console.log(`  - 币种 ${coinType} 已满足需求，跳过`);
      continue;
    }
    
    // 遍历该地址的 UTXO
    for (const [utxoKey, utxoData] of Object.entries(utxos)) {
      if (!utxoData) {
        console.log(`  - UTXO ${utxoKey}: 数据为空`);
        continue;
      }
      
      if (utxoData.Value <= 0) {
        console.log(`  - UTXO ${utxoKey}: 金额为0或负数 (${utxoData.Value})`);
        continue;
      }
      
      // 检查 UTXO 数据完整性
      const hasUTXO = !!utxoData.UTXO;
      const hasTXOutputs = !!(utxoData.UTXO?.TXOutputs?.length);
      
      console.log(`  - UTXO ${utxoKey.slice(0, 16)}...:`);
      console.log(`    - 金额: ${utxoData.Value}`);
      console.log(`    - 有 UTXO 字段: ${hasUTXO}`);
      console.log(`    - 有 TXOutputs: ${hasTXOutputs}`);
      console.log(`    - Position: ${JSON.stringify(utxoData.Position)}`);
      
      if (!hasUTXO || !hasTXOutputs) {
        console.warn(`  - UTXO ${utxoKey.slice(0, 16)}... 数据不完整，跳过`);
        continue;
      }
      
      console.log(`  - 选中 UTXO: ${utxoKey.slice(0, 16)}... 金额=${utxoData.Value}`);
      
      selected.push({
        address,
        utxoKey,
        utxoData,
        coinType
      });
      
      collected[coinType] += utxoData.Value;
      
      // 检查是否已满足需求
      if (collected[coinType] >= needed) break;
    }
  }
  
  console.log('[UTXO选择] 最终收集:', collected);
  console.log('[UTXO选择] 选中 UTXO 数量:', selected.length);
  
  // 验证是否满足所有需求
  for (const [coinTypeStr, needed] of Object.entries(requiredAmounts)) {
    const coinType = Number(coinTypeStr);
    if (needed > 0 && collected[coinType] < needed) {
      const errMsg = `余额不足：需要 ${needed} 类型${coinType}，只有 ${collected[coinType]}`;
      console.error('[UTXO选择]', errMsg);
      throw new Error(errMsg);
    }
  }
  
  return selected;
}


// ============================================================================
// 主构造函数
// ============================================================================

/**
 * 构建快速转账交易
 * 
 * 完整流程：
 * 1. 选择 UTXO
 * 2. 构造 TXInputNormal（包含 InputSignature）
 * 3. 构造 TXOutput
 * 4. 构造 Transaction
 * 5. 计算 TXID
 * 6. 构造 UserNewTX 并签名
 * 
 * @param params 构建参数
 * @param user 用户数据
 * @returns UserNewTX
 */
export async function buildTransaction(
  params: BuildTransactionParams,
  user: User
): Promise<UserNewTX> {
  console.log('[交易构造] 开始构建交易...');
  console.log('[交易构造] 参数:', JSON.stringify(params, null, 2));
  
  const {
    fromAddresses,
    recipients,
    changeAddresses,
    gas,
    isCrossChain = false
  } = params;
  
  // 获取钱包数据
  const walletData = user.wallet?.addressMsg || {};
  const guarGroupID = user.orgNumber || user.guarGroup?.groupID || '';
  const userID = user.accountId || '';
  
  console.log('[交易构造] 用户ID:', userID);
  console.log('[交易构造] 担保组织ID:', guarGroupID);
  console.log('[交易构造] 钱包地址数量:', Object.keys(walletData).length);
  console.log('[交易构造] 发送地址:', fromAddresses);
  
  if (!guarGroupID) {
    throw new Error('用户未加入担保组织');
  }
  
  if (!userID) {
    throw new Error('用户 ID 不存在');
  }
  
  // 获取账户私钥
  const accountPrivKey = user.keys?.privHex || user.privHex || '';
  if (!accountPrivKey) {
    throw new Error('账户私钥不存在');
  }
  console.log('[交易构造] 账户私钥存在:', !!accountPrivKey);
  
  // ========== Step 1: 计算各币种需要的金额 ==========
  const requiredAmounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const recipient of recipients) {
    requiredAmounts[recipient.coinType] = (requiredAmounts[recipient.coinType] || 0) + recipient.amount;
  }
  console.log('[交易构造] 需要金额:', requiredAmounts);
  
  // ========== Step 2: 选择 UTXO ==========
  console.log('[交易构造] 开始选择 UTXO...');
  const selectedUTXOs = selectUTXOs(fromAddresses, walletData, requiredAmounts);
  console.log('[交易构造] 选中 UTXO 数量:', selectedUTXOs.length);
  
  // 计算各币种收集的总额
  const collectedAmounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const { utxoData, coinType } of selectedUTXOs) {
    collectedAmounts[coinType] += utxoData.Value;
  }
  console.log('[交易构造] 收集金额:', collectedAmounts);
  
  // ========== Step 3: 构造 TXOutput ==========
  const txOutputs: TXOutput[] = [];
  
  // 3.1 收款输出
  for (const recipient of recipients) {
    txOutputs.push({
      ToAddress: recipient.address,
      ToValue: recipient.amount,
      ToGuarGroupID: recipient.guarGroupID,
      ToPublicKey: hexToPublicKeyJSON(recipient.publicKeyX, recipient.publicKeyY),
      ToInterest: recipient.interest || 0,
      Type: recipient.coinType,
      ToPeerID: '',
      IsPayForGas: false,
      IsGuarMake: false,
      IsCrossChain: isCrossChain
    });
  }
  
  // 3.2 找零输出
  for (const [coinTypeStr, collected] of Object.entries(collectedAmounts)) {
    const coinType = Number(coinTypeStr);
    const required = requiredAmounts[coinType] || 0;
    const change = collected - required;
    
    if (change > 0.00000001) {  // 有找零
      const changeAddr = changeAddresses[coinType];
      if (!changeAddr) {
        throw new Error(`缺少币种 ${coinType} 的找零地址`);
      }
      
      const changeAddrData = walletData[changeAddr];
      if (!changeAddrData) {
        throw new Error(`找零地址 ${changeAddr} 不存在`);
      }
      
      // 获取找零地址的公钥
      const changePubX = changeAddrData.pubXHex || '';
      const changePubY = changeAddrData.pubYHex || '';
      if (!changePubX || !changePubY) {
        throw new Error(`找零地址 ${changeAddr} 缺少公钥`);
      }
      
      txOutputs.push({
        ToAddress: changeAddr,
        ToValue: change,
        ToGuarGroupID: guarGroupID,
        ToPublicKey: hexToPublicKeyJSON(changePubX, changePubY),
        ToInterest: 0,
        Type: coinType,
        ToPeerID: '',
        IsPayForGas: false,
        IsGuarMake: false,
        IsCrossChain: false
      });
    }
  }

  
  // ========== Step 4: 构造 TXInputNormal ==========
  console.log('[交易构造] 开始构造 TXInputNormal...');
  const txInputs: TXInputNormal[] = [];
  
  for (const { address, utxoData } of selectedUTXOs) {
    console.log(`[交易构造] 处理地址 ${address.slice(0, 8)}... 的 UTXO`);
    
    // 获取地址私钥
    const addrData = walletData[address];
    const addrPrivKey = addrData?.privHex || '';
    if (!addrPrivKey) {
      const errMsg = `地址 ${address.slice(0, 16)}... 缺少私钥`;
      console.error('[交易构造]', errMsg);
      throw new Error(errMsg);
    }
    console.log('[交易构造] 地址私钥存在:', !!addrPrivKey);
    
    // 获取被引用的 TXOutput
    const position = utxoData.Position;
    const indexZ = position?.IndexZ || 0;
    console.log('[交易构造] UTXO Position:', JSON.stringify(position));
    console.log('[交易构造] UTXO.UTXO 存在:', !!utxoData.UTXO);
    console.log('[交易构造] UTXO.UTXO.TXOutputs 存在:', !!(utxoData.UTXO?.TXOutputs));
    console.log('[交易构造] UTXO.UTXO.TXOutputs 长度:', utxoData.UTXO?.TXOutputs?.length || 0);
    
    // 检查 UTXO 数据完整性
    if (!utxoData.UTXO) {
      const errMsg = `UTXO 数据不完整：缺少 UTXO 字段（来源交易信息）。这可能是因为钱包数据未从后端同步完整。`;
      console.error('[交易构造]', errMsg);
      console.error('[交易构造] UTXO 数据:', JSON.stringify(utxoData, null, 2));
      throw new Error(errMsg);
    }
    
    if (!utxoData.UTXO.TXOutputs || utxoData.UTXO.TXOutputs.length === 0) {
      const errMsg = `UTXO 数据不完整：缺少 TXOutputs 数组。TXID=${utxoData.UTXO.TXID || '未知'}`;
      console.error('[交易构造]', errMsg);
      console.error('[交易构造] UTXO.UTXO:', JSON.stringify(utxoData.UTXO, null, 2));
      throw new Error(errMsg);
    }
    
    const referencedOutput = utxoData.UTXO.TXOutputs[indexZ];
    
    if (!referencedOutput) {
      const errMsg = `无法获取 UTXO 的原始输出数据：IndexZ=${indexZ} 超出 TXOutputs 范围（长度=${utxoData.UTXO.TXOutputs.length}）`;
      console.error('[交易构造]', errMsg);
      throw new Error(errMsg);
    }
    console.log('[交易构造] 被引用的 TXOutput:', JSON.stringify(referencedOutput, null, 2));
    
    // 构造 TXOutput 用于哈希计算
    // 处理公钥格式转换
    const refPubKey = referencedOutput.ToPublicKey;
    let toPublicKey: PublicKeyNewJSON;
    if (refPubKey && typeof refPubKey === 'object') {
      // 将公钥坐标转为十进制字符串
      const xVal = (refPubKey as any).X;
      const yVal = (refPubKey as any).Y;
      toPublicKey = {
        CurveName: (refPubKey as any).CurveName || 'P256',
        X: typeof xVal === 'bigint' ? xVal.toString(10) : String(xVal || '0'),
        Y: typeof yVal === 'bigint' ? yVal.toString(10) : String(yVal || '0')
      };
    } else {
      toPublicKey = { CurveName: 'P256', X: '0', Y: '0' };
    }
    
    const outputForHash: TXOutput = {
      ToAddress: referencedOutput.ToAddress || '',
      ToValue: referencedOutput.ToValue || 0,
      ToGuarGroupID: referencedOutput.ToGuarGroupID || '',
      ToPublicKey: toPublicKey,
      ToInterest: referencedOutput.ToInterest || 0,
      Type: referencedOutput.Type ?? referencedOutput.ToCoinType ?? 0,
      ToPeerID: referencedOutput.ToPeerID || '',
      IsPayForGas: referencedOutput.IsPayForGas || false,
      IsGuarMake: referencedOutput.IsGuarMake || false,
      IsCrossChain: referencedOutput.IsCrossChain || false
    };
    console.log('[交易构造] 用于哈希的 TXOutput:', outputForHash);
    
    // 计算 TXOutput 哈希并签名
    const { hash, signature } = signTXOutput(outputForHash, addrPrivKey);
    console.log('[交易构造] TXOutput 哈希长度:', hash.length);
    console.log('[交易构造] InputSignature R:', signature.R.toString().slice(0, 20) + '...');
    
    txInputs.push({
      FromTXID: utxoData.UTXO?.TXID || utxoData.TXID || '',
      FromTxPosition: {
        Blocknum: position?.Blocknum || 0,
        IndexX: position?.IndexX || 0,
        IndexY: position?.IndexY || 0,
        IndexZ: indexZ
      },
      FromAddress: address,
      IsGuarMake: false,
      IsCommitteeMake: false,
      IsCrossChain: isCrossChain,
      TXOutputHash: hash,
      InputSignature: signatureToJSON(signature)
    });
  }
  
  // ========== Step 5: 构造 Transaction ==========
  // 计算总转账金额（按汇率换算）
  const exchangeRates: Record<number, number> = { 0: 1, 1: 1000000, 2: 1000 };
  let totalValue = 0;
  for (const [coinTypeStr, amount] of Object.entries(requiredAmounts)) {
    const coinType = Number(coinTypeStr);
    totalValue += amount * (exchangeRates[coinType] || 1);
  }
  
  // 构造利息回退分配
  const backAssign: Record<string, number> = {};
  if (fromAddresses.length > 0) {
    backAssign[fromAddresses[0]] = 1.0;  // 利息回退给第一个发送地址
  }
  
  const transaction: Transaction = {
    TXID: '',  // Step 6 计算
    Size: 0,   // 后端会重新计算
    Version: 1.0,
    GuarantorGroup: guarGroupID,
    TXType: 0,  // 普通转账
    Value: totalValue,
    ValueDivision: requiredAmounts,
    NewValue: 0,
    NewValueDiv: {},
    InterestAssign: {
      Gas: gas,
      Output: recipients.reduce((sum, r) => sum + (r.interest || 0), 0),
      BackAssign: backAssign
    },
    UserSignature: { R: null, S: null },  // 可选，高安全场景使用
    TXInputsNormal: txInputs,
    TXInputsCertificate: [],
    TXOutputs: txOutputs,
    Data: []
  };
  
  // ========== Step 6: 计算 TXID ==========
  transaction.TXID = calculateTXID(transaction);
  console.log('[交易构造] TXID:', transaction.TXID);

  
  // ========== Step 7: 构造 UserNewTX 并签名 ==========
  const userNewTX: UserNewTX = {
    TX: transaction,
    UserID: userID,
    Height: 0,  // 前端填 0，后端会覆盖
    Sig: { R: null, S: null }  // 先置零值
  };
  
  // 使用账户私钥签名（排除 Sig 和 Height）
  const sig = signUserNewTX(userNewTX, accountPrivKey);
  userNewTX.Sig = signatureToJSON(sig);
  console.log('[交易构造] UserNewTX 签名完成');
  
  return userNewTX;
}

// ============================================================================
// 序列化为后端格式
// ============================================================================

/**
 * 将 UserNewTX 序列化为后端可接受的 JSON 格式
 * 
 * ⚠️ 重要：X/Y/R/S 必须是 JSON number（不带引号）
 * 
 * @param userNewTX UserNewTX 对象
 * @returns JSON 字符串
 */
export function serializeUserNewTX(userNewTX: UserNewTX): string {
  // 深拷贝
  const copy = JSON.parse(JSON.stringify(userNewTX, bigintReplacer));
  
  // 对 map 字段排序
  if (copy.TX) {
    const mapFields = ['ValueDivision', 'NewValueDiv'];
    for (const field of mapFields) {
      if (copy.TX[field] && typeof copy.TX[field] === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(copy.TX[field]).sort()) {
          sorted[k] = copy.TX[field][k];
        }
        copy.TX[field] = sorted;
      }
    }
    // InterestAssign.BackAssign
    if (copy.TX.InterestAssign?.BackAssign) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(copy.TX.InterestAssign.BackAssign).sort()) {
        sorted[k] = copy.TX.InterestAssign.BackAssign[k];
      }
      copy.TX.InterestAssign.BackAssign = sorted;
    }
  }
  
  // JSON 序列化
  let json = JSON.stringify(copy);
  
  // 把 X/Y/R/S 字段的引号去掉
  json = json.replace(/"(X|Y|R|S)":"(\d+)"/g, '"$1":$2');
  
  return json;
}

// ============================================================================
// 提交交易
// ============================================================================

/**
 * 提交交易到后端
 * 
 * @param userNewTX UserNewTX 对象
 * @param groupID 担保组织 ID
 * @returns 后端响应
 */
export async function submitTransaction(
  userNewTX: UserNewTX,
  groupID: string
): Promise<{ success: boolean; tx_id?: string; error?: string }> {
  const { API_BASE_URL, API_ENDPOINTS } = await import('../config/api');
  
  const url = API_BASE_URL + API_ENDPOINTS.ASSIGN_SUBMIT_TX(groupID);
  const body = serializeUserNewTX(userNewTX);
  
  console.log('[交易提交] URL:', url);
  console.log('[交易提交] Body:', body);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('[交易提交] 成功，TXID:', result.tx_id);
  } else {
    console.error('[交易提交] 失败:', result.error);
  }
  
  return result;
}


// ============================================================================
// 适配函数：从旧格式转换
// ============================================================================

/**
 * 旧版 BuildTXInfo 格式（兼容现有代码）
 */
export interface LegacyBuildTXInfo {
  Value?: number;
  ValueDivision: Record<number, number>;
  Bill: Record<string, {
    MoneyType: number;
    Value: number;
    GuarGroupID?: string;
    PublicKey?: { XHex: string; YHex: string };
    ToInterest?: number;
  }>;
  UserAddress: string[];
  PriUseTXCer: boolean;
  ChangeAddress: Record<number, string>;
  IsPledgeTX: boolean;
  HowMuchPayForGas: number;
  IsCrossChainTX: boolean;
  Data?: string | Uint8Array;
  InterestAssign: {
    Gas: number;
    Output: number;
    BackAssign: Record<string, number>;
  };
}

/**
 * 从旧版 BuildTXInfo 格式转换为新版 BuildTransactionParams
 * 
 * @param buildInfo 旧版构建信息
 * @returns 新版构建参数
 */
export function convertLegacyBuildInfo(buildInfo: LegacyBuildTXInfo): BuildTransactionParams {
  const recipients: BuildTransactionParams['recipients'] = [];
  
  for (const [address, bill] of Object.entries(buildInfo.Bill)) {
    recipients.push({
      address,
      amount: bill.Value,
      coinType: bill.MoneyType,
      publicKeyX: bill.PublicKey?.XHex || '',
      publicKeyY: bill.PublicKey?.YHex || '',
      guarGroupID: bill.GuarGroupID || '',
      interest: bill.ToInterest || 0
    });
  }
  
  return {
    fromAddresses: buildInfo.UserAddress,
    recipients,
    changeAddresses: buildInfo.ChangeAddress,
    gas: buildInfo.InterestAssign.Gas,
    isCrossChain: buildInfo.IsCrossChainTX
  };
}

/**
 * 使用旧版 BuildTXInfo 格式构建交易
 * 
 * 这是一个兼容函数，允许现有代码无缝迁移到新的交易构造器
 * 
 * @param buildInfo 旧版构建信息
 * @param user 用户数据
 * @returns UserNewTX
 */
export async function buildTransactionFromLegacy(
  buildInfo: LegacyBuildTXInfo,
  user: User
): Promise<UserNewTX> {
  console.log('[buildTransactionFromLegacy] 开始转换...');
  console.log('[buildTransactionFromLegacy] buildInfo:', JSON.stringify(buildInfo, null, 2));
  
  const params = convertLegacyBuildInfo(buildInfo);
  console.log('[buildTransactionFromLegacy] 转换后的 params:', JSON.stringify(params, null, 2));
  
  return buildTransaction(params, user);
}
