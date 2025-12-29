/**
 * Big Integer JSON Parser
 * 
 * 使用 json-bigint 库解析包含大整数的 JSON
 * 解决 JavaScript 原生 JSON.parse 无法精确处理超过 Number.MAX_SAFE_INTEGER 的整数问题
 * 
 * 典型场景：后端发送的 PublicKeyNew 中的 X/Y 坐标是 256 位整数
 * 
 * @module utils/bigIntJson
 */

// @ts-ignore - json-bigint 没有类型定义
import JSONBig from 'json-bigint';

// 配置：将大整数解析为字符串（而不是 BigInt）
const JSONBigString = JSONBig({ storeAsString: true });

/**
 * 解析包含大整数的 JSON 字符串
 * 
 * 大整数（超过 Number.MAX_SAFE_INTEGER）会被保留为字符串，
 * 以避免精度丢失。
 * 
 * @param text JSON 字符串
 * @returns 解析后的对象
 */
export function parseBigIntJson<T = unknown>(text: string): T {
  return JSONBigString.parse(text) as T;
}

/**
 * 将对象序列化为 JSON 字符串（保持大整数精度）
 * 
 * @param obj 要序列化的对象
 * @returns JSON 字符串
 */
export function stringifyBigIntJson(obj: unknown): string {
  return JSONBigString.stringify(obj);
}

/**
 * 从 Response 对象解析 JSON（使用大整数安全解析）
 * 
 * 替代 response.json() 使用，避免大整数精度丢失
 * 
 * @param response Fetch Response 对象
 * @returns 解析后的数据
 */
export async function parseResponseBigInt<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  return parseBigIntJson<T>(text);
}

/**
 * 检查一个字符串是否可能是大整数
 * 
 * @param str 要检查的字符串
 * @returns 是否是大整数字符串
 */
export function isBigIntString(str: string): boolean {
  if (typeof str !== 'string') return false;
  // 检查是否全是数字，且长度超过 16 位（Number.MAX_SAFE_INTEGER 是 16 位）
  return /^\d{16,}$/.test(str);
}
