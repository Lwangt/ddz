const { Client } = require('ssh2');
const conn = new Client();

function exec(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve('ERR:' + err.message); return; }
      let out = '';
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => out += d.toString());
      stream.on('close', () => resolve(out));
    });
  });
}

async function main() {
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '47.112.7.97', port: 22, username: 'lwt', password: '123456lwt' });
  });
  console.log('[lwt] 已连接\n');

  // Check iptables/firewall rules for port 8081
  console.log('=== iptables 规则 (8081) ===');
  let r = await exec('sudo iptables -L -n 2>/dev/null | grep -E "8081|Chain" || echo "无法查看iptables"');
  console.log(r.trim());

  // Check if ufw is active
  r = await exec('sudo ufw status 2>/dev/null || echo "ufw not available"');
  console.log('\n=== ufw 状态 ===');
  console.log(r.trim());

  // Check firewalld
  r = await exec('sudo firewall-cmd --list-ports 2>/dev/null || echo "firewalld not available"');
  console.log('\n=== firewalld ===');
  console.log(r.trim());

  // Test if port 8081 is accessible from outside
  console.log('\n=== 外网连通性测试 ===');
  r = await exec('curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://47.112.7.97:8081/ddz/ 2>&1');
  console.log('从服务器自测 8081/ddz/: HTTP ' + r.trim());

  // Check all listening ports
  r = await exec('netstat -tlnp 2>/dev/null | grep -E "8081|3000|80" | head -10');
  console.log('\n=== 监听端口 ===');
  console.log(r.trim());

  conn.end();
}

main().catch(err => { console.error('失败:', err.message); conn.end(); process.exit(1); });
