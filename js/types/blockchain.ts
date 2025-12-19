/**
 * Blockchain Core Type Definitions
 * 
 * Strict TypeScript interfaces matching backend Go structures
 * from Transaction.go, UTXO.go, and SendTX.go
 * 
 * These types provide full type safety for blockchain data operations
 * and ensure seamless backend integration.
 * 
 * @module types/blockchain
 */

// ============================================================================
// ECDSA Signature
// ============================================================================

/**
 * ECDSA signature structure
 * Corresponds to Go: EcdsaSignature
 */
export interface EcdsaSignature {
  R: string;  // Big integer as string
  S: string;  // Big integer as string
}

// ============================================================================
// Public Key
// ============================================================================

/**
 * Public key structure
 * Corresponds to Go: PublicKeyNew
 * Supports both X/Y (backend format) and XHex/YHex (frontend format)
 */
export interface PublicKeyNew {
  X?: string;      // Big integer as string (backend format)
  Y?: string;      // Big integer as string (backend format)
  XHex?: string;   // Hex string (frontend format)
  YHex?: string;   // Hex string (frontend format)
  Curve: string;   // e.g., "P256"
}

// ============================================================================
// Transaction Position
// ============================================================================

/**
 * Transaction position in blockchain
 * Corresponds to Go: TxPosition
 */
export interface TxPosition {
  Blocknum: number;  // Block number (represents zone)
  IndexX: number;    // Transaction index in block
  IndexY: number;    // Transaction index within aggregate
  IndexZ: number;    // Which output to use
}

// ============================================================================
// Transaction Input
// ============================================================================

/**
 * Nullable ECDSA signature (for unsigned inputs)
 */
export interface NullableEcdsaSignature {
  R: string | null;
  S: string | null;
}

/**
 * Normal transaction input
 * Corresponds to Go: TXInputNormal
 */
export interface TXInputNormal {
  FromTXID: string;              // Source transaction ID
  FromTxPosition: TxPosition;    // Transaction position info
  FromAddress: string;           // Source wallet sub-address
  IsGuarMake: boolean;           // Constructed by guarantor organization
  IsCommitteeMake: boolean;      // Constructed by guarantor committee for TXCer exchange
  IsCrossChain: boolean;         // Cross-chain transaction input (no verification needed)
  InputSignature: EcdsaSignature | NullableEcdsaSignature; // Signature verification (can be null before signing)
  TXOutputHash: number[] | string; // UTXO hash being used (byte array or hex string)
}

/**
 * Transaction certificate input
 * Corresponds to Go: TxCertificate
 */
export interface TxCertificate {
  ToAddress: string;        // Destination address
  Value: number;            // Transfer amount
  GuarantorGroup: string;   // Guarantor group ID
  Sig: EcdsaSignature;      // Signature
  // Additional fields as needed
}

// ============================================================================
// Transaction Output
// ============================================================================

/**
 * Transaction output
 * Corresponds to Go: TXOutput
 */
export interface TXOutput {
  ToAddress: string;         // Destination address
  ToValue: number;           // Transfer amount
  ToGuarGroupID: string;     // Destination user's guarantor organization ID
  ToPublicKey: PublicKeyNew; // Destination address public key (user-locked transaction)
  ToInterest: number;        // Allocated interest amount
  Type?: number;             // Currency type: 0=PGC, 1=BTC, 2=ETH (legacy field)
  ToCoinType?: number;       // Currency type: 0=PGC, 1=BTC, 2=ETH (preferred field)
  ToPeerID?: string;         // Destination user peer ID
  IsPayForGas?: boolean;     // Used to pay transaction fees
  IsCrossChain: boolean;     // Cross-chain transaction output
  IsGuarMake: boolean;       // Constructed by guarantor
  Hash?: string;             // Output hash (computed field)
}

// ============================================================================
// Interest Assignment (Gas Fees)
// ============================================================================

/**
 * Gas fee distribution
 * Corresponds to Go: InterestAssign
 */
export interface InterestAssign {
  Gas: number;                       // Transaction fee
  Output: number;                    // Output interest
  BackAssign: Record<string, number>; // Refund distribution: address -> ratio (sum to 1)
}

// ============================================================================
// Aggregate Transaction (SubATX)
// ============================================================================

/**
 * Sub-aggregate transaction structure
 * Corresponds to Go: SubATX
 */
export interface SubATX {
  TXID: string;                       // Transaction ID
  TXType: number;                     // Transaction type
  TXInputsNormal: TXInputNormal[];    // Normal transaction inputs
  TXInputsCertificate: TxCertificate[]; // Certificate inputs (when TXType=1)
  TXOutputs: TXOutput[];              // Transaction outputs
  InterestAssign: InterestAssign;     // Transaction fees
  ExTXCerID: string[];                // Corresponding TXCer IDs (when TXType=3)
  Data: number[];                     // Extra data (cross-chain transfers), byte array
}

// ============================================================================
// Main Transaction
// ============================================================================

