When you see an error, the best approach is not “click repeatedly”, but a calm **step-by-step checklist**. This page helps you narrow the issue down quickly.

---

## 0. The 30-Second Quick Check (Highly Recommended)
Do these four steps in order—many issues are solved right here:
1. On the main page, click **Refresh**
2. Confirm you’re in the correct **mode** (Normal / Cross-chain / Pledge)
3. Re-check the recipient address (no extra spaces/newlines)
4. In Normal/Fast mode, click **Verify (shield)** on the recipient address

---

## 1. Common “Build Transaction” Errors

### 1.1 “Missing change address”
Cause: change output is needed, but no change address is selected.

Fix:
1. Open “Advanced Options”
2. Choose a change address for the relevant currency
3. In cross-chain mode, a **PGC change address** is required

If the dropdown shows a value but the error still appears:
- re-select the dropdown once
- or refresh and retry (this is usually a UI state sync issue)

### 1.2 “Change address not found / incorrect”
Cause: the selected change address is not in your wallet list, or the coin type doesn’t match.

Fix:
- choose a change address that exists in your wallet
- ensure the currency matches (PGC change must be a PGC address)

### 1.3 “Invalid/missing public key”
Cause: Normal/Fast mode needs the recipient public key to build outputs.

Fix:
1. paste the recipient address
2. click **Verify (shield)** to auto-fill the public key
3. if autofill fails, the address may not exist on chain yet or is not queryable

### 1.4 “Invalid address format”
Common causes:
- the pasted address contains spaces/newlines
- cross-chain expects `0x...` but you pasted a normal address
- capsule address was not verified/resolved first

Fix:
- re-paste cleanly
- ensure mode matches address format
- verify capsule address first to resolve

### 1.5 “Insufficient balance / insufficient gas”
The fix path is usually:
1. choose a source address with higher balance
2. or select multiple source addresses (Normal/Fast supports this)
3. if gas is insufficient: select more sources or add a small Extra Gas
4. if you just sent a transaction: wait for it to confirm

### 1.6 Cross-chain limitation errors
Typical triggers:
- more than one recipient
- more than one source address
- amount is not an integer
- no PGC change address selected
- recipient does not start with `0x`

Fix: adjust items one by one.

---

## 2. After Submit: Status Doesn’t Update / Looks Strange

### 2.1 Stuck in Pending
Try in order:
1. wait 1–3 minutes
2. refresh balances / history
3. check History for new status

If it stays unchanged:
- a node/network may be unavailable
- or the app fell back to polling and updates are slower

### 2.2 Repeated submit failures
Avoid rapid retries that can cause temporary locks:
- wait 10–30 seconds and retry
- refresh the page to reset UI state

---

## 3. Local Integration Notes (Dev/QA)
In local integration setups:
- frontend default Gateway is `http://localhost:3001`
- confirm backend is running and `/health` responds
- open browser DevTools (Console/Network) to see request errors

For step-by-step startup instructions, open “Developer Quickstart”.

---

## 4. What to Share With Developers (Helps Fix Faster)
When reporting an issue, include:
- mode (Normal / Cross-chain / Pledge)
- currency, amount, recipient format (you can mask the middle)
- which source addresses were selected (mask the middle)
- the exact error message
- Console logs (copy text is better than screenshots)

You don’t need to diagnose everything—good info helps the team fix it quickly.
