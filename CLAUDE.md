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

## 部署命令速记
```
# 方式1: 运行 deploy_lwt.js 脚本（推荐）
node deploy_lwt.js

# 方式2: 手动
scp -r e:/code/game/* lwt@47.112.7.97:/home/lwt/ddz/
ssh lwt@47.112.7.97 "pkill -f 'node server.js'; cd /home/lwt/ddz && npm install && nohup node server.js > /home/lwt/ddz.log 2>&1 &"
```

## lwt nginx 管理
```
# 测试配置
ssh lwt@47.112.7.97 "nginx -c /home/lwt/nginx/conf/nginx.conf -t"
# 重启
ssh lwt@47.112.7.97 "pkill -f 'nginx.*lwt'; nginx -c /home/lwt/nginx/conf/nginx.conf"
```

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
