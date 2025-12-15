# Templates 目录说明

此目录包含从 `index.html` 提取的页面模板文件，用于实现动态页面加载。

## 目录结构

```
templates/
├── pages/           # 页面模板
│   ├── welcome.html     # 欢迎页面
│   ├── entry.html       # 钱包管理入口页面
│   └── ...              # 其他页面模板 (待提取)
└── components/      # 共享组件模板 (待创建)
    └── ...
```

## 使用方式

### 当前状态

所有页面目前仍然**同时存在于 `index.html` 中**。这意味着：

1. 应用程序完全正常工作，功能与之前一致
2. 模板文件作为备份存在，可用于未来的动态加载
3. 不会影响现有功能或性能

### 启用动态加载

要启用某个页面的动态加载：

1. 编辑 `js/config/pageTemplates.ts`
2. 找到对应页面的配置
3. 设置 `isDynamic: true` 并添加 `templatePath`
4. （可选）从 `index.html` 中移除该页面的静态 HTML

示例：

```typescript
{
  id: 'welcome',
  containerId: 'welcomeCard',
  displayName: 'Welcome Page',
  isDynamic: true,  // 改为 true
  templatePath: 'pages/welcome.html',  // 添加模板路径
  preload: true
}
```

### 注意事项

1. **i18n 支持**：模板文件中的 `data-i18n` 属性会在加载后自动更新
2. **事件绑定**：页面脚本需要在模板加载后重新绑定事件
3. **缓存**：模板会被缓存，刷新页面后清除
4. **错误处理**：如果模板加载失败，会在控制台输出错误信息

## 开发指南

### 创建新模板

1. 从 `index.html` 复制对应的 `<section>` 元素
2. 保存到 `templates/pages/[page-name].html`
3. 在 `js/config/pageTemplates.ts` 中添加配置
4. 确保所有 `data-i18n` 属性正确

### 测试验证

```bash
# 运行类型检查
npm run typecheck

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 文件列表

| 文件 | 对应页面 | 状态 |
|------|---------|------|
| `pages/welcome.html` | 欢迎页 | ✅ 已创建 |
| `pages/entry.html` | 钱包管理入口 | ✅ 已创建 |
| `pages/new-user.html` | 新建账户 | 待创建 |
| `pages/login.html` | 登录 | 待创建 |
| `pages/import.html` | 导入钱包 | 待创建 |
| `pages/wallet.html` | 主钱包页 | 待创建 |
| `pages/join-group.html` | 加入担保组织 | 待创建 |
| `pages/group-detail.html` | 担保组织详情 | 待创建 |
| `pages/profile.html` | 个人信息 | 待创建 |
| `pages/history.html` | 交易历史 | 待创建 |
