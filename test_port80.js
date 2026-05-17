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

  // Test port 80 /ddz/
  console.log('=== 测试 80 端口 /ddz/ ===');
  let r = await exec('curl -s http://localhost/ddz/ | head -3');
  console.log('localhost/ddz/:', r.trim().slice(0, 200));

  // Test Socket.IO via port 80
  r = await exec('curl -s "http://localhost/ddz/socket.io/?EIO=4&transport=polling"');
  console.log('\nlocalhost/ddz/socket.io/:', r.trim().slice(0, 100));

  // Check system nginx config for /ddz
  r = await exec('grep -A2 "ddz" /etc/nginx/sites-available/default');
  console.log('\n=== 系统 nginx /ddz 配置 ===');
  console.log(r.trim());

  conn.end();
}

main().catch(err => { console.error('失败:', err.message); conn.end(); process.exit(1); });
