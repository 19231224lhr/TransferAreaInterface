# Project Structure

```
TransferAreaInterface/
├── index.html              # Main SPA entry point
├── app.js                  # Frontend core logic (~6400 lines)
├── style.css               # Legacy styles (deprecated)
├── go.mod                  # Go module definition
│
├── css/                    # Modular CSS files
│   ├── base.css            # Reset, variables, layout
│   ├── animations.css      # Keyframe animations
│   ├── components.css      # Reusable UI components
│   ├── header.css          # Top navigation bar
│   ├── welcome.css         # Landing page
│   ├── wallet.css          # Main wallet view
│   ├── transaction.css     # Transfer form
│   ├── login.css           # Login page
│   ├── new-user.css        # Registration page
│   ├── import-wallet.css   # Import wallet page
│   ├── join-group.css      # Join guarantor org
│   ├── entry.css           # Wallet management entry
│   ├── toast.css           # Toast notifications
│   └── utilities.css       # Utility classes
│
├── backend/                # Go backend code
│   ├── core.go             # Common utilities, signing, serialization
│   ├── Account.go          # Account & Wallet structs
│   ├── NewAccount.go       # Account creation
│   ├── GetAddressMsg.go    # Address info queries
│   ├── JoinGroup.go        # Guarantor org membership
│   ├── SendTX.go           # Transaction building & sending
│   ├── Transaction.go      # Transaction struct definitions
│   ├── UTXO.go             # UTXO data structures
│   ├── TXCer.go            # Transaction certificates
│   │
│   ├── core/               # Reusable core package
│   │   ├── keyformat.go    # Key parsing & conversion
│   │   └── util.go         # String utilities
│   │
│   └── cmd/webserver/      # HTTP server entry
│       └── main.go         # Server with static files + API
│
├── assets/                 # Static assets (images)
└── tests/                  # Test files
```

## Architecture Notes

### Frontend (SPA)

- Single `index.html` with hash-based routing (`#/login`, `#/main`, etc.)
- All logic in `app.js` - handles routing, crypto, localStorage, UI
- CSS split by feature/page for maintainability

### Backend (Go)

- Main package in root `backend/` for domain logic
- Reusable utilities in `backend/core/` sub-package
- Web server in `backend/cmd/webserver/` serves both API and static files

### Key Files to Know

| File | Purpose |
|------|---------|
| `app.js` | All frontend logic, routing, crypto operations |
| `backend/core.go` | Signing, hashing, serialization utilities |
| `backend/Account.go` | Account/Wallet/Address data structures |
| `backend/Transaction.go` | Transaction struct and methods |
| `backend/cmd/webserver/main.go` | HTTP server entry point |