/**
 * Main transaction structure sent by user
 * Corresponds to Go: Transaction
 */
export interface Transaction {
  // Basic transaction info
  TXID: string;                       // Transaction ID (generated from hash, excludes TXID and Size)
  Size: number;                       // Transaction size (byte length), generated last
  Version: number;                    // Transaction version number
  GuarantorGroup: string;             // Guarantor organization ID
  TXType: number;                     // Transaction type
  Value: number;                      // Total transfer amount
  ValueDivision: Record<number, number>; // Transfer amount by currency type
  NewValue: number;                   // Amount modified by guarantor (not included in user signature)
  NewValueDiv: Record<number, number>; // Amount type modified by guarantor (not in signature)
  
  InterestAssign: InterestAssign;     // Transaction fees
  
  // Signature
  UserSignature: EcdsaSignature;      // User signature
  
  // Inputs
  TXInputsNormal: TXInputNormal[];    // Normal inputs
  TXInputsCertificate: TxCertificate[]; // Certificate inputs
  
  // Outputs
  TXOutputs: TXOutput[];              // Transaction outputs
  
  // Extra data
  Data: number[];                     // Extra data field (cross-chain transfers), byte array
}

// ============================================================================
// UTXO Data
// ============================================================================

/**
 * UTXO information structure
 * Corresponds to Go: UTXOData
 */
export interface UTXOData {
  UTXO: SubATX;          // Source transaction
  Value: number;         // Transfer amount (actual output amount, not total UTXO)
  Type: number;          // Currency type: 0=PGC, 1=BTC, 2=ETH
  Time: number;          // Construction timestamp (milliseconds)
  Position: TxPosition;  // Position information
  IsTXCerUTXO: boolean;  // Is this a TXCer-related UTXO
  // Legacy/compatibility fields
  TXID?: string;         // Transaction ID (legacy, use UTXO.TXID instead)
  TXOutputHash?: string; // Output hash for verification
}

// ============================================================================
// Transaction Construction Info
// ============================================================================

/**
 * Bill message for transaction construction
 * Corresponds to Go: BillMsg
 */
export interface BillMsg {
  MoneyType: number;      // Currency type: 0=PGC, 1=BTC, 2=ETH
  Value: number;          // Transfer amount
  GuarGroupID: string;    // Target address guarantor organization
  PublicKey: PublicKeyNew; // Target address public key
  ToInterest: number;     // Interest amount to send
}

/**
 * Build transaction info structure
 * Corresponds to Go: BuildTXInfo
 */
export interface BuildTXInfo {
  Value: number;                         // Total transfer amount (after exchange rate conversion)
  ValueDivision: Record<number, number>; // Transfer amount by currency type
  Bill: Record<string, BillMsg>;         // Transfer bill: address -> message
  UserAddress: string[];                 // Addresses to use
  PriUseTXCer: boolean;                  // Prioritize using TXCer
  ChangeAddress: Record<number, string>; // Change addresses by currency type
  IsPledgeTX: boolean;                   // Is pledge transaction
  HowMuchPayForGas: number;              // How much UTXO to pay for gas (main currency only)
  IsCrossChainTX: boolean;               // Is cross-chain transaction
  Data: number[];                        // Extra data field (cross-chain transfers), byte array
  InterestAssign: InterestAssign;        // Transaction fees (includes extra interest)
}

/**
 * User new transaction structure
 * Corresponds to Go: UserNewTX
 */
export interface UserNewTX {
  TX: Transaction;       // Transaction body
  UserID: string;        // User ID
  Height: number;        // Block height when transaction received (not in signature)
  Sig: EcdsaSignature;   // User signature
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if object is UTXOData
 */
export function isUTXOData(obj: unknown): obj is UTXOData {
  if (typeof obj !== 'object' || obj === null) return false;
  const utxo = obj as Partial<UTXOData>;
  return (
    typeof utxo.Value === 'number' &&
    typeof utxo.Type === 'number' &&
    typeof utxo.Time === 'number' &&
    typeof utxo.IsTXCerUTXO === 'boolean' &&
    utxo.UTXO !== undefined &&
    utxo.Position !== undefined
  );
}

/**
 * Type guard to check if object is TXOutput
 */
export function isTXOutput(obj: unknown): obj is TXOutput {
  if (typeof obj !== 'object' || obj === null) return false;
  const output = obj as Partial<TXOutput>;
  return (
    typeof output.ToAddress === 'string' &&
    typeof output.ToValue === 'number' &&
    typeof output.Type === 'number'
  );
}

/**
 * Type guard to check if object is Transaction
 */
export function isTransaction(obj: unknown): obj is Transaction {
  if (typeof obj !== 'object' || obj === null) return false;
  const tx = obj as Partial<Transaction>;
  return (
    typeof tx.TXID === 'string' &&
    typeof tx.TXType === 'number' &&
    typeof tx.Value === 'number' &&
    Array.isArray(tx.TXOutputs)
  );
}
