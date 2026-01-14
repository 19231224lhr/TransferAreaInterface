This document focuses on the **“Build Transaction / Send Transaction”** workflow on the main page. It’s written to be practical: follow the steps, and you’ll get reliable results—no need to understand the internals.

---

## 1. What Does “Build Transaction” Mean?
You can think of “Build Transaction” as:
> Combine spendable funds from your selected source address(es) → attach recipient info, gas, change outputs → sign locally → submit to the network.

That’s why PanguPay checks many things before sending: **balance, address validity, change address, gas**, and more.

---

## 2. Choose a Transfer Mode (Important)
PanguPay typically offers three modes on the main page:

### 2.1 Normal / Fast Transfer (Default, Recommended)
- Supports **multiple recipients**.
- Supports **multiple source addresses**.
- Usually requires **Verify (shield)** on the recipient address to fetch public key and other info.

> Whether you see “Normal” or “Fast” depends on org membership:  
> Not in an org → “Normal”; in an org → “Fast” plus more advanced features.

### 2.2 Cross-Chain Transfer (Org Feature)
Cross-chain is stricter:
- **Only one recipient**
- Recipient must be an **ETH-style address starting with `0x`**
- Amount must be an **integer**
- A **PGC change address** is required
- Capsule addresses are not supported in cross-chain mode

### 2.3 Pledge (Org Feature)
Pledge is an organization workflow:
- If you’re not sure you need it, stick to Normal/Fast.

---

## 3. A Full Transfer: From Zero to Submit

### Step 1: Select Source Address(es)
Your “From” selection decides where the funds come from:
- Normal/Fast: multi-select is allowed; PanguPay calculates balance and gas across them.
- Cross-chain: the final build requires **exactly one** source address.

What you might notice (and it’s normal):
- After you submit a transaction, some UTXOs/TXCers may be temporarily locked while pending to prevent double-spend.

### Step 2: Add Recipient(s)
Click “Add” to create a recipient row. You’ll see fields like:
- Recipient address (required)
- Amount (required)
- Currency (required)
- (expanded) Public key, org ID, transfer gas, etc.

#### 2.1 Why Click “Verify (Shield)”?
For Normal/Fast transfers, the system tries to fetch and fill recipient info (especially the public key). If it’s missing, output building may fail.

Best habit:
1. Paste address
2. Click **Verify (shield)**
3. Then enter amount and currency

If you see:
- “Invalid/missing public key”
- “Currency type mismatch”
- “Address query failed”

Try:
1. Click Verify again
2. Refresh on the main page and retry

#### 2.2 Capsule Addresses
If you enter a Capsule address:
- PanguPay will ask you to verify it to resolve the real address
- Capsule is supported in Normal/Fast, but not supported in Cross-chain

### Step 3: Advanced Options (Gas / Change Address)
Advanced options are not “mandatory”, but they control important details.

#### 3.1 TX Gas (Default: 1)
This is the base gas for the transaction.  
If you’re unsure, **keeping the default is usually best**.

#### 3.2 Extra Gas (Optional)
If you set Extra Gas > 0, PanguPay will ask for confirmation to prevent mistakes.  
It helps when your available gas is not enough.

#### 3.3 Change Address
If your selected inputs exceed the amount you need to pay, the remainder is returned as “change”.

Change addresses are separated by coin:
- PGC Change
- BTC Change
- ETH Change

Typical behavior:
- PanguPay auto-selects a usable change address (often the first available one).
- You can manually choose where you want the change to go.

Cross-chain extra rule:
- You **must** choose a **PGC change address**, otherwise you’ll get a “missing change address” error.

### Step 4: Click “Build Transaction”
PanguPay will validate:
- address format
- amount > 0 (cross-chain: integer only)
- currency matches verified address type (Normal/Fast)
- gas is sufficient
- required change address exists

If your private key is encrypted, you’ll be asked for your payment password:
- correct password → local signing
- signing success → submission

### Step 5: What Happens After Submission?
After submit you may see:
- the button disabled briefly (double-submit prevention)
- UTXO/TXCer locks while Pending
- a new record in History

If submission fails:
- an error reason is shown
- locked resources are typically released automatically (or shortly after)

---

## 4. Two Recommended Practice Runs

### 4.1 Practice A: Normal/Fast (PGC → PGC)
1. Mode: Normal/Fast
2. Select a source address with balance
3. Recipient: paste address → Verify → choose PGC → enter amount
4. Keep Advanced Options default
5. Build and check History

### 4.2 Practice B: Cross-Chain (PGC → 0x...)
1. Ensure you joined an organization and switch to Cross-chain
2. Keep only one source address
3. Recipient must start with `0x` (ETH format); amount must be an integer
4. Advanced Options: choose PGC change address
5. Build and check status

---

## 5. Want More Technical Details?
For developers and testers:
- Transaction building & serialization: `js/services/txBuilder.ts`
- Validation & mode rules: `js/services/transfer.ts`
- Address verification & public key autofill: `js/services/recipient.js`
- Backend docs: `UTXO-Area/docs/` (TXCer, cross-chain, gateway, etc.)

For normal users, remember the simple recipe: **follow steps → verify (shield) → keep defaults → build**.
