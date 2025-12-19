/**
 * JSDoc Type Definitions for PanguPay
 * 
 * This file contains all shared type definitions used throughout the application.
 * Import this file where type checking is needed or reference via @typedef.
 * 
 * @fileoverview Type definitions for the PanguPay wallet application
 */

// ========================================
// User & Wallet Types
// ========================================

/**
 * @typedef {Object} UserProfile
 * @property {string} [avatar] - User avatar (base64 or URL)
 * @property {string} [nickname] - User display name
 * @property {string} [signature] - User bio/signature
 */

/**
 * @typedef {Object} PublicKey
 * @property {string} Curve - Curve type (usually 'P256')
 * @property {string} XHex - X coordinate in hex
 * @property {string} YHex - Y coordinate in hex
 */

/**
 * @typedef {Object} Keys
 * @property {string} privHex - Private key in hex format
 * @property {PublicKey} [publicKey] - Public key object
 */

/**
 * @typedef {Object} UTXOPosition
 * @property {number} Blocknum - Block number
 * @property {number} IndexX - X index
 * @property {number} IndexY - Y index
 * @property {number} IndexZ - Z index
 */

/**
 * @typedef {Object} UTXOSource
 * @property {string} TXID - Transaction ID
 * @property {number} [VOut] - Output index (optional for compatibility with SubATX)
 * @property {number} [TXType] - Transaction type
 * @property {any[]} [TXInputsNormal] - Normal transaction inputs
 * @property {any[]} [TXInputsCertificate] - Certificate inputs
 * @property {any[]} [TXOutputs] - Transaction outputs
 * @property {Object} [InterestAssign] - Interest assignment
 * @property {string[]} [ExTXCerID] - TXCer IDs
 * @property {number[]} [Data] - Extra data
 */

/**
 * @typedef {Object} UTXO
 * @property {number} Value - UTXO value
 * @property {number} Type - Coin type (0=PGC, 1=BTC, 2=ETH)
 * @property {string} [TxHash] - Transaction hash
 * @property {number} [Index] - UTXO index
 * @property {number} [Time] - Timestamp
 * @property {UTXOPosition} [Position] - Position in blockchain
 * @property {boolean} [IsTXCerUTXO] - Whether this is a TXCer UTXO
 * @property {UTXOSource} [UTXO] - Source transaction info (SubATX structure)
 */

/**
 * @typedef {Object|number} TXCer
 * TXCer can be either a full object or just a number (value mapping)
 * @property {number} [Value] - Certificate value
 * @property {number} [Type] - Coin type
 * @property {string} [CerHash] - Certificate hash
 * @property {number} [Time] - Timestamp
 * @property {UTXOPosition} [Position] - Position in blockchain
 * @property {UTXOSource} [UTXO] - Source transaction info
 */

/**
 * @typedef {Object} AddressValue
 * @property {number} utxoValue - Total UTXO value
 * @property {number} txCerValue - Total TXCer value
 * @property {number} totalValue - Combined total value
 * @property {number} [TotalValue] - Alternative key for total value
 */

/**
 * @typedef {Object} AddressMeta
 * @property {number} type - Coin type (0=PGC, 1=BTC, 2=ETH)
 * @property {AddressValue} [value] - Balance information
 * @property {Object<string, UTXO>} [utxos] - UTXOs by key
 * @property {Object<string, TXCer|number>} [txCers] - TXCers by key (can be TXCer object or number value)
 * @property {number} [estInterest] - Estimated interest/gas
 * @property {number} [gas] - Gas amount
 * @property {string} [origin] - Address origin ('created' | 'imported')
 * @property {string} [privHex] - Private key hex (for imported addresses)
 * @property {string} [pubXHex] - Public key X coordinate hex
 * @property {string} [pubYHex] - Public key Y coordinate hex
 */

/**
 * @typedef {Object} Wallet
 * @property {Object<string, AddressMeta>} addressMsg - Address metadata by address
 * @property {Object<number, number>} [valueDivision] - Value by coin type
 */

/**
 * @typedef {Object} GuarGroup
 * @property {string} groupID - Organization ID
 * @property {string} aggreNode - Aggregation node ID
 * @property {string} assignNode - Assignment node ID
 * @property {string} pledgeAddress - Pledge address
 */

/**
 * @typedef {Object} User
 * @property {string} accountId - Account ID
 * @property {string} address - Main address
 * @property {Keys} [keys] - Key pair
 * @property {string} [privHex] - Legacy private key field
 * @property {Wallet} [wallet] - Wallet data
 * @property {string} [orgNumber] - Organization number
 * @property {GuarGroup} [guarGroup] - Guarantor group info (undefined means not joined)
 */

