package main

import (
	corepkg "TransferAreaInterface/backend/core"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"log"
	"net/http"
	"strings"
)

type keyReq struct {
	PrivHex string `json:"privHex"`
}

type keyResp struct {
	AccountId string `json:"accountId"`
	Address   string `json:"address"`
	PrivHex   string `json:"privHex"`
	PubXHex   string `json:"pubXHex"`
	PubYHex   string `json:"pubYHex"`
}

func pad64(s string) string {
	if len(s) < 64 {
		return strings.Repeat("0", 64-len(s)) + s
	}
	return s
}

func handleFromPriv(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req keyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	normalized := strings.TrimSpace(req.PrivHex)
	if strings.HasPrefix(normalized, "0x") || strings.HasPrefix(normalized, "0X") {
		normalized = normalized[2:]
	}
	if _, err := hex.DecodeString(normalized); err != nil || len(normalized) != 64 {
		http.Error(w, "invalid privHex", http.StatusBadRequest)
		return
	}
	priv, err := corepkg.ParsePrivateKey(normalized)
	if err != nil {
		http.Error(w, "parse error", http.StatusBadRequest)
		return
	}
	xHex := pad64(fmt.Sprintf("%x", priv.PublicKey.X.Bytes()))
	yHex := pad64(fmt.Sprintf("%x", priv.PublicKey.Y.Bytes()))
	uncompressed := elliptic.Marshal(priv.PublicKey.Curve, priv.PublicKey.X, priv.PublicKey.Y)
	h := sha256.Sum256(uncompressed)
	address := fmt.Sprintf("%x", h[:20])
	raw, _ := hex.DecodeString(normalized)
	crc := crc32.ChecksumIEEE(raw)
	num := int(crc%90000000) + 10000000
	accountId := fmt.Sprintf("%08d", num)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(keyResp{
		AccountId: accountId,
		Address:   address,
		PrivHex:   normalized,
		PubXHex:   xHex,
		PubYHex:   yHex,
	})
}

func main() {
	http.HandleFunc("/api/keys/from-priv", handleFromPriv)
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)
	log.Println("Serving frontend on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
