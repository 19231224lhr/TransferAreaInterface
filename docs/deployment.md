# 部署指南

本文档描述如何将 PanguPay 前端部署到 Linux 服务器。

## 目录

- [环境要求](#环境要求)
- [开发模式 vs 生产模式](#开发模式-vs-生产模式)
- [服务器 Git 配置](#服务器-git-配置)
- [部署步骤](#部署步骤)
- [端口配置](#端口配置)
- [常见问题](#常见问题)

---

## 环境要求

| 组件 | 版本要求 |
|:-----|:---------|
| Node.js | >= 18.x |
| npm | >= 9.x |
| Nginx | >= 1.18 |
| Git | >= 2.x |

---

## 开发模式 vs 生产模式

| 特性 | 开发模式 | 生产模式 |
|:-----|:---------|:---------|
| **启动命令** | `npm run dev` | `npm run build` + Nginx |
| **运行时开关** | `__PANGU_DEV__ = true` | `__PANGU_DEV__ = false` |
| **后端地址** | `__API_BASE_URL__ = http://localhost:3001` | `__API_BASE_URL__ = http://服务器IP:3001` |
| **访问地址** | `http://localhost:3000` | `http://服务器IP:3000` |
| **热更新** | ✅ 支持 | ❌ 需重新构建 |
| **代码压缩** | ❌ 未压缩 | ✅ 压缩优化 |

### 切换模式

修改 `assets/runtime-config.js`（构建后也可直接改 `dist/runtime-config.js`）：

```js
// 开发模式
window.__PANGU_DEV__ = true;
window.__API_BASE_URL__ = "http://localhost:3001";

// 生产模式
window.__PANGU_DEV__ = false;
window.__API_BASE_URL__ = "http://服务器IP:3001";
```

### 本地测试（前后端都在本机）

只需把前后端的开发模式打开即可，本地即可完整联调：

1. 前端运行时配置（`assets/runtime-config.js`）：
```js
window.__PANGU_DEV__ = true;
window.__API_BASE_URL__ = "http://localhost:3001";
```
2. 后端配置：在 `UTXO-Area/config.yaml` 的 `runtime` 中设 `dev_mode: true`。
3. 启动后端节点（BootNode → ComNode → 其他节点），然后运行前端：
```bash
npm run dev
```

---

## 服务器 Git 配置

### 1. 生成 SSH 密钥

```bash
# 生成密钥（一路回车即可）
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub
```

### 2. 添加到 GitHub

1. 复制公钥内容
2. 打开 https://github.com/settings/keys
3. 点击 **New SSH key**
4. 粘贴公钥并保存

### 3. 测试连接

```bash
ssh -T git@github.com
# 看到 "Hi xxx! You've successfully authenticated" 说明成功
```

### 4. 克隆仓库

```bash
git clone git@github.com:用户名/TransferAreaInterface.git
cd TransferAreaInterface
```

---

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 修改配置

修改 `assets/runtime-config.js`：

```js
window.__PANGU_DEV__ = false;
window.__API_BASE_URL__ = "http://服务器IP:3001";
```

### 3. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 4. 安装 Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### 5. 配置 Nginx

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/pangupay
```

内容：

```nginx
server {
    listen 3000;
    server_name 服务器IP;
    
    root /home/用户名/TransferAreaInterface/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/pangupay /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. 开放端口

```bash
# 防火墙
sudo ufw allow 3000:3010/tcp

# 云服务商安全组
# 需要在阿里云/腾讯云控制台添加入方向规则：3000-3010 端口
```

### 7. 访问测试

浏览器打开：`http://服务器IP:3000`

---

## 端口配置

| 服务 | 端口 | 说明 |
|:-----|:----:|:-----|
| 前端（Nginx）| 3000 | 用户访问入口 |
| 后端 BootNode | 3001 | API 网关 |
| 后端其他节点 | 3002+ | 内部通信 |

### 后端地址自动识别

前端会按如下优先级选择后端地址：

- `window.__API_BASE_URL__`（如果已配置）
- `__PANGU_DEV__ = true` → `http://localhost:3001`
- `__PANGU_DEV__ = false` → `http://当前域名:3001`

---

## 常见问题

### Q: 访问页面显示空白或 500 错误

**检查**：
```bash
# 查看 Nginx 错误日志
sudo tail -20 /var/log/nginx/error.log

# 检查 dist 目录权限
chmod 755 /home/用户名
chmod -R 755 /home/用户名/TransferAreaInterface
```

### Q: 云服务器无法访问

**原因**：云安全组未开放端口

**解决**：在云控制台添加入方向规则，端口 `3000/3000`，授权对象 `0.0.0.0/0`

### Q: 生成密钥失败

**原因**：HTTP 环境下 `crypto.subtle` 不可用（已在代码中修复）

**解决**：确保使用最新代码版本

### Q: git pull 报错 "divergent branches"

**解决**：
```bash
git pull --rebase
# 或强制覆盖
git fetch origin && git reset --hard origin/main
```

---

## 更新部署

```bash
cd ~/TransferAreaInterface
git pull
npm run build
# Nginx 不需要重启，刷新浏览器即可
```
