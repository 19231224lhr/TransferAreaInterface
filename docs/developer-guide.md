# 开发者指南 (Developer Guide)

## 1. 快速上手 (Quick Start)

### 1.1 环境准备
确保你的开发环境满足以下要求：
*   **Node.js**: v18.0.0 或更高版本 (推荐 v20 LTS)
*   **Package Manager**: npm v9+ 或 yarn v1.22+
*   **Editor**: VS Code (推荐安装 ESLint, Prettier, Tailwind CSS IntelliSense 插件)

### 1.2 启动流程
```bash
# 1. 克隆仓库
git clone https://github.com/19231224lhr/TransferAreaInterface.git

# 2. 安装依赖
cd TransferAreaInterface
npm install

# 3. 启动开发服务器 (自动打开浏览器)
npm run dev

# (可选) 运行类型检查
npm run typecheck
```

---

## 2. 核心开发概念 (Core Concepts)

### 2.1 页面系统 (Page System)
本项目不使用 React/Vue 路由，而是基于自研的轻量级路由系统。
*   **注册页面**: 在 `js/config/pageTemplates.ts` 中定义页面 ID 与 HTML 模板路径。
*   **加载逻辑**: `js/router.ts` 监听 hash 变化，调用 `js/utils/templateLoader.ts` 动态 fetch 模板并渲染。
*   **生命周期**: 每个页面模块 (如 `newuser.js`) 都应导出 `init()` 方法，路由切换时会自动调用。

### 2.2 事件委托 (Event Delegation)
为了提升性能，严禁在 HTML 模板中写内联 `onclick`，也不要在页面 `init` 中大量绑定 `.addEventListener`。
*   **推荐做法**: 在元素上添加 `data-action="myAction"` 属性。
*   **处理位置**: 在 `js/core/eventDelegate.ts` 的 `handleGlobalClick` 中统一分发逻辑。

### 2.3 国际化 (i18n)
*   **字典文件**: `js/i18n/zh-CN.js` 和 `js/i18n/en.js`。
*   **静态文本**: HTML 中使用 `<span data-i18n="key.name"></span>`，`updatePageTranslations()` 会自动填充。
*   **动态文本**: JS 中使用 `t('key.name')` 函数获取翻译。

---

## 3. 调试与故障排查 (Debugging)

### 3.1 启用调试模式
在浏览器控制台输入：
```javascript
window.APP_DEBUG = true;
```
开启后，可以在 console 中看到详细的路由跳转日志、API 请求载体以及 WebSocket 心跳包。

### 3.2 常见问题
*   **签名验证失败**: 90% 的情况是因为 JSON 序列化顺序不一致。请检查 `js/services/txBuilder.ts` 中的 `serialize` 字段顺序是否与后端结构体完全一致。
*   **金额显示异常**: 如果看到极大或极小的错误数字，检查是否未使用 `BigInt` 处理金额，或者在 JSON.parse 时丢失了精度。
*   **样式不生效**: 检查 CSS 变量是否在当前主题 (`html[data-theme="dark/light"]`) 下定义正确。

---

## 4. 开发工作流 (Workflow)

1.  **分支管理**:
    *   `main`: 稳定生产分支。
    *   `develop`:日常开发分支。
    *   `feature/xxx`: 新功能分支。
2.  **提交规范**: 遵循 Conventional Commits (e.g., `feat: add cross-chain support`, `fix: resolve utxo locking bug`).
3.  **代码审查**: 提交 PR 前必须通过 `npm run typecheck` 和 `npm run lint`。

---

## 5. 发布流程 (Release)
1.  更新 `package.json` 版本号。
2.  运行 `npm run build` 生成 `dist/`。
3.  本地运行 `npm run preview` 验证构建产物。
4.  打 Tag 并推送至代码仓库。