// ========================================
// Transaction Types
// ========================================

/**
 * @typedef {Object} TransactionBill
 * @property {number} MoneyType - Coin type
 * @property {number} Value - Transfer amount
 * @property {string} [GuarGroupID] - Guarantor organization ID
 * @property {PublicKey} PublicKey - Recipient public key
 * @property {number} [ToInterest] - Gas to transfer
 */

/**
 * @typedef {Object} TransactionBuildInfo
 * @property {number} Value - Total value
 * @property {Object<number, number>} ValueDivision - Value by coin type
 * @property {Object<string, TransactionBill>} Bill - Bills by recipient address
 * @property {string[]} UserAddress - Source addresses
 * @property {boolean} PriUseTXCer - Prioritize TXCer usage
 * @property {Object<number, string>} ChangeAddress - Change addresses by coin type
 * @property {boolean} IsPledgeTX - Is pledge transaction
 * @property {number} HowMuchPayForGas - PGC to exchange for gas
 * @property {boolean} IsCrossChainTX - Is cross-chain transaction
 * @property {string} Data - Transaction data
 * @property {Object} InterestAssign - Interest assignment
 * @property {number} InterestAssign.Gas - Base transaction gas
 * @property {number} InterestAssign.Output - Output interest
 * @property {Object<string, number>} InterestAssign.BackAssign - Back assignment
 */

/**
 * @typedef {Object} HistoryTransaction
 * @property {string} id - Transaction ID
 * @property {'send' | 'receive'} type - Transaction type
 * @property {'success' | 'pending' | 'failed'} status - Transaction status
 * @property {number} amount - Transaction amount
 * @property {string} currency - Currency code
 * @property {string} from - Sender address
 * @property {string} to - Recipient address
 * @property {number} timestamp - Unix timestamp
 * @property {string} txHash - Transaction hash
 * @property {number} gas - Gas used
 * @property {string} [guarantorOrg] - Guarantor organization
 * @property {number} [blockNumber] - Block number
 * @property {number} [confirmations] - Number of confirmations
 * @property {string} [failureReason] - Failure reason if failed
 */

// ========================================
// Validation Types
// ========================================

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [message] - Error message if invalid
 */

// ========================================
// Security Types
// ========================================

/**
 * @typedef {Object} SubmissionGuard
 * @property {() => boolean} isSubmitting - Check if currently submitting
 * @property {() => boolean} start - Start submission (returns false if already submitting)
 * @property {() => void} end - End submission
 */

/**
 * @typedef {Object} FetchOptions
 * @property {number} [timeout] - Request timeout in ms
 * @property {number} [retries] - Number of retry attempts
 * @property {number} [retryDelay] - Delay between retries in ms
 * @property {boolean} [withCsrf] - Include CSRF token
 * @property {Object} [headers] - Additional headers
 */

// ========================================
// UI Types
// ========================================

/**
 * @typedef {Object} ToastOptions
 * @property {'success' | 'error' | 'warning' | 'info'} [type] - Toast type
 * @property {number} [duration] - Display duration in ms
 * @property {string} [title] - Toast title
 */

/**
 * @typedef {Object} ModalElements
 * @property {HTMLElement} modal - Modal container
 * @property {HTMLElement} [titleEl] - Title element
 * @property {HTMLElement} [textEl] - Text content element
 * @property {HTMLElement} [okEl] - OK button
 * @property {HTMLElement} [cancelEl] - Cancel button
 */

// ========================================
// Event Types
// ========================================

/**
 * @typedef {Object} EventListenerInfo
 * @property {Function} handler - Event handler function
 * @property {Object} options - Event listener options
 */

// ========================================
// Coin Types
// ========================================

/**
 * @typedef {0 | 1 | 2} CoinTypeId
 * - 0: PGC
 * - 1: BTC
 * - 2: ETH
 */

/**
 * @typedef {Object} CoinInfo
 * @property {string} name - Coin name (PGC, BTC, ETH)
 * @property {string} className - CSS class name (pgc, btc, eth)
 * @property {string} color - Hex color code
 * @property {number} rate - Conversion rate to PGC
 */

// ========================================
// Storage Types
// ========================================

/**
 * @typedef {Object} GuarChoice
 * @property {'join' | 'skip'} type - Choice type
 * @property {string} [groupID] - Selected group ID
 * @property {string} [aggreNode] - Aggregation node
 * @property {string} [assignNode] - Assignment node
 * @property {string} [pledgeAddress] - Pledge address
 */

// Export empty object to make this a module
export {};
