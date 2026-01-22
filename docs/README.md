# TransferAreaInterface 文档

本文档集面向项目开发与维护，目标是：
1) 准确描述「快速转账」在前端的功能与页面构造（担保组织 / 担保委员会 / TXCer / 胶囊地址等在 UI 中的呈现）；  
2) 概览前端代码的关键构造（路由、模板、状态、业务服务、签名/序列化等模块边界）；  
3) 给出可持续迭代的工程指引（扩展入口、风险点与建议的开发顺序）。

> 说明：`docs/site/` 是应用内置「文档页」使用的双语 Markdown（`/#/docs` 会加载它们）。  
> `docs/*.md` 为工程文档（不参与运行时加载）。

---

## 快速开始（本地联调）

1. 启动后端 `UTXO-Area`（至少需要 Gateway/BootNode + ComNode；组织/跨链相关需要 AssignNode/AggrNode 等）
   - 前端默认后端地址：`http://localhost:3001`（见 `js/config/api.ts`）
2. 启动前端
   - `npm install`
   - `npm run dev`
   - 打开 `http://localhost:3000`

### 后端地址如何改

优先改 `assets/runtime-config.js`（部署后也可改 `dist/runtime-config.js`）：

```js
window.__API_BASE_URL__ = "http://<YOUR_HOST>:3001";
window.__PANGU_DEV__ = true; // 或 false
```

`__API_BASE_URL__` 的优先级最高；否则前端会根据 `__PANGU_DEV__` 自动选择 `localhost:3001` 或「当前域名 + :3001」（见 `js/config/api.ts`、`js/config/constants.ts`）。

---

## 推荐阅读顺序

1. `docs/01-core-design-and-ui.md`：核心理念如何落到 UI（担保组织 / 委员会 / TXCer / 胶囊地址 / 交易模式与页面）
2. `docs/02-architecture.md`：前端整体架构与数据流（路由、模板系统、状态、服务层）
3. `docs/03-code-map.md`：代码地图（目录结构 + “要改某功能应该去哪”）
4. `docs/04-api-integration.md`：后端对接与协议关键点（端口、端点、SSE/轮询、签名与序列化对齐）
5. `docs/05-operations.md`：联调/部署/排障/验收清单
6. `docs/06-roadmap.md`：后续开发建议与技术债路线

---

## 你可能还会用到

- 产品内置帮助：`/#/docs`（内容来自 `docs/site/*.md`）
- 前端入口：`index.html` → `js/app.js`
- 路由与页面注册：`js/router.ts`、`js/config/pageTemplates.ts`
