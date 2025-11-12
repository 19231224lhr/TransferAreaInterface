package main

import (
    "log"
    "net/http"
    "os"
    "path/filepath"
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
    log.Printf("Serving static from %s on http://localhost:8080", root)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
