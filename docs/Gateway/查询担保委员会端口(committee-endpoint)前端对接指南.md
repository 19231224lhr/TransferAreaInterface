# 查询担保委员会端口（committee-endpoint）前端对接指南

> 目标：前端通过 BootNode 的 HTTP/Gateway 接口，获取**担保委员会 ComNode (Leader) 的 API 端点**，从而能够正确访问 ComNode 提供的各类查询和交易服务。

---

## 背景说明

由于系统采用**多进程、多端口架构**，不同节点类型运行在不同的端口：

| 节点类型 | 默认端口 | 说明 |
|---------|---------|------|
| BootNode | 8080 | 引导节点，提供服务发现 |
| ComNode (Leader) | 8081（动态） | 担保委员会 Leader 节点 |
| AssignNode | 8082+（动态） | 担保组织分配节点 |

ComNode 的端口是**动态分配**的（从 8080 开始查找可用端口），因此前端**不应该硬编码 ComNode 端口**，而应该通过 BootNode 查询。

---

## 接口信息

- **方法**：`GET`
- **路径**：`/api/v1/committee/endpoint`
- **基础 URL**：`http://localhost:8080`（BootNode 固定端口）
- **说明**：
  - 该接口由 **BootNode** 提供。
  - 返回 **ComNode (Leader)** 的 HTTP API 端点。
  - **无需任何参数**，直接 GET 请求即可。
  - **无需签名**：这是公共查询接口。

---

## 适用场景

1. **应用启动时**：初始化服务端点配置
2. **首次访问 ComNode API 前**：获取正确的端点地址
3. **ComNode 503 错误后**：重新查询端点（可能 Leader 切换或端口变更）
4. **缓存失效时**：刷新端点信息

---

## 请求格式

### 请求示例

```http
GET http://localhost:8080/api/v1/committee/endpoint
```

**无需任何参数或请求体。**

### cURL 示例

```bash
curl -X GET "http://localhost:8080/api/v1/committee/endpoint"
```

---

## 响应格式

### 成功响应（HTTP 200）

```json
{
  "success": true,
  "endpoint": ":8081",
  "message": "ComNode (Leader) API endpoint"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| **success** | boolean | 查询是否成功（固定为 `true`） |
| **endpoint** | string | ComNode API 端点地址 |
| **message** | string | 描述信息 |

#### endpoint 字段格式

- **`:8081`**：表示本机的 8081 端口（前端需拼接为 `http://localhost:8081`）
- **`192.168.1.10:8081`**：表示远程机器的 8081 端口（前端需拼接为 `http://192.168.1.10:8081`）

### 失败响应

#### 503 - BootNode 不可用

```json
{
  "error": "BootNode not available"
}
```

**说明**：Gateway 中没有注册 BootNode。

#### 404 - ComNode 未注册

```json
{
  "error": "ComNode (Leader) API endpoint not registered"
}
```

**说明**：ComNode 尚未启动，或者尚未向 BootNode 注册端点。

---

## 推荐前端对接流程

### 方式 1：缓存优先（推荐）

这是**最高效**的方式，避免每次请求都查询端点。

```javascript
// 缓存 ComNode 端点（应用启动时查询一次，后续使用缓存）
class ServiceEndpoints {
  constructor() {
    this.bootNodeURL = 'http://localhost:8080';
    this.comNodeURL = null;
    this.cacheKey = 'comNodeEndpoint';
  }

  // 获取 ComNode 端点（带缓存）
  async getComNodeURL() {
    // 1. 尝试从缓存读取
    if (this.comNodeURL) {
      return this.comNodeURL;
    }

    const cached = localStorage.getItem(this.cacheKey);
    if (cached) {
      this.comNodeURL = cached;
      return cached;
    }

    // 2. 缓存未命中，查询 BootNode
    try {
      const response = await fetch(`${this.bootNodeURL}/api/v1/committee/endpoint`);
      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`);
      }

      const data = await response.json();
      const endpoint = this.normalizeEndpoint(data.endpoint);
      
      // 3. 缓存结果
      this.comNodeURL = endpoint;
      localStorage.setItem(this.cacheKey, endpoint);
      
      return endpoint;
    } catch (error) {
      console.error('获取 ComNode 端点失败:', error);
      throw error;
    }
  }

  // 清除缓存（当 ComNode 不可用时调用）
  clearCache() {
    this.comNodeURL = null;
    localStorage.removeItem(this.cacheKey);
  }

  // 标准化端点格式
  normalizeEndpoint(endpoint) {
    if (endpoint.startsWith(':')) {
      // ":8081" -> "http://localhost:8081"
      return `http://localhost${endpoint}`;
    } else if (!endpoint.startsWith('http')) {
      // "192.168.1.10:8081" -> "http://192.168.1.10:8081"
      return `http://${endpoint}`;
    }
    return endpoint;
  }
}

