package core

import "strings"

// SplitStringByAmpersand 使用 & 分割字符串，返回 xHex 和 yHex
func SplitStringByAmpersand(in string) (string, string) {
    parts := strings.Split(in, "&")
    if len(parts) != 2 {
        return "", ""
    }
    return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
}