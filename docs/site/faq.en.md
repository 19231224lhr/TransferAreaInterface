This FAQ covers the most common questions in PanguPay. The goal is simple: clear answers you can act on right away.

---

## Q1: Why do I need to click “Verify (shield)” after entering an address?
In Normal/Fast transfers, the wallet needs to query the recipient address info from the network (such as currency type and public key) to build outputs correctly.  
When you click Verify, PanguPay tries to:
- validate the address format
- auto-fill the recipient public key
- check whether the selected currency matches the verified address type

It’s not always mandatory, but skipping it increases the chance of “missing public key / type mismatch” errors.

---

## Q2: Why must a cross-chain recipient start with `0x`?
Cross-chain mode currently uses an ETH-style address format for the target, so it must be a 42-character hex string starting with `0x`.  
If it doesn’t match, PanguPay will block the build for safety.

---

## Q3: Why must cross-chain amounts be integers?
This is a protocol/backend validation rule for cross-chain transactions.  
If you enter decimals, you’ll see an “amount must be integer” error.

---

## Q4: I see “missing change address”. What should I do?
Change address is where the remaining funds go when your selected inputs exceed the exact payment amount.  
Fix:
1. Open “Advanced Options”
2. Choose a change address for the coin you’re spending
3. In cross-chain mode, a **PGC change address** is required

If it still complains even after you selected one, try switching the dropdown once or refresh and try again.

---

## Q5: It says “insufficient balance”, but I still have funds.
Common reasons:
- the selected source address doesn’t have enough balance (funds are on another address)
- some UTXOs are temporarily reserved by a pending transaction
- multiple recipients / higher gas increases the total requirement

Try:
1. select a richer source address
2. select multiple source addresses (Normal/Fast supports this)
3. wait for the previous transaction to settle

---

## Q6: What is Gas? Do I need to understand it deeply?
Not deeply. Think of gas as the “cost/resources needed to run the transaction.”  
Most of the time:
- keep TX Gas at the default `1`
- keep Extra Gas at `0`

If you see “insufficient gas”:
- select more source addresses (more available gas)
- or add a small Extra Gas in Advanced Options

---

## Q7: My transaction stays Pending. What now?
Don’t panic—follow this order:
1. wait 30 seconds to a few minutes (confirmation takes time)
2. refresh on the main page
3. check History for the latest status
4. if it stays unchanged for a long time, follow “Troubleshooting”

---

## Q8: “Invalid/missing public key”
Normal/Fast transfers require the recipient public key.
Fix:
1. paste the address and click **Verify (shield)** to autofill the key
2. if autofill fails, the address may not exist on chain yet or is not queryable

Cross-chain mode does not require recipient public key—double-check you’re in the correct mode.

---

## Q9: I forgot my payment password. Can I recover it?
The payment password cannot be recovered.  
If you still have your private key backup:
- re-import your account and set a new password

If you don’t have the private key backup:
- sadly, you can’t regain control (this is the security boundary of a non-custodial wallet)

---

## Q10: Why does my data disappear after switching devices/browsers?
Because private keys are stored locally, not on the server.  
To migrate, you must import your private key on the new device.

---

## Q11: Can I cancel a submitted transaction?
Usually you can’t “revoke” it directly.  
What you can do:
- wait for it to confirm or fail
- if it fails, reserved UTXOs/TXCers are typically released automatically

---

If you still have questions, check “Glossary” and “Troubleshooting”. Many “scary-looking” errors have simple, gentle fixes.
