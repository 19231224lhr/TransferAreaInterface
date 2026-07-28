# PanguPay Web Product Context

## Product

PanguPay is the Web wallet and research-facing interface for the UTXO-Area fast-transfer system. It must make ordinary payments feel immediate while making the system's safety and consensus innovations understandable when users choose to inspect them.

## Priority

1. Wallet tasks come first: view assets, receive, send, inspect activity, and understand whether value is spendable.
2. Research visibility comes second: TXCer, FastEvidence, CFAA audit, ExposureShares, GQNC certification, and upper-layer anchoring remain visible through progressive disclosure.
3. Committee operations, governance, and deep diagnostics must not crowd the ordinary wallet shell.

## Primary Users

- Ordinary wallet users who need fast, trustworthy transfers.
- Researchers, reviewers, and advanced users who need to understand why a transfer is safe and how it progresses through the layered protocol.
- Operators are a secondary role and should use a clearly separated advanced workspace.

## Core Promise

> Value becomes spendable quickly through TXCer, while GQNC performs lightweight local certification in the background and the upper consensus layer remains the final anchoring boundary.

## Product Truths

- `TXCer Active` means the value is available for payment; it must not be presented as equivalent to global finality.
- FastEvidence and liability evidence explain the immediate safety basis.
- CFAA is asynchronous audit evidence and must not block fast availability.
- GQNC `LOCAL_CERTIFIED` is local quorum certification, not global finality.
- `AssumedAccepted` is an experimental upper-layer placeholder and must be labelled honestly.
- Raw RootID, LeafID, signatures, hashes, and Merkle paths are advanced evidence, not primary wallet content.

## Information Hierarchy

### Primary wallet layer

- Total spendable balance
- Send and receive
- Asset/address selection
- Recent activity
- Clear transaction progress
- Human-readable safety status

### Expandable safety layer

- Immediate spendability
- Guarantee verification
- CFAA audit state
- GQNC local certification
- Global anchoring state

### Advanced research layer

- Full TXID and TXCerID
- ExposureShares and liability roots
- Signer set and quorum evidence
- QC/NAC and certified block information
- Raw proof material and protocol diagnostics

## Experience Principles

- Quiet by default, expressive at meaningful moments.
- One primary action per view.
- Progressive disclosure instead of dense protocol jargon.
- Motion explains continuity, causality, and state change; it is never decorative delay.
- Use precise hierarchy, generous space, restrained colour, and direct manipulation.
- No invented statistics, generic Web3 decoration, gratuitous gradients, or glass-heavy dashboards.
- Accessibility, reduced motion, keyboard use, and 44 px minimum targets are non-negotiable.

## Visual Register

- Welcome and onboarding may be cinematic and editorial.
- Authenticated wallet views use a calm, high-precision operating interface.
- Research detail views may increase information density while preserving the same typography, spacing, and status language.
- The signature visual motif should express value moving from immediate guarantee to local certification, not generic coins or chains.

## Technical Constraints

- Existing Vite + TypeScript + lit-html architecture remains.
- Existing routing and protocol-v2 client core remain the behavioural baseline.
- Design work must not weaken exact amount handling, proof verification, or TXCer spendability rules.
- Component ideas may be borrowed from external libraries, but the redesign must not require a React or shadcn migration.
