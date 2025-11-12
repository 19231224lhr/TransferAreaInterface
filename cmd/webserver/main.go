package main

import (
    "log"
    "net/http"
)

func main() {
    fs := http.FileServer(http.Dir("./web"))
    http.Handle("/", fs)
    log.Println("Serving frontend on http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}