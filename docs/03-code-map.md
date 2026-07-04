# 03. 前端代码地图

本文档用于快速定位正式前端代码。

---

## 1. 顶层结构

| 路径 | 职责 |
| --- | --- |
| `index.html` | 页面骨架、runtime config 注入、入口脚本 |
| `assets/runtime-config.js` | 后端地址和运行模式覆盖 |
| `assets/templates/pages/` | 页面模板 |
| `js/app.js` | 应用启动 |
| `js/router.ts` | hash 路由、模板加载、页面懒加载 |
| `js/config/` | API、页面模板、常量 |
| `js/services/` | 业务服务层 |
| `js/pages/` | 页面逻辑 |
| `js/types/` | 后端协议类型 |
| `js/utils/` | 存储、签名、安全、锁、toast 等 |
| `docs/site/` | 应用内用户文档 |

---

## 2. 后端协议相关入口

| 功能 | 文件 |
| --- | --- |
| API endpoint | `js/config/api.ts` |
| HTTP client | `js/services/api.ts` |
| 后端类型 | `js/types/blockchain.ts` |
| Go 签名序列化 | `js/utils/signature.ts` |
| 本地持久化 | `js/utils/storage.ts` |

新增后端接口时，必须先同步 `js/config/api.ts` 和 `js/types/blockchain.ts`。

---

## 3. 交易构造链路

入口：

- `js/services/transfer.ts`
- `js/services/txBuilder.ts`

`txBuilder.ts` 负责：

- 查询收款地址元数据。
- 选择 UTXO 和 TXCer。
- 构造 seed-chain 输入。
- 构造输出 seed 元数据。
- 附加 SettlementAuth。
- 签 `UserNewTX`。
- 提交 `/assign/submit-tx` 或 `/com/submit-noguargroup-tx`。

相关文件：

- `js/services/settlementAuth.ts`
- `js/services/txCerStatus.ts`
- `js/services/txCerLockManager.ts`
- `js/utils/utxoLock.ts`

---

## 4. TXCer 和 CFAA

| 功能 | 文件 |
| --- | --- |
| TXCer lifecycle 状态 | `js/services/txCerStatus.ts` |
| TXCer 本地构造锁 | `js/services/txCerLockManager.ts` |
| issuance 查询 | `js/services/txCerIssuance.ts` |
| Merkle proof 验证 | `js/services/txCerIssuanceProof.ts` |
| 账户轮询/SSE | `js/services/accountPolling.ts` |

可消费 TXCer 的条件：

```text
后端 lifecycle == Active
&& 本地未锁定
&& issuance proofStatus !== invalid
```

不要再只通过本地 `txCers` 是否存在判断可用性。

---

## 5. 诊断和高级协议

| 功能 | 文件 |
| --- | --- |
| CommitteeQC 查询 | `js/services/protocolDiagnostics.ts` |
| Scheduler DAG 查询 | `js/config/api.ts`、`js/types/blockchain.ts` |
| Certifier registry | `js/services/txCerIssuance.ts` |
| Audit / Challenge / Penalty 类型 | `js/types/blockchain.ts` |

这些接口主要用于诊断和开发，不要求全部在主 UI 暴露。

---

## 6. 页面系统

新增页面步骤：

1. 新增模板：`assets/templates/pages/<page>.html`
2. 注册模板：`js/config/pageTemplates.ts`
3. 新增逻辑：`js/pages/<page>.ts`
4. 注册路由：`js/router.ts`

主页面：

- `js/pages/main.js`
- `js/services/wallet.ts`
- `js/services/address.ts`
- `js/services/group.ts`

---

## 7. 和插件同步维护的文件

前端文件与插件文件大致对应：

| 前端 | 插件 |
| --- | --- |
| `js/config/api.ts` | `src/core/api.ts` |
| `js/types/blockchain.ts` | `src/core/blockchain.ts` |
| `js/services/txBuilder.ts` | `src/core/txBuilder.ts` |
| `js/services/settlementAuth.ts` | `src/core/settlementAuth.ts` |
| `js/services/txCerStatus.ts` | `src/core/txCerStatus.ts` |
| `js/services/txCerIssuance.ts` | `src/core/txCerIssuance.ts` |
| `js/services/txCerIssuanceProof.ts` | `src/core/txCerIssuanceProof.ts` |
| `js/utils/signature.ts` | `src/core/signature.ts` |

修改协议层时不要只改一端。
