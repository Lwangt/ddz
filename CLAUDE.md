# 斗地主项目 — Claude 行为准则

## 每次修改代码的必做流程

**修改代码 → 本地测试 → git commit → git push → 部署到服务器**

### 具体步骤
1. 修改代码并完成本地验证
2. `git add -A && git commit -m "描述本次变更"`
3. `git push origin main`（远程地址：`git@github.com:Lwangt/ddz.git`）
4. 部署到阿里云服务器 `47.112.7.97`（用户 `lwt`，密码 `123456lwt`）
   - 项目路径：`/home/lwt/ddz`
   - 服务管理：`nohup node server.js > /home/lwt/ddz.log 2>&1 &`
   - Nginx 代理：`/ddz/` → `http://localhost:3000/`（已由 root 配置）
   - 访问地址：`http://47.112.7.97/ddz/`

## 部署命令速记
```
# 方式1: 运行 deploy_lwt.js 脚本
node deploy_lwt.js

# 方式2: 手动上传和重启
scp -r e:/code/game/* lwt@47.112.7.97:/home/lwt/ddz/
ssh lwt@47.112.7.97 "pkill -f 'node server.js'; cd /home/lwt/ddz && npm install && nohup node server.js > /home/lwt/ddz.log 2>&1 &"
```

## 项目架构
- 后端：Node.js + Express + Socket.IO（`server.js` + `server/`）
- 前端：HTML5 Canvas（`public/`）
- AI 机器人：`server/bot.js`
- 测试模式：大厅右下角 🤖 按钮
