# Product Overview

PanguPay (盘古支付 - 转账区钱包接口) is a blockchain wallet solution based on the UTXO (Unspent Transaction Output) model, serving as the payment and transfer zone of the Pangu System.

## Core Features

- **Account Management**: Create new accounts or import existing ones via private key
- **Multi-Address Wallet**: Support for multiple sub-addresses under a single account
- **Multi-Currency Support**: PGC (Pangu Coin), BTC, ETH with exchange rate conversion
- **Guarantor Organizations**: Users join guarantor groups for transaction validation
- **Transaction Building**: UTXO-based transaction construction with signature verification
- **Transaction Certificates (TXCer)**: Special transaction certificates for cross-chain operations
- **Internationalization**: Full bilingual support (Chinese/English) with 260+ translation keys
- **User Profiles**: Customizable avatars, nicknames, and bio with local storage
- **Offline Support**: Service Worker enables offline access to cached resources
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support

## Security Features

- **Private Key Encryption**: AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations)
- **XSS Protection**: HTML escaping and safe DOM manipulation
- **CSRF Protection**: Automatic token handling for API requests
- **Input Validation**: Comprehensive validation for addresses, amounts, and private keys
- **Error Boundary**: Global error handling with graceful degradation

## User Flow

1. Select preferred language (Chinese/English)
2. Create/Login account (generates ECDSA P-256 keypair)
3. Set password to encrypt private key (optional but recommended)
4. Customize profile (avatar, nickname, bio)
5. Join a guarantor organization
6. Manage wallet addresses and view balances
7. Build and send transactions

## Key Concepts

- **Account ID**: 8-digit number derived from CRC32 of private key
- **Address**: First 20 bytes of SHA-256 hash of uncompressed public key
- **Guarantor Group**: Organization that validates and processes transactions
- **UTXO**: Unspent transaction outputs used as inputs for new transactions

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `#/welcome` | Welcome | Landing page with feature overview |
| `#/login` | Login | Private key login |
| `#/new` | New User | Account creation |
| `#/entry` | Entry | Wallet management entry |
| `#/import` | Import | Import wallet via private key |
| `#/join-group` | Join Group | Join guarantor organization |
| `#/main` | Main | Wallet dashboard with transfer |
| `#/history` | History | Transaction history |
| `#/profile` | Profile | User settings and preferences |
| `#/group-detail` | Group Detail | Organization information |

## Target Users

Developers and users interacting with a UTXO-based blockchain system requiring guarantor organization membership for transaction processing.

## Technical Highlights

### Performance
- Vite-powered development with Hot Module Replacement
- Lazy loading for non-critical modules
- RAF-based batch DOM updates
- Service Worker caching for offline access

### Developer Experience
- TypeScript for type safety (gradual migration)
- Comprehensive JSDoc documentation
- Modular CSS architecture
- Centralized state management

### Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader announcements
- Focus management for modals
- Skip links for navigation
