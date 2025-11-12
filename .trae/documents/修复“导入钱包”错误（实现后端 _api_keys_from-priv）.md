## 问题

* 导入钱包时报错“缺少 elliptic 库”，说明：前端请求后端 API 失败后回退到本地计算，但 CDN 不可用或未加载导致回退也失败。

## 方案

* 在 Go 静态服务器中实现 `POST /api/keys/from-priv`：由后端解析私钥 Hex 并返回账户信息，前端无需依赖 CDN 回退。

## 实施步骤

1. 在 `backend/cmd/webserver/main.go` 增加 `http.HandleFunc("/api/keys/from-priv", ...)`。
2. 处理请求：读取 JSON `{ privHex }`，规范化去除 `0x` 前缀与长度校验。
3. 使用 `TransferAreaInterface/backend/core.ParsePrivateKey` 解析为 `ecdsa.PrivateKey`。
4. 计算：

   * 公钥 X/Y 十六进制（长度补齐为 64 位）。

   * 未压缩公钥 `0x04||X||Y` 的 `SHA-256` 前 20 字节作为地址（与 Go 逻辑一致）。

   * 账户 ID：按现有逻辑使用 CRC32(IEEE) 对输入 Hex 映射为 8 位数字。
5. 返回 JSON `{ accountId, address, privHex, pubXHex, pubYHex }`，`Content-Type: application/json`。
6. 重启服务器并在页面“导入钱包”输入你的私钥进行验证。

## 验证点

* 导入按钮返回账户信息，不再弹出“缺少 elliptic 库”。

* 生成的地址与 8 位账户 ID 与前端新建逻辑一致。

## 备选/扩展

* 若需离线运行，不依赖 CDN：后续可将 elliptic 库改为本地文件并静态托管。

