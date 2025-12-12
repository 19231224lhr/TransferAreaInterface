# Design Document: Code Optimization

## Overview

本设计文档描述了 PanguPay 应用的代码优化方案，主要解决三个问题：
1. security.ts 与 i18n 模块的循环依赖
2. Service Worker 缓存策略不够精细
3. 错误边界过滤条件过多导致控制台噪音

## Architecture

### 当前架构问题

```
┌─────────────────┐     直接导入      ┌─────────────────┐
│  security.ts    │ ───────────────→ │  i18n/index.js  │
│                 │                   │                 │
│  (需要翻译函数)  │ ←─────────────── │  (可能依赖安全) │
└─────────────────┘     潜在循环      └─────────────────┘
```

### 优化后架构

```
┌─────────────────┐                   ┌─────────────────┐
│  security.ts    │                   │  i18n/index.js  │
│                 │                   │                 │
│  getT() 延迟    │ ──→ window.t ←── │  导出到 window  │
│  获取翻译函数   │                   │                 │
└─────────────────┘                   └─────────────────┘
```

## Components and Interfaces

### 1. Security Module (js/utils/security.ts)

当前实现已经使用了延迟加载模式，但需要确保：
- 不直接导入 i18n 模块
- 通过 `window.t` 获取翻译函数
- 提供完整的 fallback 文本

```typescript
// 延迟获取翻译函数
function getT(): (key: string, fallback?: string) => string {
  if (!_t) {
    const i18n = (window as any).t;
    if (typeof i18n === 'function') {
      _t = i18n;
    }
  }
  return _t || ((key: string, fallback?: string) => fallback || key);
}
```

### 2. Service Worker (sw.js)

#### 缓存策略分类

| 资源类型 | 策略 | 原因 |
|---------|------|------|
| API 请求 (/api/*) | Network-First | 需要最新数据 |
| JavaScript 文件 | Network-First | 代码可能更新 |
| CSS 文件 | Cache-First | 相对稳定 |
| 图片/字体 | Cache-First | 很少变化 |
| Vite 开发资源 | 完全绕过 | 不应缓存 |

#### 请求处理流程

```
┌─────────────────────────────────────────────────────────┐
│                    Fetch Event                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  是否为 GET 请求？      │
              └────────────────────────┘
                    │           │
                   否           是
                    │           │
                    ▼           ▼
               [不处理]   ┌────────────────────────┐
                         │  是否为同源请求？       │
                         └────────────────────────┘
                               │           │
                              否           是
                               │           │
                               ▼           ▼
                          [不处理]   ┌────────────────────────┐
                                    │  匹配 NEVER_CACHE？     │
                                    └────────────────────────┘
                                          │           │
                                         是           否
                                          │           │
                                          ▼           ▼
                                     [不处理]   ┌────────────────────────┐
                                               │  判断资源类型           │
                                               └────────────────────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          │                         │                         │
                          ▼                         ▼                         ▼
                    ┌──────────┐             ┌──────────┐             ┌──────────┐
                    │ API 请求  │             │ JS 文件   │             │ 静态资源  │
                    └──────────┘             └──────────┘             └──────────┘
                          │                         │                         │
                          ▼                         ▼                         ▼
                   networkFirst()            networkFirstSilent()      cacheFirstSilent()
```

### 3. Error Boundary (js/utils/security.ts)

#### 错误过滤模式

使用正则表达式数组进行模式匹配：

```typescript
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  // 浏览器扩展错误
  /Cannot redefine property: ethereum/i,
  /evmAsk\.js/i,
  /solanaActionsContentScript\.js/i,
  // ... 更多模式
];
```

#### 过滤逻辑

```typescript
function shouldIgnoreError(errorStr: string, filenameStr?: string): boolean {
  const combined = `${errorStr} ${filenameStr || ''}`;
  return IGNORED_ERROR_PATTERNS.some(pattern => pattern.test(combined));
}
```

## Data Models

### ErrorInfo Interface

```typescript
interface ErrorInfo {
  type: 'error' | 'unhandledrejection' | 'caught';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
}
```

### ErrorBoundaryOptions Interface

```typescript
interface ErrorBoundaryOptions {
  showError?: (title: string, message: string) => void;
  logToConsole?: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Translation Fallback Consistency

*For any* validation function call in security.ts when window.t is undefined, the function SHALL return a meaningful fallback string (not empty, not just the key).

**Validates: Requirements 1.2**

### Property 2: Error Pattern Filtering

*For any* error message or filename that matches one of the IGNORED_ERROR_PATTERNS, the shouldIgnoreError function SHALL return true.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Genuine Error Reporting

*For any* error message that does not match any IGNORED_ERROR_PATTERNS, the error boundary SHALL report the error to registered handlers.

**Validates: Requirements 3.5**

### Property 4: Service Worker Strategy Selection

*For any* GET request to the same origin:
- API paths (/api/*) SHALL use networkFirst strategy
- JavaScript files SHALL use networkFirstSilent strategy
- Static assets (CSS, images) SHALL use cacheFirstSilent strategy
- Vite dev resources SHALL be bypassed entirely

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 5: Graceful Error Response

*For any* fetch error in Service Worker, the response SHALL be a valid Response object (not a rejected promise).

**Validates: Requirements 2.5, 2.6**

## Error Handling

### Service Worker Error Handling

1. **网络错误**: 返回缓存响应或 503 状态码
2. **缓存错误**: 静默失败，不影响主流程
3. **API 错误**: 返回 JSON 格式的错误响应

### Error Boundary Error Handling

1. **过滤的错误**: 调用 `event.preventDefault()` 并返回 true
2. **真实错误**: 记录到控制台（如果启用）并报告给处理器
3. **处理器错误**: 捕获并记录，不影响其他处理器

## Testing Strategy

### 单元测试

1. **security.ts 测试**
   - 测试 getT() 在 window.t 未定义时返回 fallback 函数
   - 测试所有验证函数在无翻译时返回有意义的错误消息

2. **错误过滤测试**
   - 测试 shouldIgnoreError() 对各种模式的匹配
   - 测试真实错误不被过滤

### Property-Based Testing

使用 fast-check 库进行属性测试：

1. **Property 1 测试**: 生成随机验证输入，验证 fallback 行为
2. **Property 2 测试**: 生成匹配模式的错误字符串，验证过滤行为
3. **Property 3 测试**: 生成不匹配模式的错误字符串，验证报告行为

### 集成测试

1. 验证应用启动时无循环依赖错误
2. 验证页面刷新时控制台无扩展错误
3. 验证 Service Worker 正确处理各类请求
