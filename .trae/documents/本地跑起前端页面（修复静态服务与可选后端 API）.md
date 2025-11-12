## 目标

* 在本机启动一个可访问的前端页面（<http://localhost:8080），页面包含“新建钱包> / 导入钱包”并完成基础交互。

## 现状与问题

* 当前 Go 静态服务器指向 `./web`，但前端文件位于项目根目录（`index.html`、`app.js`、`style.css`），导致访问 404。

* 前端会尝试 `POST /api/keys/from-priv` 导入私钥；仓库中尚未实现该 API，页面会自动回退到前端本地计算，功能仍可用。

## 实施方案

### 步骤 1：修复静态服务目录

* 修改 `backend/cmd/webserver/main.go`：将 `http.FileServer(http.Dir("./web"))` 改为指向项目根目录 `http.FileServer(http.Dir("."))`。

* 保留端口 `:8080`。

### 步骤 2：为单页路由提供 index.html 回退

* 在 `main.go` 的 `/` 处理器中，若请求路径为 `/` 或对应静态文件不存在，则返回 `index.html`，确保 `#/entry`、`#/new`、`#/import` 刷新可正常加载。

### 步骤 3：启动与验证

* 运行：`go run ./backend/cmd/webserver/main.go`

* 打开：`http://localhost:8080/`

* 验证：

  * 点击“新建钱包”自动生成并显示 Account ID / 地址 / 私钥 / 公钥。

  * 点击“导入钱包”，输入 64 位十六进制私钥，前端会先请求 `/api/keys/from-priv`，失败时自动回退到本地计算并显示结果。

  * 右上角用户栏显示当前账户信息，可“退出登录”。

### 可选：实现导入私钥的后端 API（提升一致性）

* 增加路由：`POST /api/keys/from-priv`

* 行为：接收 `{ privHex }`，使用 `core.ParsePrivateKey` 解析，导出公钥 X/Y、计算未压缩公钥地址（SHA‑256 前 20 字节）、按 CRC32 映射生成 8 位 Account ID，返回 `{ accountId, address, privHex, pubXHex, pubYHex }`。

* 前端将不再回退到本地计算。

### 备选方案：保持 `./web` 目录

* 新建 `web/` 目录并将 `index.html`、`app.js`、`style.css` 移入；保留 `main.go` 指向 `./web`。此方案文件改动较多，但不改服务器逻辑。

## 验证要点

* 资源路径 `/app.js`、`/style.css` 能正确加载，无 404。

* 新建/导入钱包流程运行正常，生成的地址与 8 位 Account ID 与 Go 逻辑一致（未压缩公钥 + SHA‑256 前 20 字节、CRC32 映射）。

* 页面路由在刷新时仍能显示（index.html 回退逻辑生效）。

## 风险与注意

* 依赖 CDN `elliptic@6.5.5`，网络不可用时导入的本地回退将失效；如需完全离线，建议后续移除 CDN 依赖或内联打包。

* 未实现 `/api/keys/from-priv` 时，导入流程依赖前端回退，功能仍可用但不走后端验证。

* 保持 Go 版本为 `1.23` 以兼容编译环境。

