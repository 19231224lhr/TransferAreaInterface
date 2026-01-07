# Cross-Chain Transaction Integration Guide

This document provides a detailed guide for integrating Cross-Chain Transactions (UTXO Area to Light Computation Area) in the frontend application.

## 1. Overview

Cross-Chain Transactions allow users to transfer assets (PGC) from the **UTXO Area** (Transfer Area) to the **Light Computation Area**.

*   **Source**: UTXO Area Address (e.g., wallet address).
*   **Destination**: Light Computation Area Address (Ethereum-style 0x... address).
*   **Asset**: PGC (Main Currency).

## 2. Protocol Specifications

To successfully initiate a cross-chain transaction, the transaction MUST adhere to the following strict protocol specifications. **Failure to meet these will result in the transaction being ignored or rejected by the backend.**

### 2.1. Transaction Type (CRITICAL)

*   **TXType**: MUST be set to `6` (Cross-Chain Withdrawal).
    *   *Current Frontend Issue*: The default `txBuilder` often uses `0` (Normal) or `1` (TXCer). You must explicitly override this.

### 2.2. Inputs

*   **Source Address**: Must be a single UTXO Area address.
    *   Multi-input addresses are allowed, but they must all belong to the same user/wallet (standard behavior).
*   **Asset Type**: Only Main Currency (Type 0, usually PGC) is supported.

### 2.3. Outputs

The transaction must contain specific outputs:

1.  **Cross-Chain Output** (The Transfer):
    *   **ToAddress**: The destination address in the Light Computation Area.
        *   Format: **Ethereum-style Hex Address** (starts with `0x`, 40 hex characters).
        *   Validation: Must be a valid 20-byte address.
    *   **ToValue**: Transfer Amount.
        *   **Constraint**: Must be an **INTEGER**. The backend checks `IsIntegerFloat64`. Partial amounts (e.g., 1.5) may be rejected.
    *   **IsCrossChain**: MUST be set to `true`.
    *   **ToCoinType**: MUST be `0` (Main Currency).

2.  **Change Output** (Optional):
    *   Standard change output back to the sender.
    *   `IsCrossChain`: `false`.

3.  **Gas Output** (Optional):
    *   Standard gas payment output.
    *   `IsPayForGas`: `true`.
    *   `IsCrossChain`: `false`.

## 3. Frontend Implementation Guidelines

### 3.1. Input Validation

Before constructing the transaction, validate user inputs:

```typescript
function validateCrossChainInputs(toAddress: string, amount: number): boolean {
  // 1. Address Validation (ETH-style)
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressRegex.test(toAddress)) {
    console.error("Invalid Target Address: Must be a valid Ethereum-style address (0x...)");
    return false;
  }

  // 2. Amount Validation (Integer Check)
  if (!Number.isInteger(amount)) {
    console.error("Invalid Amount: Cross-chain transfers currently support only integer amounts.");
    return false;
  }

  return true;
}
```

### 3.2. Transaction Construction (`txBuilder.ts`)

When triggering `buildNewTX` or `buildTransaction`, ensure the following parameters are set:

1.  **IsCrossChainTX**: Set to `true` in `BuildTXInfo` / params.
2.  **Bill**: The recipient address must be the ETH-style address.

**Crucial Logic Step (Code Fix Required):**

In `txBuilder.ts`, inside the `buildNewTX` function, you must ensure `TXType` is assigned correctly.

```typescript
// Current Logic (Pseudocode)
// let txType = 0;
// if (useTXCer) txType = 1;

// REQUIRED CHANGE:
if (buildTXInfo.IsCrossChainTX) {
    tx.TXType = 6; // Explicitly set to 6 for Cross-Chain
} else if (selectedTXCers.length > 0) {
    tx.TXType = 1;
} else {
    tx.TXType = 0;
}
```

### 3.3. Output Construction Logic

Ensure the output object for the recipient is created with the correct flag:

```typescript
const output: TXOutput = {
  ToAddress: recipientEthAddress, // 0x...
  ToValue: amount,
  // ... other fields
  ToCoinType: 0, 
  IsCrossChain: true, // MUST BE TRUE
  IsGuarMake: false
};
```

## 4. Backend Processing Lifecycle (For Context)

Understanding the backend flow helps in designing the UI feedback:

1.  **Submission**: Frontend submits `UserNewTX`.
2.  **Pool**: Enters UTXO Area Transaction Pool.
3.  **Aggregation**: Leader Node packages it into a Block.
    *   *Note*: The Leader looks for `TXType=6` to aggregate it into a special `AggrTXType=3` (Cross-Chain Aggregate).
4.  **Execution (`CreateCrossChainATX`)**:
    *   The backend detects `AggrTXType=3` -> `TXType=6`.
    *   It extracts the `ToAddress` and `Value`.
    *   It initiates a **gRPC call** (`CommitWithdrawTx`) to the Light Computation Area.
5.  **Confirmation**:
    *   The transaction is considered "Sent" from UTXO Area perspective once included in a block.
    *   Final confirmation depends on the Light Area accepting the gRPC call.

## 5. Troubleshooting & FAQ

*   **Q: My transaction is on chain but never arrives in Light Area.**
    *   **Check**: Did you send `TXType=6`? If you sent `TXType=0`, the backend tracks it as a normal transfer inside UTXO area. Since the destination address (0x...) likely doesn't exist in UTXO area as a point address, it might be stuck or rejected by validators eventually, or simply sit as a "burn" if checks pass.
    *   **Check**: Was the amount an integer?
*   **Q: Can I use TXCers for Cross-Chain?**
    *   **No**. The backend current logic likely doesn't support unravelling TXCers for the cross-chain specific aggregation logic. Use pure UTXO.

## 6. Summary Checklist

- [ ] Target Address is `0x...` (20 bytes hex).
- [ ] Amount is Integer.
- [ ] `IsCrossChain` flag is `true`.
- [ ] **`TXType` is set to `6`**.
- [ ] Only Main Currency (Type 0).
