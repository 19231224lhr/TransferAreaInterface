# TransferAreaInterface 文档

本文档面向项目开发与维护，目标是帮助后续开发快速定位前端结构、接口对接方式，以及当前与 `UTXO-Area` 后端的真实对齐状态。

说明：
- `docs/site/` 是应用内置的文档页内容
- `docs/*.md` 是工程文档，不参与运行时加载
- 当前前后端联调请优先阅读 `docs/07-backend-api-alignment-audit.md`
- `docs/04-api-integration.md` 仍可用于理解旧版接口背景，但不再作为当前协议标准

---

## 快速开始

1. 启动后端 `UTXO-Area`
   - 至少需要 Gateway/BootNode + ComNode
   - 如果要联调组织内交易，还需要对应的 AssignNode
2. 启动前端
   - `npm install`
   - `npm run dev`
   - 打开 `http://localhost:3000`

默认后端地址见 `js/config/api.ts`，也可以通过 `assets/runtime-config.js` 覆盖：

```js
window.__API_BASE_URL__ = 'http://<YOUR_HOST>:3001';
window.__PANGU_DEV__ = true;
```

---

## 推荐阅读顺序

1. `docs/01-core-design-and-ui.md`
   - 业务概念如何落到页面和交互
2. `docs/02-architecture.md`
   - 前端整体架构、路由、状态和服务层分工
3. `docs/03-code-map.md`
   - 代码地图，帮助快速定位功能入口
4. `docs/04-api-integration.md`
   - 旧版接口和序列化背景，适合做历史对照
5. `docs/05-operations.md`
   - 本地联调、部署、排障、验收清单
6. `docs/06-roadmap.md`
   - 后续开发建议与技术演进方向
7. `docs/07-backend-api-alignment-audit.md`
   - 当前最重要的文档
   - 以 `UTXO-Area` 当前后端实现为准，完整列出前后端所有对接接口、兼容状态、修复方案和 UI 影响

---

## 常用入口

- 前端入口：`index.html` -> `runtime-config.js` -> `js/app.js`
- 路由：`js/router.ts`
- 主页面：`js/pages/main.js`
- 接口常量：`js/config/api.ts`
- 账户轮询 / SSE：`js/services/accountPolling.ts`
- 交易构造：`js/services/txBuilder.ts`
- 地址同步：`js/services/address.ts`
- 组织相关：`js/services/group.ts`

---

## 当前对接基线

如果接下来要修前后端联调，请直接把以下文件作为入口：
- `docs/07-backend-api-alignment-audit.md`
- `D:\Code\UTXO-Area\gateway\server.go`
- `D:\Code\UTXO-Area\core\transaction.go`
- `D:\Code\UTXO-Area\core\usernewtx_sig.go`
- `D:\Code\UTXO-Area\core\seedchain.go`
- `D:\Code\UTXO-Area\core\signature.go`
