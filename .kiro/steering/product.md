# Product Overview

PanguPay (盘古支付 - 转账区钱包接口) is a blockchain wallet solution based on the UTXO (Unspent Transaction Output) model, serving as the payment and transfer zone of the Pangu System.

## Core Features

- **Account Management**: Create new accounts or import existing ones via private key
- **Multi-Address Wallet**: Support for multiple sub-addresses under a single account
- **Multi-Currency Support**: PGC (Pangu Coin), BTC, ETH with exchange rate conversion
- **Guarantor Organizations**: Users join guarantor groups for transaction validation
- **Transaction Building**: UTXO-based transaction construction with signature verification
- **Transaction Certificates (TXCer)**: Special transaction certificates for cross-chain operations
- **Internationalization**: Full bilingual support (Chinese/English) with persistent language preference
- **User Profiles**: Customizable avatars, nicknames, and bio with local storage

## User Flow

1. Select preferred language (Chinese/English)
2. Create/Login account (generates ECDSA P-256 keypair)
3. Customize profile (avatar, nickname, bio)
4. Join a guarantor organization
5. Manage wallet addresses and view balances
6. Build and send transactions

## Key Concepts

- **Account ID**: 8-digit number derived from CRC32 of private key
- **Address**: First 20 bytes of SHA-256 hash of uncompressed public key
- **Guarantor Group**: Organization that validates and processes transactions
- **UTXO**: Unspent transaction outputs used as inputs for new transactions

## Target Users

Developers and users interacting with a UTXO-based blockchain system requiring guarantor organization membership for transaction processing.
