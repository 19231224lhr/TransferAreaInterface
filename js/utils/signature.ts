/**
 * ECDSA P-256 签名工具库
 * 
 * ⚠️ 重要：本实现严格遵循后端 Go 的签名规范
 * 参考文档：docs/Gateway/签名与序列化唯一指南（以Go后端实现为准）.md
 * 
 * 签名流程（与后端完全一致）：
 * 1. 复制结构体，将排除字段设为零值（不是删除！）
 * 2. 对对象 key 做稳定排序（与 Go json.Marshal 对 map 的行为一致）
 * 3. 将结构体转为 JSON 字符串（X/Y/R/S 是十进制字符串，不是数字！）
 * 4. 对 JSON UTF-8 字节数组计算 SHA-256 哈希
 * 5. 使用 ECDSA P-256 私钥对哈希字节数组签名
 * 6. 返回签名 (R, S) 作为十进制字符串
 */

import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

// 初始化 P-256 曲线（也叫 secp256r1 或 prime256v1）
const ec = new EC('p256');

// ============================================
// 类型定义
// ============================================

/**
 * 公钥格式（后端要求）
 * X/Y 可以是 bigint 或 string（BigInt-safe JSON 解析后是 string）
 */
export interface PublicKeyNew {
  CurveName: string;
  X: bigint | string;
  Y: bigint | string;
}

/**
 * ECDSA 签名格式
 * R/S 使用 bigint 存储，序列化时转为十进制字符串
 */
export interface EcdsaSignature {
  R: bigint;
  S: bigint;
}

/**
 * 用于网络传输的签名格式（十进制字符串）
 */
export interface EcdsaSignatureWire {
  R: string;
  S: string;
}

// ============================================
// 核心签名函数（严格遵循后端规范）
// ============================================

/**
 * 将排除字段设置为零值（与后端 reflect.Zero 对齐）
 * 
 * @param obj 要处理的对象
 * @param excludeFields 要排除的字段名数组
 */
function applyExcludeZeroValue(obj: Record<string, unknown>, excludeFields: string[]): void {
  for (const field of excludeFields) {
    if (field === 'UserSig' || field === 'Sig' || field === 'GroupSig' || field === 'UserSignature') {
      // 签名字段的零值是 {R: null, S: null}
      // 因为 Go 的 EcdsaSignature 中 R 和 S 是 *big.Int 指针类型
      // reflect.Zero() 返回 nil，JSON 序列化为 null
      obj[field] = { R: null, S: null };
    }
    // 注意：其他字段不需要特殊处理，因为我们只排除签名字段
  }
}

/**
 * 仅对 map 字段做 key 排序（匹配 Go 对 map[string] 的排序输出）
 * ⚠️ 注意：不要对整个对象做全局 key 排序，会改变 struct 字段顺序导致签名不一致
 * 
 * @param obj 对象（会被原地修改）
 */
function sortMapFieldsOnly(obj: Record<string, unknown>): void {
  // 已知的 map 字段列表（根据后端结构体定义）
  const mapFields = ['AddressMsg', 'GuarTable'];
  
  for (const field of mapFields) {
    if (obj[field] && typeof obj[field] === 'object' && !Array.isArray(obj[field])) {
      const mapValue = obj[field] as Record<string, unknown>;
      const sortedKeys = Object.keys(mapValue).sort();
      const sorted: Record<string, unknown> = {};
      for (const k of sortedKeys) {
        sorted[k] = mapValue[k];
      }
      obj[field] = sorted;
    }
  }
}

/**
 * 对结构体进行签名（严格遵循后端规范）
 * 
 * ⚠️ 重要规则（来自后端权威文档）：
 * 1. 排除字段不能删除，必须设置为零值 {R: null, S: null}
 * 2. X/Y/R/S/D 必须是 JSON number（不带引号）
 * 3. 对 JSON UTF-8 字节数组做 SHA-256
 * 4. 不要全局排序 key，只对 map 字段（如 AddressMsg）做 key 排序
 * 
 * @param data 要签名的数据对象
 * @param privateKeyHex 私钥（hex 格式，64字符）
 * @param excludeFields 要排除的字段名数组（如 ['UserSig', 'Sig']）
 * @returns EcdsaSignature
 */
