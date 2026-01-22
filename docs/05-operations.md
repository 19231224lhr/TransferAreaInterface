# 05. 联调 / 部署 / 排障

本章用于统一本地联调、部署与排障路径，并提供一份可执行的验收清单。

---

## 1. 本地联调启动清单

### 1.1 前端

- Node.js 18+
- `npm install`
- `npm run dev`
- 打开 `http://localhost:3000`

### 1.2 后端（UTXO-Area）

至少需要：
- BootNode/Gateway（供前端 `API_BASE_URL` 访问，默认 `:3001`）
- ComNode（地址查询、散户交易提交等）

组织/跨链相关需要：
- AssignNode（账户同步、快速交易提交、SSE 推送）
- AggrNode（TXCer 等组织链相关）

> 节点启动顺序、脚本位置等以 `UTXO-Area/docs/` 的后端文档为准。

---

## 2. 配置：后端地址与开发开关

推荐只改 `assets/runtime-config.js`：

```js
window.__API_BASE_URL__ = "http://localhost:3001";
window.__PANGU_DEV__ = true;
```

说明：
- `__API_BASE_URL__` 用于指定 BootNode/Gateway
- `__PANGU_DEV__` 控制开发功能入口是否展示（见 `js/config/constants.ts`）

---

## 3. 常见问题与最快定位

### 3.1 打不开页面/白屏

先看浏览器 Console：
- 是否模板 404（`/templates/pages/...`）
  - 检查 `assets/templates/pages/` 是否存在对应 html
  - 检查 `js/config/pageTemplates.ts` 的 `templatePath`
- 是否 JS chunk 加载失败
  - `npm run dev` 是否成功

### 3.2 “无法连接到区块链节点 / 后端不可用”

按优先级检查：
1) `assets/runtime-config.js` 的 `__API_BASE_URL__` 是否正确  
2) `http://<API_BASE_URL>/health` 是否可访问  
3) ComNode 端点是否可用（前端会查询并缓存）  
   - 清缓存：删除 `localStorage.comNodeEndpoint` 或在 UI 中触发重新初始化（刷新主页面）

相关代码：`js/config/api.ts`、`js/services/comNodeEndpoint.ts`

### 3.3 签名验证失败（最常见）

99% 是序列化/排除字段不一致导致。直接对照：
- `docs/04-api-integration.md` 第 5 节（置零值/只排序 map/X-Y-R-S 数字字面量）
- 实现：`js/utils/signature.ts`

### 3.4 SSE 不工作（组织用户余额不刷新）

排查路径：
1) 组织信息是否包含 `assignAPIEndpoint`（`groupInfo.assignAPIEndpoint`）  
2) `buildAssignNodeUrl()` 拼出来的 URL 是否可访问（浏览器 Network 看 EventSource 连接）  
3) 若跨域报错：
   - 检查 AssignNode CORS
   - 检查 `localhost` 与 `127.0.0.1` 混用（前端已做归一化，但后端返回格式也可能影响）

相关代码：`js/services/accountPolling.ts`、`js/services/group.ts`

### 3.5 TXCer “突然消失/突然变锁定”

这是竞态处理的正常现象，先理解锁管理器：
- `js/services/txCerLockManager.ts`

如果体验有问题：
- 先确认是否是 `draft` 锁超时/缓存更新释放的行为
- 再调整 UI 展示（`js/services/wallet.ts` 里有 TXCer 列表与“锁定”标识）

---

## 4. 部署（最简）

1) 构建：
- `npm run build`

2) 部署静态文件：
- 把 `dist/` 放到 Nginx/静态服务器
- 保证：
  - `index.html` 可访问
  - `runtime-config.js` 可被修改（上线后改后端地址时不需要重新 build）

3) Nginx 注意：
- SPA 需要 `try_files $uri /index.html`
- 前端默认对外端口常用 `:3000`（可自定义）
- 后端 Gateway 常用 `:3001`

---

## 5. 验收清单（建议发布/版本迭代前跑一遍）

### 5.1 基础链路
- 能打开 `/#/welcome` → 创建/导入 → 进入 `/#/main`
- 主页面点击“刷新余额”无报错
- `/#/docs` 正常加载内置文档

### 5.2 组织链路
- `/#/join-group` 能查询组织并发起加入
- 加入后能建立 SSE（出现“已连接到担保组织节点”提示）
- `/#/group-detail` 能查看组织信息并退出

### 5.3 转账链路
- 散户（不入组织）能提交交易并在历史里看到 pending
- 组织用户能提交快速转账并收到状态更新
- 能生成/验证胶囊地址并用于转账
