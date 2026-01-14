This glossary is not meant to be academic. It’s here to translate “blockchain words” into simple, usable explanations.

---

## Address
The string you see in your wallet. Think of it like a receiving account—others can send funds to it.

## Account ID
An identifier for your account in the system.  
It is not your private key and cannot replace it.

## Private Key
The most important secret. It’s the “master key” to your funds.  
**Anyone with your private key can move your assets.**

## Public Key
A public value derived from the private key.  
In Normal/Fast transfers, PanguPay often needs the recipient public key to build transaction outputs—this is why “Verify (shield)” tries to fetch/autofill it.

## UTXO
Think of UTXO as “unspent chunks of money”.  
Your balance is not a single number—it’s a collection of UTXOs. When sending, the wallet selects enough UTXOs to cover the amount.

## Inputs / Outputs
- Inputs: UTXOs you spend (where funds come from)
- Outputs: new UTXOs created (to the recipient and/or back to you as change)

## Change
If your selected inputs exceed what you need to pay, the remainder returns to your chosen change address.  
That’s why Advanced Options let you choose PGC/BTC/ETH change addresses.

## Gas
The “resource/cost” needed to run a transaction.  
Most users keep defaults. If you see insufficient gas, select more source addresses or add a small Extra Gas.

## TX Gas / Extra Gas
- TX Gas: base gas (default `1`)
- Extra Gas: optional additional gas (confirmation dialog appears when > 0)

## TXID
Transaction ID. Every transaction has a unique identifier for status queries and detail views.

## Pending / Committed
Two common transaction states:
- Pending: submitted, waiting for confirmation
- Committed: confirmed (finalized)

## TXCer
A transaction certificate mechanism (more of an organization/system concept).  
You don’t need to master it as a normal user, but it can affect faster confirmation and temporary resource locks.

## Guarantor Organization
A coordinated network. Joining usually unlocks more capabilities (cross-chain/pledge) and smoother status updates.

## BootNode / ComNode / AssignNode
Different node roles in the network (mostly developer concepts):
- BootNode: onboarding and service discovery
- ComNode: committee node for public queries and some transaction handling
- AssignNode: organization node handling org flows and account updates

Normal users don’t need to memorize this; you’ll mostly see these terms in logs and dev docs.

## Capsule Address
A special address type that must be verified/resolved before use.  
Supported in Normal/Fast mode; not supported in Cross-chain.