export function signStruct(
  data: Record<string, unknown>,
  privateKeyHex: string,
  excludeFields: string[] = []
): EcdsaSignature {
  // 1. 深拷贝对象，同时将 bigint 转为十进制字符串
  const copy = JSON.parse(JSON.stringify(data, bigintReplacer));
  
  // 2. 将排除字段设置为零值（不是删除！）
  applyExcludeZeroValue(copy, excludeFields);
  
  // 3. 只对 map 字段做 key 排序（不要全局排序！）
  sortMapFieldsOnly(copy);
  
  // 4. JSON 序列化，然后把 X/Y/R/S/D 的引号去掉变成 number
  let jsonStr = JSON.stringify(copy);
  jsonStr = jsonStr.replace(/"(X|Y|R|S|D)":"(\d+)"/g, '"$1":$2');
  
  // 5. 对 JSON UTF-8 字节数组计算 SHA-256 哈希
  const hashBytes = sha256.array(jsonStr);
  
  // 6. 使用 ECDSA P-256 私钥对哈希字节数组签名
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  const signature = key.sign(hashBytes);
  
  // 7. 返回签名（内部使用 bigint 存储）
  return {
    R: BigInt('0x' + signature.r.toString(16)),
    S: BigInt('0x' + signature.s.toString(16))
  };
}

/**
 * 验证签名（用于本地测试）
 * 
/**
 * 验证签名（用于本地测试）
 * 
 * @param data 原始数据对象
 * @param signature 签名
 * @param publicKeyHex 公钥 X 坐标（hex 格式）
 * @param publicKeyYHex 公钥 Y 坐标（hex 格式）
 * @param excludeFields 要排除的字段名数组
 * @returns 验证是否成功
 */
export function verifyStruct(
  data: Record<string, unknown>,
  signature: EcdsaSignature,
  publicKeyHex: string,
  publicKeyYHex: string,
  excludeFields: string[] = []
): boolean {
  try {
    // 1. 深拷贝对象，同时将 bigint 转为十进制字符串
    const copy = JSON.parse(JSON.stringify(data, bigintReplacer));
    
    // 2. 将排除字段设置为零值
    applyExcludeZeroValue(copy, excludeFields);
    
    // 3. 只对 map 字段做 key 排序（不要全局排序！）
    sortMapFieldsOnly(copy);
    
    // 4. JSON 序列化，然后把 X/Y/R/S/D 的引号去掉变成 number
    let jsonStr = JSON.stringify(copy);
    jsonStr = jsonStr.replace(/"(X|Y|R|S|D)":"(\d+)"/g, '"$1":$2');
    
    // 5. 对 JSON UTF-8 字节数组计算 SHA-256 哈希
    const hashBytes = sha256.array(jsonStr);
    
    // 6. 构造公钥
    const key = ec.keyFromPublic({
      x: publicKeyHex,
      y: publicKeyYHex
    }, 'hex');
    
    // 7. 验证签名
    return key.verify(hashBytes, {
      r: signature.R.toString(16),
      s: signature.S.toString(16)
    });
  } catch (error) {
    console.error('[签名] 验证失败:', error);
    return false;
  }
}

// ============================================
// 公钥和地址工具函数
// ============================================

/**
 * 从私钥生成公钥
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
 * 从私钥获取公钥的 hex 坐标
 * 
 * @param privateKeyHex 私钥（hex 格式）
 * @returns { x: string, y: string } 公钥坐标（hex 格式）
 */
export function getPublicKeyHexFromPrivate(privateKeyHex: string): { x: string; y: string } {
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  const pubPoint = key.getPublic();
  return {
    x: pubPoint.getX().toString(16).padStart(64, '0'),
    y: pubPoint.getY().toString(16).padStart(64, '0')
  };
}

/**
 * 生成新的密钥对
 * 
 * @returns { privateKey: string, publicKey: PublicKeyNew }
 */
export function generateKeyPair(): { privateKey: string; publicKey: PublicKeyNew } {
  const key = ec.genKeyPair();
  return {
    privateKey: key.getPrivate('hex'),
    publicKey: {
      CurveName: 'P256',
      X: BigInt('0x' + key.getPublic().getX().toString(16)),
      Y: BigInt('0x' + key.getPublic().getY().toString(16))
    }
  };
}

/**
 * 根据公钥生成钱包地址
 * 地址 = SHA256(公钥字节).hex 前 40 字符
 * 
 * @param publicKey 公钥
 * @returns 地址字符串（40字符 hex）
 */
