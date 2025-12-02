package main

import (
	corepkg "TransferAreaInterface/backend/core"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"log"
	"net/http"
	"os"
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

func genAccountIdFromHex(hexStr string) string {
	s := strings.TrimSpace(hexStr)
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		s = s[2:]
	}
	s = strings.ToLower(s)
	for len(s) > 0 && s[0] == '0' {
		s = s[1:]
	}
	crc := crc32.ChecksumIEEE([]byte(s))
	num := int(crc%90000000) + 10000000
	return fmt.Sprintf("%08d", num)
}

func handleNewAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	curve := elliptic.P256()
	priv, err := ecdsa.GenerateKey(curve, rand.Reader)
	if err != nil {
		http.Error(w, "generate error", http.StatusInternalServerError)
		return
	}
	xHex := pad64(fmt.Sprintf("%x", priv.PublicKey.X.Bytes()))
	yHex := pad64(fmt.Sprintf("%x", priv.PublicKey.Y.Bytes()))
	uncompressed := elliptic.Marshal(priv.PublicKey.Curve, priv.PublicKey.X, priv.PublicKey.Y)
	h := sha256.Sum256(uncompressed)
	address := fmt.Sprintf("%x", h[:20])
	privHex := fmt.Sprintf("%x", priv.D.Bytes())
	accountId := genAccountIdFromHex(privHex)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(keyResp{AccountId: accountId, Address: address, PrivHex: privHex, PubXHex: xHex, PubYHex: yHex})
}

func main() {
	http.HandleFunc("/api/keys/from-priv", handleFromPriv)
	http.HandleFunc("/api/account/new", handleNewAccount)

	// 自定义文件服务器，确保正确的 charset
	fs := http.FileServer(http.Dir("."))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// 为 HTML、JS、CSS 文件设置正确的 UTF-8 编码
		if strings.HasSuffix(path, ".html") || path == "/" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
		} else if strings.HasSuffix(path, ".js") {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		} else if strings.HasSuffix(path, ".css") {
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
		} else if strings.HasSuffix(path, ".json") {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
		}
		fs.ServeHTTP(w, r)
	})

    port := os.Getenv("PORT")
    if port == "" { port = "8081" }
    addr := ":" + port
    log.Println("Serving frontend on http://localhost:" + port)
    log.Fatal(http.ListenAndServe(addr, nil))
}
