This guide is written for everyday users. You don’t need a technical background—just follow the steps and you’ll be able to use PanguPay safely and confidently.

If you want a deeper explanation of things like **Build Transaction**, **cross-chain**, **change address**, or **gas**, you can continue with “Transfers & Transactions” and “Glossary” in the left sidebar.

---

## 1. What Can You Do With PanguPay?
- Manage your wallet addresses and balances (PGC/BTC/ETH).
- Send transfers (Normal/Fast).
- After joining a guarantor organization, unlock cross-chain and advanced capabilities.
- Track your transaction status in History.

---

## 2. First Time Here? Create or Import an Account

### 2.1 Create an Account (New Users)
1. On the welcome page, choose “Create Account / Create Wallet”.
2. PanguPay generates your Account ID, public key, private key, etc.
3. **Back up your private key** (offline is recommended).
4. Set a payment password to protect signing actions (think “a lock for your key”).

> Friendly reminder: If your private key leaks, funds can be stolen.  
> If you forget your payment password, it cannot be recovered. Please keep both safe.

### 2.2 Import an Account (Existing Private Key)
1. Choose “Import Wallet / Import Account”.
2. Paste your private key and set/enter the payment password.
3. After import, you’ll enter the main wallet page.

---

## 3. Understanding the Main Page (Wallet)

### 3.1 Left Side: Wallet & Address Management
Here you’ll find:
- **Asset overview**: balances per coin and total estimate.
- **Refresh**: sync the latest balances and UTXO status.
- **History**: view transactions and status updates.
- **Address management**: create/import addresses and view the list.

Tips:
- In local testing, if the balance looks stale, try **Refresh** first.
- After you submit a transaction, some assets may be temporarily “reserved” while it is pending—this is expected.

### 3.2 Right Side: Transfer Panel (Most Used)
Most transfers follow this rhythm:
1. Choose a mode (Normal / Fast / Cross-chain / Pledge)
2. Select source addresses (From)
3. Add recipient(s) (To)
4. Open advanced options if needed (gas, change address)
5. Click “Build Transaction”

---

## 4. Address Management: Create / Import / Choose

### 4.1 Create an Address
You can create multiple addresses for different purposes, for example:
- a daily receiving address
- a frequent sending address
- a test-only address

### 4.2 Import an Address
If you already have address material (private key or export), you can import it into the wallet.

### 4.3 Choosing Source Addresses (Practical Tips)
- For stability: prefer addresses with sufficient balance and no pending reservations.
- For cleanliness: try to avoid leaving many tiny UTXOs (it reduces unnecessary change outputs).

---

## 5. Sending a Transfer (Most Important)

### 5.1 Normal / Fast Transfer (Start Here)
The flow is: “fill → build → sign → submit”.
1. **Choose source address(es)**: multi-select is allowed.
2. **Fill recipient info**:
   - paste recipient address
   - click **Verify (shield)** to auto-check and fill information
   - enter amount and currency
3. **Advanced options**:
   - if you’re unsure, keep defaults
   - change address is usually auto-selected
4. Click **Build Transaction** and enter the payment password if prompted.

> Why do we ask you to “Verify (shield)”?  
> Because PanguPay needs to query on-chain info of the recipient (such as currency type and public key). Normal/Fast transfers require the public key to build outputs.

### 5.2 Cross-Chain Transfer (Available After Joining an Org)
Cross-chain has stricter rules:
- Only **one recipient**
- Recipient must be an **ETH-style address starting with `0x`**
- Amount must be an **integer**
- You must choose a **PGC change address** in Advanced Options

If you just joined an org, start with a small test transfer first.

### 5.3 Pledge Transactions (Org Feature)
Pledge mode is an organization feature:
- Used for org-related workflows
- If you’re a normal user, you can safely skip it for now

---

## 6. History & Transaction Status
In **History**, you can see:
- status updates (e.g. Pending/Committed)
- details like inputs/outputs, amount, time, etc.

If the status doesn’t change:
- wait a bit (confirmation takes time)
- refresh on the main page
- or follow the “Troubleshooting” checklist

---

## 7. Language & Theme
PanguPay supports both Chinese and English:
- the page and docs update automatically after switching
- for QA recordings, it helps to keep a single language consistent

---

## 8. Security Reminders (Please Read)
- Your private key belongs only to you: **never screenshot or share it**.
- The payment password is not recoverable. If you forget it, the only safe path is re-importing via your private key.
- Avoid using public computers to log in or store keys.
- When switching devices/browsers, back up your private key and import it again.

We hope every action in PanguPay feels clear, calm, and safe. If you’re unsure, start with “FAQ”.
