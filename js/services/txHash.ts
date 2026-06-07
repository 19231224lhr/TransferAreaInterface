import type { Transaction } from '../types/blockchain';
import { hashBackendJson } from '../utils/signature';

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString(10);
  }
  return value;
}

function applyTXHashZeroValue(obj: Record<string, unknown>): void {
  obj.TXID = '';
  obj.Size = 0;
  obj.NewValue = 0;
  obj.UserSignature = { R: null, S: null };
  obj.UserSignatureV2 = { Algorithm: '', Signature: null };
  obj.TXType = 0;
}

export function getTXHash(tx: Transaction): number[] {
  const filteredInputs = (tx.TXInputsNormal || []).filter(input => !input.IsGuarMake);
  const filteredOutputs = (tx.TXOutputs || []).filter(output => !output.IsGuarMake);

  const txForHash = {
    ...tx,
    TXInputsNormal: filteredInputs,
    TXInputsCertificate: tx.TXInputsCertificate || [],
    TXOutputs: filteredOutputs,
    ValueDivision: tx.ValueDivision || {},
    NewValueDiv: tx.NewValueDiv || {},
    Data: tx.Data || ''
  };

  const copy = JSON.parse(JSON.stringify(txForHash, bigintReplacer)) as Record<string, unknown>;
  applyTXHashZeroValue(copy);
  return hashBackendJson(copy);
}

export function calculateTXID(tx: Transaction): string {
  const hash = getTXHash(tx);
  let txid = '';
  for (let i = 0; i < 8; i += 1) {
    txid += hash[i].toString(16).padStart(2, '0');
  }
  return txid;
}
