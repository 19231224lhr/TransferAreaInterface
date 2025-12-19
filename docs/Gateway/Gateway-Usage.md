# Gateway 使用说明（前后端接入指南）

本说明面向前端/测试/后端同学，介绍当前已实现的 HTTP Gateway 的用途、接口、启动方式及扩展方法。

## 1. Gateway 的角色
- **目的**：为外部前端提供 HTTP/JSON 接口，复用节点内部数据，避免直接耦合 P2P 或链上存储。
- **部署形态**：嵌入式。需要对外服务的节点（当前仅 BootNode）在自身 `handle.go` 中按需启动 Gateway。未启动 Gateway 的节点不会暴露任何 HTTP 服务。
- **解耦方式**：Gateway 通过接口（如 `BootNodeInterface`）调用节点内部方法，不直接访问节点结构体字段。

## 2. 当前已实现的接口
| 路径 | 方法 | 提供节点 | 说明 |
| --- | --- | --- | --- |
| `/health` | GET | BootNode（启动了 Gateway 的节点） | 健康检查，返回 `{"status":"ok"}` |
| `/api/v1/group/{id}` | GET | BootNode | 查询担保组织信息，返回 `core.GuarGroupTable` 序列化结果 |

### 2.1 `/api/v1/group/{id}`
- **请求示例**
```bash
curl http://localhost:8080/api/v1/group/10000000
```
- **成功响应示例**
```json
{
  "PeerGroupID": "GroupTopic-DEV",
  "AssiPeerID": "Qm...",
  "AssignPublicKeyNew": { ... },
  "GuarTable": { "78171043": "Qmcm..." },
  "CreateTime": 1727356800
}
```
- **错误响应示例**
```json
{ "error": "the group is not existing" }
```
HTTP 状态码：`404` 查无此组织，`500` 编码或内部错误。

## 3. 前端如何使用
1. **健康检查**：`GET /health`，确认后端已启动。
2. **查询担保组织信息**：`GET /api/v1/group/{id}`。  
   - 浏览器 / Fetch / Axios 直接请求。  
   - 返回 JSON，可直接渲染列表或详情。
3. **CORS 支持**：已启用 `rs/cors`，默认允许任意来源、`GET/POST/OPTIONS`，前端可跨域直接访问。
4. **错误处理**：请对 4xx/5xx 做兜底提示；`error` 字段包含文本描述。

### 3.1 前端调用伪代码（Fetch / Axios 均可）
```javascript
async function fetchGroupInfo(groupId) {
  const url = `http://<SERVER_HOST>:8080/api/v1/group/${groupId}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json(); // 返回的就是 GuarGroupTable 序列化结果
}

// 使用示例
fetchGroupInfo('10000000')
  .then(data => console.log('group info:', data))
  .catch(err => console.error('fetch error:', err));
```

## 4. 后端如何使用
1. **启动节点（以 BootNode 为例）**
   - `go run ./main.go`
   - 在 `Bootstrap/handle.go` 中会自动创建 Gateway，默认监听 `8080`。
2. **优雅关闭**
   - Gateway 通过 `APIGateway.Stop(ctx)` 在节点退出时优雅关闭，无需额外操作。
3. **新增接口的步骤**
   - 在目标节点实现 `XXXForGateway`（或复用现有业务函数），返回可 JSON 序列化的结果与错误。
   - 将方法加入对应的接口定义（如 `BootNodeInterface`）。
   - 在 `gateway/server.go` 的 `routes()` 中注册新路由并编写 handler（注意错误返回及 JSON 编码）。
   - 如需鉴权/限流/日志，可在 `Start` 时包裹自定义中间件。
4. **安全与限流（可选）**
   - 生产环境可在 `gateway/server.go` 中追加 Token 校验、IP 白名单或限流器。
   - 可引入结构化日志、Prometheus 指标以便观测。

### 4.1 后端编写规范（示例模板）
```go
// 1) 在节点侧暴露可供 Gateway 调用的业务函数
func (b *BootNode) ReturnGroupInfoForGateway(groupID string) (core.GuarGroupTable, error) {
    return b.LocalMsg.FindGuarGroup(groupID)
}

// 2) 在接口定义中声明（如 BootNodeInterface）
type BootNodeInterface interface {
    ReturnGroupInfoForGateway(groupID string) (core.GuarGroupTable, error)
}

// 3) 在 gateway/server.go 中注册路由
g.Router.HandleFunc("/api/v1/group/{id}", g.handleGetGroupInfo).Methods("GET")

// 4) 在 handler 中：
//    - 解析参数
//    - 调用节点业务函数
//    - 按统一格式返回 JSON，出错时返回 {error: "..."} 与合理的 HTTP 状态码
func (g *APIGateway) handleGetGroupInfo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    groupID := vars["id"]
    info, err := g.BootNode.ReturnGroupInfoForGateway(groupID)
    if err != nil {
        respondWithError(w, http.StatusNotFound, err.Error())
        return
    }
    respondWithJSON(w, http.StatusOK, info)
}
```

## 5. 常用调试命令
```bash
# 健康检查
curl http://localhost:8080/health

# 查询担保组织
curl http://localhost:8080/api/v1/group/10000000
```

## 6. 规划中的接口（示例）
- `/api/v1/balance?address=...`：查询地址余额（复用 wallet/blockchain 查询逻辑，返回 bigint 数额）。
- 更多接口请按“新增接口的步骤”扩展，并同步更新本文档。

## 7. FAQ
- **如果节点未启动 Gateway，会影响其它节点吗？** 不会。只有调用 `NewAPIGateway(...).Start(port)` 的节点才会开放 HTTP 服务。
- **前端跨域是否可用？** 已全局启用 CORS。若需收紧来源，可在 `cors.Options` 中指定 `AllowedOrigins`。
- **端口冲突怎么办？** 在节点启动处调整 `gw.Start("8080")` 的端口，或做配置化。
- **部署到服务器后，前端如何调用？** 将 `localhost:8080` 替换为服务器的外网地址和网关实际监听端口（例：`http://YOUR_SERVER_IP:8080/api/v1/group/10000000`）。若经过反向代理（Nginx 等），按代理暴露的域名/端口调用即可，路径保持不变。


