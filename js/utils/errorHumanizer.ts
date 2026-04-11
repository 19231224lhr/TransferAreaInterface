import { getCurrentLanguage } from '../i18n/index.js';

function stripPrefix(text: string, prefix: string): string {
  if (!text.toLowerCase().startsWith(prefix.toLowerCase())) {
    return text;
  }
  return text.slice(prefix.length).trim();
}

function humanizeEnglishError(message: string): string {
  const raw = String(message || '').trim();
  if (!raw) return raw;

  const normalized = raw.toLowerCase();

  if (normalized.includes('transaction processing failed:')) {
    return humanizeEnglishError(stripPrefix(raw, 'transaction processing failed:'));
  }
  if (normalized.includes('transaction assignment failed:')) {
    return humanizeEnglishError(stripPrefix(raw, 'transaction assignment failed:'));
  }
  if (normalized.includes('signature verification failed:')) {
    return '签名验证失败，请重试。';
  }
  if (
    normalized.includes('can not find this peer') ||
    normalized.includes('cannot find this peer') ||
    normalized.includes('peer not found')
  ) {
    return '担保节点未在线，暂时无法发送。';
  }
  if (normalized.includes('no available guarantor')) {
    return '没有可用的担保节点，暂时无法发送。';
  }
  if (normalized.includes('failed to reassign user') || normalized.includes('no alternative guarantor available')) {
    return '担保节点暂时不可用，请稍后重试。';
  }
  if (normalized.includes('request timed out')) {
    return '请求超时，请重试。';
  }
  if (normalized.includes('network error - unable to reach server') || normalized.includes('failed to fetch')) {
    return '网络连接失败，请检查后端是否启动。';
  }
  if (normalized.includes('request was aborted')) {
    return '请求已取消。';
  }
  if (normalized.includes('request failed after retries')) {
    return '请求失败，请稍后重试。';
  }
  if (normalized.includes('invalid backend byte string')) {
    return '后端返回的数据格式不正确。';
  }
  if (
    normalized.includes('private key format incorrect') ||
    normalized.includes('private key format invalid') ||
    normalized.includes('must be 64 hex characters') ||
    normalized.includes('must be 64-character hex string')
  ) {
    return '恢复材料格式错误，请输入 arsk_... 或兼容的64位私钥。';
  }
  if (normalized.includes('address root seed must be 64 hex characters')) {
    return 'AddressRootSeed 格式错误，需要 64 位十六进制。';
  }
  if (normalized.includes('this recovery material can derive multiple coin-type addresses')) {
    return '该恢复材料可派生多个币种地址，请使用最新导出的材料或明确地址类型。';
  }
  if (normalized.includes('invalid private key')) {
    return '私钥无效。';
  }
  if (normalized.includes('invalid address')) {
    return '地址格式错误。';
  }
  if (normalized.includes('invalid request')) {
    return '请求参数错误。';
  }
  if (normalized.includes('invalid group id format')) {
    return '组织ID格式错误。';
  }
  if (normalized.includes('user not logged in')) {
    return '用户未登录。';
  }
  if (
    normalized.includes('user is not in the guarantor') ||
    normalized.includes('user not found in group') ||
    normalized.includes('user is not in the guarantor group')
  ) {
    return '用户不在担保组织中。';
  }
  if (normalized.includes('address already revoked')) {
    return '地址已解绑。';
  }
  if (normalized.includes('address not found')) {
    return '地址不存在。';
  }
  if (normalized.includes('address already exists')) {
    return '地址已存在。';
  }
  if (normalized.includes('not registered')) {
    return '地址尚未注册。';
  }
  if (
    normalized.includes('missing signpublickeyv2') ||
    normalized.includes('missing seedanchor') ||
    normalized.includes('missing defaultspendalgorithm') ||
    normalized.includes('address protocol metadata incomplete')
  ) {
    return '地址协议状态不完整，请刷新后重试。';
  }
  if (normalized.includes('anchor mismatch at step')) {
    return '地址 seed 状态不匹配，请重新导入该地址。';
  }
  if (normalized.includes('seed chain exhausted')) {
    return '地址 seed 已耗尽，请更换地址后重试。';
  }
  if (normalized.includes('utxo already spent') || normalized.includes('double spend')) {
    return '该笔余额已被使用，请刷新后重试。';
  }
  if (normalized.includes('insufficient') || normalized.includes('not enough')) {
    return '余额不足。';
  }
  if (/^http \d{3}$/i.test(raw)) {
    return `服务请求失败（${raw.toUpperCase()}）。`;
  }

  return raw;
}

export function humanizeErrorMessage(message: unknown): string {
  const text = String(message || '').trim();
  if (!text) return text;
  if (getCurrentLanguage() !== 'zh-CN') {
    return text;
  }
  return humanizeEnglishError(text);
}
