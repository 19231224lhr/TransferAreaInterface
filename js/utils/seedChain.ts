/**
 * Deterministic seed-chain helpers aligned with the Go backend.
 */

import { sha256 } from 'js-sha256';
import {
  AlgorithmECDSAP256,
  PublicKeyEnvelope,
  SignatureEnvelope,
  decodeBackendBytes,
  normalizePrivateKeyHex,
  publicKeyEnvelopeFromPrivate,
  signHashEnvelope
} from './signature';

export const DefaultSeedChainLength = 1000;
export const DefaultSeedReAnchorThreshold = 50;
export const DefaultSeedRecoverGenerationWindow = 2048;

const deterministicSeedDomainTag = 'pangu-seedchain-v2';
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

export interface SeedChainState {
  masterSeed: number[];
  chain: number[][];
  length: number;
  step: number;
  generation: number;
}

function hashBytes(input: ArrayLike<number>): number[] {
  return sha256.array(Array.from(input));
}

function pad32(bytes: number[]): number[] {
  if (bytes.length >= 32) {
    return bytes.slice(bytes.length - 32);
  }
  return [...new Array(32 - bytes.length).fill(0), ...bytes];
}

function numberArrayEquals(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  const a = Array.from(left);
  const b = Array.from(right);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function computeSeedAnchor(seed: ArrayLike<number> | string | null | undefined): number[] {
  return hashBytes(decodeBackendBytes(seed));
}

export function buildSeedChain(masterSeed: ArrayLike<number>, chainLength: number = DefaultSeedChainLength): number[][] {
  const normalizedSeed = Array.from(masterSeed);
  if (normalizedSeed.length === 0) {
    throw new Error('masterSeed is empty');
  }
  if (chainLength <= 0) {
    throw new Error('chainLength must be > 0');
  }
  const chain: number[][] = new Array(chainLength + 1);
  chain[0] = hashBytes(normalizedSeed);
  for (let index = 1; index <= chainLength; index += 1) {
    chain[index] = hashBytes(chain[index - 1]);
  }
  return chain;
}

export function deterministicMasterSeedFromPrivateKey(privateKeyHex: string, generation: number = 0): number[] {
  if (generation < 0) {
    throw new Error(`invalid generation ${generation}`);
  }
  const scalarBytes = pad32(decodeBackendBytes(normalizePrivateKeyHex(privateKeyHex)));
  const domain = Array.from(new TextEncoder().encode(`${deterministicSeedDomainTag}:${generation}:`));
  return hashBytes([...domain, ...scalarBytes]);
}

export function newDeterministicSeedChainStateFromPrivateKey(
  privateKeyHex: string,
  chainLength: number = DefaultSeedChainLength,
  generation: number = 0
): SeedChainState {
  const masterSeed = deterministicMasterSeedFromPrivateKey(privateKeyHex, generation);
  const chain = buildSeedChain(masterSeed, chainLength);
  return {
    masterSeed,
    chain,
    length: chainLength,
    step: chainLength,
    generation
  };
}

export function recoverDeterministicSeedChainStateFromPrivateKey(
  privateKeyHex: string,
  chainLength: number,
  step: number,
  anchor: ArrayLike<number> | string | null | undefined,
  maxGeneration: number = DefaultSeedRecoverGenerationWindow
): SeedChainState {
  const normalizedStep = Number(step);
  if (normalizedStep < 0 || normalizedStep > chainLength) {
    throw new Error(`step ${normalizedStep} out of range [0, ${chainLength}]`);
  }
  const expectedAnchor = decodeBackendBytes(anchor);
  if (expectedAnchor.length === 0) {
    const state = newDeterministicSeedChainStateFromPrivateKey(privateKeyHex, chainLength, 0);
    state.step = normalizedStep;
    return state;
  }

  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    const candidate = newDeterministicSeedChainStateFromPrivateKey(privateKeyHex, chainLength, generation);
    const computedAnchor = computeSeedAnchor(candidate.chain[normalizedStep]);
    if (numberArrayEquals(computedAnchor, expectedAnchor)) {
      candidate.step = normalizedStep;
      return candidate;
    }
  }

  throw new Error(`anchor mismatch at step ${normalizedStep}`);
}

export function currentSeed(state: SeedChainState): number[] {
  if (state.step < 0 || state.step > state.length) {
    throw new Error(`step ${state.step} out of range [0, ${state.length}]`);
  }
  return [...state.chain[state.step]];
}

export function currentAnchor(state: SeedChainState): number[] {
  return computeSeedAnchor(currentSeed(state));
}

export function nextAnchor(state: SeedChainState): number[] {
  if (state.step <= 0) {
    throw new Error('seed chain exhausted');
  }
  return computeSeedAnchor(state.chain[state.step - 1]);
}

export function advanceSeedState(state: SeedChainState): SeedChainState {
  if (state.step <= 0) {
    throw new Error('seed chain exhausted');
  }
  return { ...state, step: state.step - 1 };
}

export function needReAnchor(state: SeedChainState, threshold: number = DefaultSeedReAnchorThreshold): boolean {
  const safeThreshold = threshold > 0 ? threshold : DefaultSeedReAnchorThreshold;
  return state.step <= safeThreshold;
}

export function reAnchorDeterministic(
  privateKeyHex: string,
  chainLength: number = DefaultSeedChainLength,
  nextGeneration: number
): SeedChainState {
  return newDeterministicSeedChainStateFromPrivateKey(privateKeyHex, chainLength, Math.max(0, nextGeneration));
}

export function deriveP256PrivateKeyHexFromSeed(seedReveal: ArrayLike<number> | string): string {
  const seedBytes = decodeBackendBytes(seedReveal);
  if (seedBytes.length < 32) {
    throw new Error(`seed too short (${seedBytes.length} bytes)`);
  }
  const value = BigInt(`0x${seedBytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`);
  const normalized = (value % (P256_ORDER - 1n)) + 1n;
  return normalized.toString(16).padStart(64, '0');
}

export function deriveP256PublicKeyEnvelopeFromSeed(seedReveal: ArrayLike<number> | string): PublicKeyEnvelope {
  return publicKeyEnvelopeFromPrivate(deriveP256PrivateKeyHexFromSeed(seedReveal));
}

export function buildSeedSpendArtifacts(
  outputHash: ArrayLike<number>,
  seedReveal: ArrayLike<number> | string
): {
  seedReveal: number[];
  seedPublicKeyV2: PublicKeyEnvelope;
  inputSignatureV2: SignatureEnvelope;
  derivedPrivateKeyHex: string;
} {
  const revealBytes = decodeBackendBytes(seedReveal);
  const derivedPrivateKeyHex = deriveP256PrivateKeyHexFromSeed(revealBytes);
  return {
    seedReveal: revealBytes,
    seedPublicKeyV2: publicKeyEnvelopeFromPrivate(derivedPrivateKeyHex),
    inputSignatureV2: signHashEnvelope(AlgorithmECDSAP256, outputHash, derivedPrivateKeyHex),
    derivedPrivateKeyHex
  };
}

export function buildInitialSeedMetaFromPrivateKey(privateKeyHex: string): {
  seedAnchor: number[];
  seedChainStep: number;
  defaultSpendAlgorithm: string;
  state: SeedChainState;
} {
  const state = newDeterministicSeedChainStateFromPrivateKey(privateKeyHex, DefaultSeedChainLength, 0);
  return {
    seedAnchor: currentAnchor(state),
    seedChainStep: state.step,
    defaultSpendAlgorithm: AlgorithmECDSAP256,
    state
  };
}
