Welcome to **PanguPay**! This quick start helps you complete your **first transfer in ~3 minutes**—from the main page, to building a transaction, to checking its status in History.

---

## 0. Before You Begin
- A desktop browser (Chrome / Edge) is recommended for the smoothest experience.
- First-time user: create an account and set a payment password.
- Existing user: import your private key and unlock your wallet.
- In local development, the default backend Gateway is `http://localhost:3001` (your developer usually starts it for you).

---

## 1. Open the Main Page (Wallet)
You’ll see two major areas:
- Left: Wallet & Address Management (balances, address list, refresh)
- Right: Transfer Panel (recipient, mode, advanced options, build transaction)

If your balance looks empty, try the **Refresh** button first.

---

## 2. Send Your First Transfer (Recommended: Normal / Fast)

### Step 1: Choose a Mode
At the top of the transfer panel:
- If you haven’t joined an organization, it usually shows **Normal Transfer** (internally it’s still `quick` mode).
- After joining an organization, it becomes **Fast Transfer** and unlocks cross-chain / pledge features.

For your first try, just keep the default.

### Step 2: Choose Source Address(es)
In the “From” list, select the address(es) you want to spend from:
- If you only have one address, PanguPay will auto-select it.
- Normal/Fast transfers allow multiple selections; the system will combine them during building.

### Step 3: Add a Recipient
1. Click **Add**.
2. Paste the recipient address.
3. Click the **Verify (shield)** button on the right side of the address input:
   - It validates the address format
   - And tries to auto-fill the recipient public key (required for normal/fast transfers)
4. Enter the amount and choose the currency (PGC/BTC/ETH).

> If you see “invalid/missing public key”, simply click **Verify** again in most cases.

### Step 4: Advanced Options (Keep Defaults)
Open “Advanced Options” if you want to check:
- Extra Gas: usually keep `0`
- TX Gas: usually keep the default `1`
- Change address: usually auto-selected

> In cross-chain mode, you **must** choose a PGC change address.

### Step 5: Click “Build Transaction”
When you click **Build Transaction**:
- The system validates balance, address format, change addresses, gas, etc.
- If your private key is encrypted, you’ll be prompted for your payment password to sign

The button may show a short loading state—totally normal.

---

## 3. Check Status in History
Click the **History** button on the wallet page:
- Watch the status move (e.g. `Pending → Committed`)
- Open the detail view for more information

If it doesn’t update immediately, wait a bit or refresh on the main page.

---

## 4. Want to Try Cross-Chain?
Cross-chain transfers are more advanced and usually require organization membership. Key rules:
- Only **one recipient**
- Recipient must be an **ETH-style address starting with `0x`**
- A **PGC change address** is required

After your first normal transfer, open “Transfers & Transactions” on the left to go deeper.
