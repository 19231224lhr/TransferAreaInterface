这份文档写给 **开发/测试同学**：帮助你在本地把前后端跑起来，完成联调与问题定位。我们尽量把步骤写得“拿来就能用”。

---

## 1. 项目结构（你现在在哪）
本项目通常包含两部分：
- 前端：`TransferAreaInterface`（Vite + TS，默认端口 3000）
- 后端：`UTXO-Area`（Go，提供 HTTP Gateway，默认端口 8080）

前端默认会请求：`http://localhost:8080`  
对应配置在：`TransferAreaInterface/js/config/api.ts`

---

## 2. 依赖环境
推荐版本（低于也可能可以，但不保证）：
- Node.js 18+（用于前端）
- Go 1.22+（用于后端）
- Windows 用户建议使用 PowerShell（项目提供了 `.ps1` 脚本）

---

## 3. 启动后端（UTXO-Area）

### 3.1 推荐方式：使用脚本启动节点
后端仓库里提供了脚本目录：`UTXO-Area/scripts/`  
常见脚本（Windows / PowerShell）：
- `bootNode.ps1`
- `comNode.ps1`
- `guarNode.ps1`
- `assignNode.ps1`
- `aggrNode.ps1`

一个常见的启动顺序（示例）：
1. 启动 BootNode（引导/服务发现）
2. 启动 ComNode（公共查询、散户交易等）
3. 启动组织相关节点（Guar/Assign/Aggr）用于组织模式与跨链

> 实际需要哪些节点取决于你的测试目标：  
> - 只测普通转账：至少要能跑通 ComNode + Gateway  
> - 要测跨链/质押：需要组织相关节点也启动并注册

### 3.2 如何确认 Gateway 可用？
前端依赖 HTTP Gateway，一般可通过以下方式确认：
- 在浏览器打开：`http://localhost:8080/health`
- 或用命令行请求该地址（返回 OK/JSON 即可）

如果 `/health` 不通：
- 先检查后端进程是否启动
- 再检查端口占用/防火墙
- 最后看后端日志输出（通常会打印监听端口）

---

## 4. 启动前端（TransferAreaInterface）
在前端目录执行：

```bash
cd TransferAreaInterface
npm install
npm run dev
```

启动后打开：
- `http://localhost:3000`

---

## 5. 联调自检清单（建议按顺序）
1. 前端能正常打开，无白屏
2. 主页面点击“刷新余额”没有报错（Network 面板无 4xx/5xx）
3. 组织页面能拉到组织列表（`/api/v1/groups`）
4. 输入收款地址后点击盾牌验证能返回信息（`/api/v1/com/query-address-group`）
5. 构造交易能走到签名/提交（普通用户走 ComNode 提交，组织用户走 AssignNode 提交）

---

## 6. 常用排查路径（最快定位）

### 6.1 前端请求去哪了？
默认在 `TransferAreaInterface/js/config/api.ts`：`API_BASE_URL = http://localhost:8080`

如果你需要临时改后端地址：
- 推荐在本地用反向代理/hosts 方案
- 或在构建前注入 `window.__API_BASE_URL__`（需要在应用加载前设置）

### 6.2 看前端日志
浏览器开发者工具：
- Console：查看错误栈、校验失败原因
- Network：查看 API 是否成功、返回内容是否符合预期

### 6.3 看后端日志
后端通常会输出：
- 节点启动信息（端口、PeerID、角色）
- Gateway 路由与请求日志
- 交易接收与处理日志

如果你需要更完整的链路说明，可以补充阅读：
- 前端：`TransferAreaInterface/docs/frontend-backend-connection.md`
- 后端：`UTXO-Area/docs/`（00-Overview、04-Integration-Guide 等）

---

## 7. 一点小建议（很实用）
- 联调时尽量用“固定的一组测试账号/地址”，避免每次环境不同导致误判。
- 报错时优先复制 Console 日志与 Network 请求信息，比截图更利于定位。
- 如果遇到“偶现/第一次点击不生效”，大概率是 UI 状态与异步数据不同步导致，可先刷新再复现并记录步骤。
