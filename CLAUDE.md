# 斗地主项目 — Claude 行为准则

## 每次修改代码的必做流程

**修改代码 → 本地测试 → git commit → git push → 部署到服务器**

以上步骤全部自动执行，无需询问用户确认。

### 具体步骤
1. 修改代码并完成本地验证
2. `git add -A && git commit -m "描述本次变更"`
3. `git push origin main`（远程地址：`git@github.com:Lwangt/ddz.git`）
4. 部署到阿里云服务器 `47.112.7.97`
   - 项目路径：`/home/lwt/ddz`
   - 用户 `lwt`，密码 `123456lwt`
   - 访问地址：`http://47.112.7.97/ddz/`

## 服务器架构

```
用户浏览器 → :80 (系统 nginx)     → /ddz/* → :8080 (lwt nginx) → :3000 (Node.js)
             :80 (系统 nginx)     → 其他 → 不受影响
```

- **Node.js 服务**（lwt 用户）：端口 3000，`/home/lwt/ddz/server.js`
- **lwt nginx**（lwt 用户）：端口 8080，`/home/lwt/nginx/conf/nginx.conf`
- **系统 nginx**（root）：仅有 1 条 `/ddz/` → `localhost:8080` 代理，不影响其他站点

## 热部署 & 回退

修改代码后，本地测试通过，执行以下命令即可自动部署到服务器：

### 部署（一键热部署）
```bash
node deploy.js
```
自动完成：备份当前版本 → 上传文件 → npm install → PM2 重启 Node 服务 → 验证

### 回退（恢复上一版本）
```bash
node rollback.js
```
自动完成：检查备份 → 恢复文件 → PM2 重启 → 验证

### 手动部署命令速记
```
# scp 上传 + 重启
scp -r e:/code/game/* lwt@47.112.7.97:/home/lwt/ddz/
ssh lwt@47.112.7.97 "cd /home/lwt/ddz && npm install && pm2 restart ddz"
```

## lwt nginx 管理（PM2守护，自动重启）
```
# 查看状态
ssh lwt@47.112.7.97 "pm2 status"
# 重启
ssh lwt@47.112.7.97 "pm2 restart lwt-nginx"
# 日志
ssh lwt@47.112.7.97 "pm2 logs lwt-nginx"
```

## 系统 nginx 配置

`/ddz` 代理配置在 `/etc/nginx/sites-available/default` 中，已用 `chattr +i` 锁定，
**任何进程（包括 root）无法覆盖此文件**。

如需修改，先解锁：`chattr -i /etc/nginx/sites-available/default`，改完再加锁：`chattr +i /etc/nginx/sites-available/default`。

## 需求记录规则

**每次用户提出需求时，必须将需求内容和时间记录到 `CHANGELOG.md` 文件中。**

格式：
```
## YYYY-MM-DD HH:mm
- 用户需求描述
- 处理结果
```

此规则优先级最高，任何对话中用户提出的新需求都需追加记录。

## 项目架构
- 后端：Node.js + Express + Socket.IO（`server.js` + `server/`）
- 前端：HTML5 Canvas（`public/`）
- AI 机器人：`server/bot.js`
- 测试模式：大厅右下角 🤖 按钮
