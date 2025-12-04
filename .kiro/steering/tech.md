# Technology Stack

## Backend

- **Language**: Go 1.23+
- **Module**: `TransferAreaInterface`
- **Cryptography**: ECDSA P-256 (secp256r1) elliptic curve
- **Serialization**: JSON for struct serialization and hashing

## Frontend

- **Framework**: Vanilla HTML/CSS/JavaScript (no framework)
- **Crypto API**: WebCrypto API for client-side key generation
- **Storage**: localStorage for account persistence
- **Design**: Glassmorphism style with CSS gradients and backdrop-filter

## Web Server

- Built-in Go HTTP server serving static files and API endpoints
- Default port: 8081

## Common Commands

### Start Development Server

```bash
go run ./backend/cmd/webserver/main.go
```

Access at: http://localhost:8081/

### Run Go Tests (if any)

```bash
go test ./...
```

### Build Backend

```bash
go build ./backend/cmd/webserver
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/new` | POST | Create new account with keypair |
| `/api/keys/from-priv` | POST | Derive account from private key |

## Key Libraries/Dependencies

- Standard Go crypto packages (`crypto/ecdsa`, `crypto/elliptic`, `crypto/sha256`)
- No external Go dependencies (pure stdlib)
- No npm/node dependencies for frontend

## Environment Variables

- `PORT`: Server port (default: 8081)
