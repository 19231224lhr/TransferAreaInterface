import type {
  BackendBytes,
  PublicKeyEnvelopeV2,
  PublicKeyV2,
  SignatureEnvelopeV2,
} from './types';

export interface AddressRegistrationCommonInput {
  address: string;
  publicKeyNew: PublicKeyV2;
  signPublicKeyV2: PublicKeyEnvelopeV2;
  seedAnchor: BackendBytes;
  seedChainStep: number;
  defaultSpendAlgorithm: string;
  type: number;
}

export interface AssignAddressRegistrationInput extends AddressRegistrationCommonInput {
  userID: string;
}

export interface RetailAddressRegistrationInput extends AddressRegistrationCommonInput {
  timestamp: number;
}

/** Build Go UserNewAddressInfo signing material in struct declaration order. */
export function buildAssignAddressRegistrationMaterial(input: AssignAddressRegistrationInput) {
  return {
    NewAddress: input.address.trim().toLowerCase(),
    PublicKeyNew: input.publicKeyNew,
    UserID: input.userID,
    Type: input.type,
    SignPublicKeyV2: input.signPublicKeyV2,
    SeedAnchor: input.seedAnchor,
    SeedChainStep: input.seedChainStep,
    DefaultSpendAlgorithm: input.defaultSpendAlgorithm,
  };
}

/** Build GQNC address-ownership signing material in authoritative Go order. */
export function buildRetailAddressOwnershipMaterial(input: RetailAddressRegistrationInput) {
  return {
    Address: input.address.trim().toLowerCase(),
    PublicKeyNew: input.publicKeyNew,
    GroupID: '',
    TimeStamp: input.timestamp,
    Type: input.type,
    SeedAnchor: input.seedAnchor,
    SeedChainStep: input.seedChainStep,
    DefaultSpendAlgorithm: input.defaultSpendAlgorithm,
    SignPublicKeyV2: input.signPublicKeyV2,
  };
}

/** GQNC retail registration intentionally carries no legacy `Sig` field. */
export function buildRetailAddressRegistrationRequest(
  material: ReturnType<typeof buildRetailAddressOwnershipMaterial>,
  addressOwnershipSig: SignatureEnvelopeV2,
) {
  return {
    ...material,
    AddressOwnershipSig: addressOwnershipSig,
  };
}