export function generateAddress(publicKey: PublicKeyNew): string {
  // 将公钥 X, Y 转为 hex 并拼接
  const xHex = publicKey.X.toString(16).padStart(64, '0');
  const yHex = publicKey.Y.toString(16).padStart(64, '0');
  const pubKeyHex = '04' + xHex + yHex; // 04 前缀表示未压缩公钥

  // 将 hex 字符串转为字节数组
  const bytes: number[] = [];
  for (let i = 0; i < pubKeyHex.length; i += 2) {
    bytes.push(parseInt(pubKeyHex.substr(i, 2), 16));
  }

  // SHA-256 哈希（使用 js-sha256）
  const hash = sha256(bytes);

  // 取前 20 字节（40 字符）
  return hash.substring(0, 40);
}

// ============================================
// 时间戳函数
// ============================================

/**
 * 获取当前时间戳（秒）
 * 使用标准 Unix 时间戳
 * 
 * @returns 当前时间戳（秒）
 */
export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 获取自定义纪元时间戳（2020-01-01 00:00:00 UTC）
 * 部分 API 使用此格式
 * 
 * @returns 自定义纪元时间戳（秒）
 */
export function getCustomEpochTimestamp(): number {
  const EPOCH_2020 = new Date('2020-01-01T00:00:00Z').getTime();
  return Math.floor((Date.now() - EPOCH_2020) / 1000);
}

// ============================================
// JSON 序列化辅助函数
// ============================================

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
 * 将对象序列化为后端可接受的 JSON 格式
 * 
 * ⚠️ 重要：根据后端权威文档，X/Y/R/S/D 必须是 JSON number（不带引号）！
 * Go 的 *big.Int 序列化为 JSON 时是数字字面量，不是字符串。
 * 
 * 解决方案：
 * 1. 先用 JSON.stringify + bigintReplacer 把 bigint 转成十进制字符串
 * 2. 再用正则表达式把 X/Y/R/S/D 字段的引号去掉，变成 JSON number 字面量
 * 
 * 例如：
 * - 输入：{"X":"123456789"}
 * - 输出：{"X":123456789}
 * 
 * @param obj 要序列化的对象
 * @returns JSON 字符串，其中 X/Y/R/S/D 字段为数字字面量（不带引号）
 */
export function serializeForBackend(obj: unknown): string {
  // 1. 先用 JSON.stringify 把 bigint 转成十进制字符串
  let json = JSON.stringify(obj, bigintReplacer);
  
  // 2. 用正则表达式把 X/Y/R/S/D 字段的引号去掉，变成 JSON number 字面量
  // 匹配 "X":"数字" 并替换为 "X":数字
  json = json.replace(/"(X|Y|R|S|D)":"(\d+)"/g, '"$1":$2');
  
  return json;
}

/**
 * 将 hex 字符串转为 bigint
 * 
 * @param hex hex 字符串（可带或不带 0x 前缀）
 * @returns bigint
 */
export function hexToBigInt(hex: string): bigint {
  const cleanHex = hex.startsWith('0x') ? hex : '0x' + hex;
  return BigInt(cleanHex);
}

/**
 * 将 bigint 或 string（十进制）转为 hex 字符串（无 0x 前缀）
 * 
 * @param value bigint 或十进制字符串
 * @param padLength 填充长度（默认 64）
 * @returns hex 字符串
 */
export function bigIntToHex(value: bigint | string, padLength: number = 64): string {
  // 如果是 string，先转为 BigInt
  const bi = typeof value === 'string' ? BigInt(value) : value;
  return bi.toString(16).padStart(padLength, '0');
}

// ============================================
// 公钥格式转换
// ============================================

/**
 * 将 hex 格式公钥转换为后端要求的格式
 * 
 * @param pubXHex 公钥 X 坐标（hex 格式）
 * @param pubYHex 公钥 Y 坐标（hex 格式）
 * @returns PublicKeyNew
 */
export function convertHexToPublicKey(pubXHex: string, pubYHex: string): PublicKeyNew {
  return {
    CurveName: 'P256',
    X: hexToBigInt(pubXHex),
    Y: hexToBigInt(pubYHex)
  };
}

/**
 * 将 PublicKeyNew 转换为 hex 格式
 * 
 * @param publicKey PublicKeyNew
 * @returns { x: string, y: string }
 */
export function convertPublicKeyToHex(publicKey: PublicKeyNew): { x: string; y: string } {
  return {
    x: bigIntToHex(publicKey.X),
    y: bigIntToHex(publicKey.Y)
  };
}
