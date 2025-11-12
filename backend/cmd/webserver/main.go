package main

import (
    "crypto/sha256"
    "encoding/json"
    "fmt"
    "hash/crc32"
    "log"
    "net/http"
    "os"
    "path/filepath"
    corepkg "TransferAreaInterface/backend/core"
    "regexp"
    "strings"
)

// resolveStaticRoot attempts to locate the project root that contains index.html
func resolveStaticRoot() string {
    // Candidate directories to look for index.html
    candidates := []string{
        ".",           // current working directory
        "../../",      // when running from backend/cmd/webserver
        "../..",       // same as above, different style
    }
    for _, c := range candidates {
        p := filepath.Join(c, "index.html")
        if _, err := os.Stat(p); err == nil {
            abs, _ := filepath.Abs(c)
            return abs
        }
    }
    // Fallback to current directory
    abs, _ := filepath.Abs(".")
    return abs
}

func main() {
    root := resolveStaticRoot()
    fs := http.FileServer(http.Dir(root))
    http.Handle("/", fs)
    // health check endpoint
    http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte("ok"))
    })
    // API: 从私钥 Hex 恢复公钥与地址
    http.HandleFunc("/api/keys/from-priv", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        type req struct{ PrivHex string `json:"privHex"` }
        type resp struct {
            AccountID string `json:"accountId"`
            Address   string `json:"address"`
            PrivHex   string `json:"privHex"`
            PubXHex   string `json:"pubXHex"`
            PubYHex   string `json:"pubYHex"`
        }
        var q req
        if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
            http.Error(w, "bad request", http.StatusBadRequest)
            return
        }
        priv := strings.TrimSpace(q.PrivHex)
        if len(priv) == 0 {
            http.Error(w, "empty privHex", http.StatusBadRequest)
            return
        }
        // 规范化：移除 0x 前缀、大小写忽略，要求恰好 64 位十六进制
        if strings.HasPrefix(priv, "0x") || strings.HasPrefix(priv, "0X") {
            priv = priv[2:]
        }
        if !regexp.MustCompile(`^(?i)[0-9a-f]{64}$`).MatchString(priv) {
            http.Error(w, "invalid privHex format: require 64 hex characters", http.StatusBadRequest)
            return
        }
        // 使用 core 包解析私钥并获取公钥
        pk, err := corepkg.ParsePrivateKey(priv)
        if err != nil {
            http.Error(w, "invalid private key: "+err.Error(), http.StatusBadRequest)
            return
        }
        x := pk.PublicKey.X
        y := pk.PublicKey.Y
        pubXHex := fmt.Sprintf("%064x", x)
        pubYHex := fmt.Sprintf("%064x", y)
        // 未压缩公钥: 0x04 || X || Y（每个坐标填充为32字节）
        xb := x.Bytes()
        yb := y.Bytes()
        // 确保坐标长度为 32 字节（P-256），进行前导零填充
        pad := func(b []byte) []byte {
            if len(b) >= 32 { return b }
            p := make([]byte, 32)
            copy(p[32-len(b):], b)
            return p
        }
        xb = pad(xb)
        yb = pad(yb)
        uncompressed := make([]byte, 1+32+32)
        uncompressed[0] = 0x04
        copy(uncompressed[1:33], xb)
        copy(uncompressed[33:], yb)
        // 地址 = SHA-256(uncompressed)[0..20]
        sha := sha256.Sum256(uncompressed)
        address := hexLower(sha[:20])

        // 账户ID：与后端 Generate8DigitNumberBasedOnInput 保持一致（基于规范化后的私钥）
        hash := crc32.ChecksumIEEE([]byte(priv))
        num := int(hash%90000000) + 10000000
        accountID := fmt.Sprintf("%08d", num)

        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(resp{AccountID: accountID, Address: address, PrivHex: priv, PubXHex: pubXHex, PubYHex: pubYHex})
    })
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("Serving static from %s on http://localhost:%s", root, port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}

// hexLower 将字节切片转为小写十六进制字符串
func hexLower(b []byte) string {
    const hexdigits = "0123456789abcdef"
    out := make([]byte, len(b)*2)
    for i, v := range b {
        out[i*2] = hexdigits[v>>4]
        out[i*2+1] = hexdigits[v&0x0f]
    }
    return string(out)
}