// 使用示例
const endpoints = new ServiceEndpoints();

async function queryAddress(addresses) {
  const comNodeURL = await endpoints.getComNodeURL();
  
  const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addresses })
  });

  if (response.status === 503) {
    // ComNode 不可用，清除缓存并重试
    endpoints.clearCache();
    throw new Error('ComNode 暂时不可用，请稍后重试');
  }

  return await response.json();
}
```

### 方式 2：应用启动时初始化

在应用启动时获取所有服务端点，存储在全局状态。

```javascript
// 应用启动时调用
async function initializeApp() {
  try {
    // 查询 ComNode 端点
    const response = await fetch('http://localhost:8080/api/v1/committee/endpoint');
    const data = await response.json();
    
    const comNodeURL = data.endpoint.startsWith(':')
      ? `http://localhost${data.endpoint}`
      : `http://${data.endpoint}`;

    // 存储到全局状态（例如 Redux/Vuex/Context）
    store.commit('setComNodeURL', comNodeURL);

    console.log('ComNode 端点已初始化:', comNodeURL);
  } catch (error) {
    console.error('初始化失败:', error);
    // 显示错误提示
  }
}

// 在 main.js 或 App.vue 中调用
initializeApp();
```

### 方式 3：每次请求前查询（不推荐）

这种方式会增加请求延迟，不推荐用于生产环境。

```javascript
async function queryAddress(addresses) {
  // 每次都查询端点
  const endpointResp = await fetch('http://localhost:8080/api/v1/committee/endpoint');
  const endpointData = await endpointResp.json();
  const comNodeURL = `http://localhost${endpointData.endpoint}`;

  // 发送实际请求
  const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
    method: 'POST',
    body: JSON.stringify({ address: addresses })
  });

  return await response.json();
}
```

---

## 完整示例：React Hook

```typescript
import { useState, useEffect } from 'react';

interface ServiceEndpoints {
  bootNode: string;
  comNode: string | null;
}

