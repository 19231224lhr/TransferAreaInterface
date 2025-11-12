package main

import (
	"log"
	"net/http"
)

func main() {
    // Serve project root so frontend files at top-level are accessible
    fs := http.FileServer(http.Dir("."))
    http.Handle("/", fs)
    log.Println("Serving frontend (root) on http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
