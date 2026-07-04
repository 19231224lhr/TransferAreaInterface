# TransferAreaInterface 文档入口

本文档面向正式前端维护。当前前端已经围绕 `UTXO-Area` 新协议完成对齐，不再使用旧版“地址公钥 + 简单 TXCer 可用集合”的模型。

---

## 当前前端定位

TransferAreaInterface 是转账区正式 Web 钱包：

- 通过 Gateway HTTP/SSE 连接后端。
- 复用后端 TXCer lifecycle、SettlementAuth、CFAA issuance proof、certifier registry、Resource DAG 诊断和 CommitteeQC 查询接口。
- 交易构造逻辑以 `js/services/txBuilder.ts` 为核心，必须和插件保持协议一致。

---

## 推荐阅读顺序

1. [01-core-design-and-ui.md](01-core-design-and-ui.md)
   前端业务概念、页面和 UI 表达。

2. [02-architecture.md](02-architecture.md)
   页面、服务层、状态层和运行时配置。

3. [03-code-map.md](03-code-map.md)
   当前代码入口和改动定位。

4. [04-api-integration.md](04-api-integration.md)
   前端 API 调用背景。具体后端路由以 `UTXO-Area/docs/04-api-integration.md` 和 `js/config/api.ts` 为准。

5. [05-operations.md](05-operations.md)
   本地联调、构建、排障。

6. [06-roadmap.md](06-roadmap.md)
   前端后续优化方向。

`docs/site/` 是应用内展示给用户的帮助文档，不等同于工程协议文档。

---

## 当前最重要的代码入口

| 功能 | 文件 |
| --- | --- |
| API endpoint | `js/config/api.ts` |
| HTTP client | `js/services/api.ts` |
| 交易构造 | `js/services/txBuilder.ts` |
| SettlementAuth | `js/services/settlementAuth.ts` |
| TXCer lifecycle | `js/services/txCerStatus.ts` |
| CFAA issuance/proof | `js/services/txCerIssuance.ts`、`js/services/txCerIssuanceProof.ts` |
| CommitteeQC 诊断 | `js/services/protocolDiagnostics.ts` |
| 账户同步 | `js/services/accountPolling.ts` |
| 本地存储 | `js/utils/storage.ts` |
| 后端类型 | `js/types/blockchain.ts` |
| 签名序列化 | `js/utils/signature.ts` |

---

## 与插件保持一致的内容

这些逻辑必须和 `PanguPayExtension/src/core` 同步维护：

- API endpoint。
- 后端类型。
- Go 签名序列化。
- TXCer 可用性判断。
- SettlementAuth intent hash。
- TXCer issuance proof 验证。
- DApp/普通转账使用同一 TXCer 筛选规则。

修改这些文件后，必须同步跑前端和插件测试。

---

## 基本命令

```powershell
npm install
npm run typecheck
npm test
npm run build
```
