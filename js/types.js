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
 * @typedef {Object} UTXO
 * @property {number} Value - UTXO value
 * @property {number} Type - Coin type (0=PGC, 1=BTC, 2=ETH)
 * @property {string} [TxHash] - Transaction hash
 * @property {number} [Index] - UTXO index
 */

/**
 * @typedef {Object} TXCer
 * @property {number} Value - Certificate value
 * @property {number} Type - Coin type
 * @property {string} [CerHash] - Certificate hash
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
 * @property {Object<string, TXCer>} [txCers] - TXCers by key
 * @property {number} [estInterest] - Estimated interest/gas
 * @property {string} [origin] - Address origin ('created' | 'imported')
 */

/**
 * @typedef {Object} Wallet
 * @property {Object<string, AddressMeta>} addressMsg - Address metadata by address
 * @property {Object<number, number>} [valueDivision] - Value by coin type
 */

/**
 * @typedef {Object} GuarGroup
 * @property {string} groupID - Organization ID
 * @property {string} [aggreNode] - Aggregation node ID
 * @property {string} [assignNode] - Assignment node ID
 * @property {string} [pledgeAddress] - Pledge address
 * @property {string} [AggrID] - Alternative key for aggregation node
 * @property {string} [AssiID] - Alternative key for assignment node
 * @property {string} [PledgeAddress] - Alternative key for pledge address
 */

/**
 * @typedef {Object} User
 * @property {string} accountId - Account ID
 * @property {string} address - Main address
 * @property {Keys} [keys] - Key pair
 * @property {string} [privHex] - Legacy private key field
 * @property {Wallet} [wallet] - Wallet data
 * @property {string} [orgNumber] - Organization number
 * @property {GuarGroup} [guarGroup] - Guarantor group info
 * @property {string} [GuarantorGroupID] - Alternative guarantor ID field
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
