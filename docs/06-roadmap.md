# 06. Roadmap（后续开发建议与技术债）

这份 roadmap 的目的不是“画饼”，而是让接手者知道：下一步做什么最划算、哪些地方最容易踩坑、哪些重构能显著降低维护成本。

---

## 1. 优先级最高（影响稳定性/验签）

### 1.1 给“签名与序列化”加自动化回归测试

原因：
- 这是最核心、最脆弱的对接点（任何字段顺序/零值/BigInt 处理变动都会导致全链路失败）

建议：
- 在 `tests/` 增加针对 `js/utils/signature.ts` 的用例：
  - 排除字段置零值（而非删除）
  - map 字段排序（AddressMsg/GuarTable）
  - `serializeForBackend()` 的数字字面量输出

### 1.2 统一时间戳策略（避免“接口 A 用 2020 纪元，接口 B 用 Unix”）

当前现状：
- `js/services/group.ts#getTimestamp()`：2020-01-01 纪元
- `js/utils/signature.ts#getTimestamp()`：Unix 秒
- 个别请求手写 `Math.floor(Date.now()/1000)`

建议：
- 以“后端结构体/接口校验逻辑”为准，整理出一张表（哪个接口用哪种时间戳）
- 将时间戳函数收敛到一个模块，并在类型/命名上强制区分（例如 `getUnixSeconds()` / `getBackendEpochSeconds()`）

---

## 2. 中期优化（降低维护成本）

### 2.1 合并重复的签名/序列化逻辑

目前：
- `js/utils/signature.ts` 已实现签名/序列化规则
- `js/services/txBuilder.ts` 内部也有一套 EcdsaSignatureJSON/PublicKeyNewJSON 的处理与序列化细节

建议：
- 把 txBuilder 的“通用签名/序列化”能力下沉复用 `signature.ts`
- txBuilder 只保留“交易结构体拼装与选择算法”

### 2.2 明确并文档化“交易模式矩阵”

建议在 `docs/01-core-design-and-ui.md` 的基础上维护一张表：
- 用户是否入组织
- quick/cross/pledge 三种模式下的：
  - 提交节点（Assign/Com）
  - 是否允许 TXCer
  - 是否需要收款方公钥/组织 ID
  - UI 字段显示/隐藏规则

这样后续新增模式或改限制时不容易误伤。

---

## 3. 体验与可观测性（锦上添花但很值）

### 3.1 给同步系统加可视化状态面板（开发模式）

目标：一眼看出“我到底连上了谁、SSE 是否活着、轮询是否降级、最近一次更新是什么”。

现有基础：
- `js/services/accountPolling.ts#getPollingStatus()`
- `js/services/comNodeEndpoint.ts` 有 status 与监听机制

建议：
- 在 `__PANGU_DEV__ = true` 时显示一个小面板（或 console 结构化输出）

### 3.2 完善错误上报与用户提示

目前 UI 已有 toast/modal，但建议补齐：
- Network error 的重试策略可观测（哪次重试成功/失败）
- 常见后端错误码/错误文本的映射表（避免提示“未知错误”）

---

## 4. 文档维护建议

1) `docs/site/*`（应用内文档）保持“面向用户”，尽量不写实现细节  
2) `docs/*.md`（交接文档）保持“面向开发者”，必须与代码一致  
3) 每次改动后端端口/端点/签名规则，第一时间更新：
   - `js/config/api.ts`
   - `docs/04-api-integration.md`
   - `docs/site/dev-quickstart.*.md`