// 自定义 Hook：管理服务端点
export function useServiceEndpoints() {
  const [endpoints, setEndpoints] = useState<ServiceEndpoints>({
    bootNode: 'http://localhost:8080',
    comNode: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取 ComNode 端点
  const fetchComNodeEndpoint = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${endpoints.bootNode}/api/v1/committee/endpoint`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('ComNode 尚未启动或未注册');
        }
        throw new Error(`查询失败: ${response.status}`);
      }

      const data = await response.json();
      const comNodeURL = data.endpoint.startsWith(':')
        ? `http://localhost${data.endpoint}`
        : `http://${data.endpoint}`;

      setEndpoints(prev => ({ ...prev, comNode: comNodeURL }));
      
      // 缓存到 localStorage
      localStorage.setItem('comNodeEndpoint', comNodeURL);

      return comNodeURL;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 应用启动时自动查询
  useEffect(() => {
    // 先尝试从缓存读取
    const cached = localStorage.getItem('comNodeEndpoint');
    if (cached) {
      setEndpoints(prev => ({ ...prev, comNode: cached }));
      setLoading(false);
    } else {
      fetchComNodeEndpoint();
    }
  }, []);

  // 清除缓存（ComNode 不可用时调用）
  const clearCache = () => {
    localStorage.removeItem('comNodeEndpoint');
    setEndpoints(prev => ({ ...prev, comNode: null }));
  };

  // 刷新端点（手动调用）
  const refresh = async () => {
    clearCache();
    return await fetchComNodeEndpoint();
  };

  return {
    endpoints,
    loading,
    error,
    refresh,
    clearCache
  };
}

// 使用示例
function App() {
  const { endpoints, loading, error, refresh } = useServiceEndpoints();

  if (loading) {
    return <div>正在初始化服务端点...</div>;
  }

  if (error) {
    return (
      <div>
        <p>初始化失败: {error}</p>
        <button onClick={refresh}>重试</button>
      </div>
    );
  }

  return (
    <div>
      <p>BootNode: {endpoints.bootNode}</p>
      <p>ComNode: {endpoints.comNode}</p>
      {/* 其他业务组件 */}
    </div>
  );
}
```

---

## Vue 3 Composition API 示例

```typescript
import { ref, onMounted } from 'vue';

// Composable：管理服务端点
export function useServiceEndpoints() {
  const bootNodeURL = ref('http://localhost:8080');
  const comNodeURL = ref<string | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const fetchComNodeEndpoint = async () => {
    try {
      loading.value = true;
      error.value = null;

      const response = await fetch(`${bootNodeURL.value}/api/v1/committee/endpoint`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('ComNode 尚未启动或未注册');
        }
        throw new Error(`查询失败: ${response.status}`);
      }

      const data = await response.json();
      const endpoint = data.endpoint.startsWith(':')
        ? `http://localhost${data.endpoint}`
        : `http://${data.endpoint}`;

      comNodeURL.value = endpoint;
      localStorage.setItem('comNodeEndpoint', endpoint);

      return endpoint;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const clearCache = () => {
    localStorage.removeItem('comNodeEndpoint');
    comNodeURL.value = null;
  };

  const refresh = async () => {
    clearCache();
    return await fetchComNodeEndpoint();
  };

  onMounted(() => {
    // 先尝试从缓存读取
    const cached = localStorage.getItem('comNodeEndpoint');
    if (cached) {
      comNodeURL.value = cached;
      loading.value = false;
    } else {
      fetchComNodeEndpoint();
    }
  });

  return {
    bootNodeURL,
    comNodeURL,
    loading,
    error,
    refresh,
    clearCache
  };
}
```

---

## 错误处理建议

### 1. ComNode 未注册（404）

```javascript
async function getComNodeEndpoint() {
  const response = await fetch('http://localhost:8080/api/v1/committee/endpoint');
  
  if (response.status === 404) {
    // ComNode 尚未启动，给用户友好提示
    alert('担保委员会节点尚未启动，请稍后重试');
    throw new Error('ComNode 未注册');
  }

  return await response.json();
}
```

### 2. BootNode 不可用（503 或网络错误）

```javascript
async function getComNodeEndpoint() {
  try {
    const response = await fetch('http://localhost:8080/api/v1/committee/endpoint');
    
    if (response.status === 503) {
      throw new Error('BootNode 服务不可用');
    }

    return await response.json();
  } catch (error) {
    // 网络错误或 BootNode 未启动
    alert('无法连接到区块链节点，请检查网络连接或节点是否启动');
    throw error;
  }
}
```

### 3. ComNode 运行时不可用（503）

```javascript
async function queryAddress(addresses) {
  const comNodeURL = await getComNodeEndpoint();

  const response = await fetch(`${comNodeURL}/api/v1/com/query-address`, {
    method: 'POST',
    body: JSON.stringify({ address: addresses })
  });

  if (response.status === 503) {
    // ComNode 可能重启或 Leader 切换
    // 清除缓存，下次重新查询
    localStorage.removeItem('comNodeEndpoint');
    throw new Error('ComNode (Leader) 暂时不可用，请稍后重试');
  }

  return await response.json();
}
```

---

## 缓存策略建议

### 何时缓存

✅ **应该缓存**：
- ComNode 端口在大多数情况下是稳定的
- 避免每次请求都查询 BootNode
- 提升应用响应速度

### 何时清除缓存

❌ **应该清除缓存**：
1. ComNode API 返回 503（Leader 不可用）
2. 用户手动刷新（提供"刷新"按钮）
3. 应用启动时可选择性刷新（如超过 24 小时）
4. ComNode 节点明确提示端口变更

### 缓存实现

```javascript
class EndpointCache {
  constructor(key, ttl = 24 * 60 * 60 * 1000) { // 默认 24 小时
    this.key = key;
    this.ttl = ttl;
  }

  set(value) {
    const data = {
      value,
      timestamp: Date.now()
    };
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  get() {
    const cached = localStorage.getItem(this.key);
    if (!cached) return null;

    try {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      // 超过 TTL，返回 null
      if (age > this.ttl) {
        this.clear();
        return null;
      }

      return data.value;
    } catch {
      return null;
    }
  }

  clear() {
    localStorage.removeItem(this.key);
  }
}

// 使用示例
const cache = new EndpointCache('comNodeEndpoint', 24 * 60 * 60 * 1000);

async function getComNodeURL() {
  // 先从缓存读取
  const cached = cache.get();
  if (cached) {
    return cached;
  }

  // 缓存未命中，查询 BootNode
  const response = await fetch('http://localhost:8080/api/v1/committee/endpoint');
  const data = await response.json();
  const endpoint = `http://localhost${data.endpoint}`;

  // 写入缓存
  cache.set(endpoint);
  return endpoint;
}
```

---

## 常见问题

### 1. 为什么不能直接访问 `http://localhost:8081`？

ComNode 的端口是**动态分配**的，可能是 8081、8082 或其他。如果 8081 被其他服务占用，ComNode 会使用下一个可用端口。因此前端**不应该硬编码端口**。

### 2. 查询端点接口的频率限制？

**无频率限制**，但建议：
- ✅ 应用启动时查询 1 次，缓存结果
- ✅ ComNode 不可用时重新查询
- ❌ 避免每次业务请求都查询（浪费资源）

### 3. 端点格式为什么是 `:8081` 而不是完整 URL？

为了支持**本地和远程部署**：
- 本地开发：`:8081` → `http://localhost:8081`
- 远程部署：`192.168.1.10:8081` → `http://192.168.1.10:8081`

前端需要根据格式自行拼接。

### 4. 如果 BootNode 和 ComNode 在不同机器？

修改 BootNode URL 即可：

```javascript
const bootNodeURL = 'http://192.168.1.100:8080';  // BootNode 地址
const response = await fetch(`${bootNodeURL}/api/v1/committee/endpoint`);
// ComNode 可能返回 "192.168.1.101:8081"
```

### 5. 端点查询失败了怎么办？

**可能的原因**：
1. BootNode 未启动 → 检查 BootNode 是否运行
2. ComNode 未启动 → 等待 ComNode 启动（返回 404）
3. ComNode 未注册 → 等待 2-3 秒后重试（ComNode 启动后 2 秒注册）

**处理建议**：
```javascript
async function getComNodeEndpointWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:8080/api/v1/committee/endpoint');
      
      if (response.ok) {
        const data = await response.json();
        return data.endpoint;
      }

      if (response.status === 404 && i < maxRetries - 1) {
        // ComNode 可能正在启动，等待后重试
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      throw new Error(`查询失败: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
```

### 6. 如何测试端点查询功能？

**测试步骤**：
1. 启动 BootNode
2. 启动 ComNode (Leader)
3. 等待 2-3 秒（ComNode 注册端点）
4. 调用查询接口

**测试命令**：
```bash
# 1. 查询端点
curl http://localhost:8080/api/v1/committee/endpoint

# 预期响应
{
  "success": true,
  "endpoint": ":8081",
  "message": "ComNode (Leader) API endpoint"
}

# 2. 使用查询到的端点访问 ComNode
curl -X POST "http://localhost:8081/api/v1/com/query-address" \
  -H "Content-Type: application/json" \
  -d '{"address": ["abc123..."]}'
```

### 7. 端点信息会变化吗？

**会变化的情况**：
- ComNode 重启并使用不同端口
- Leader 节点切换到另一台机器

**不变的情况**（大多数）：
- ComNode 正常运行
- Leader 节点稳定

因此**推荐缓存端点**，但提供清除缓存的机制。

---

## 最佳实践总结

### ✅ DO（推荐做法）

1. **缓存端点信息**（避免重复查询）
2. **应用启动时查询**（初始化配置）
3. **503 错误时清除缓存**（端点可能变更）
4. **提供手动刷新功能**（给用户控制权）
5. **使用带 TTL 的缓存**（24 小时过期）
6. **记录日志**（方便调试）

### ❌ DON'T（避免做法）

1. ❌ 不要硬编码 ComNode 端口
2. ❌ 不要每次业务请求都查询端点
3. ❌ 不要忽略 404/503 错误
4. ❌ 不要无限缓存（设置 TTL）
5. ❌ 不要在生产环境使用 `localhost`（改为实际 IP）

---

## 完整流程图

```
用户打开应用
    ↓
检查 localStorage 缓存
    ↓
缓存存在? ─── 是 ──→ 使用缓存的端点
    ↓ 否
查询 BootNode: GET /api/v1/committee/endpoint
    ↓
收到响应
    ↓
标准化端点格式 (":8081" → "http://localhost:8081")
    ↓
存入缓存 (localStorage + 内存)
    ↓
使用端点访问 ComNode API
    ↓
503 错误? ─── 是 ──→ 清除缓存，提示用户稍后重试
    ↓ 否
正常使用
```

---

## 相关文档

- [查询账户信息前端对接指南](./查询账户信息(query-address)前端对接指南.md)
- [用户登录前端对接指南](./用户登录(re-online)前端对接指南.md)
- [Node-Requirements.md](./Node-Requirements.md) - 后端接口汇总

---

## 技术支持

如果遇到问题，请检查：
1. BootNode 是否启动（`http://localhost:8080/health`）
2. ComNode 是否启动并注册（查看 ComNode 和 BootNode 终端日志）
3. 网络连接是否正常
4. 浏览器控制台是否有错误信息

