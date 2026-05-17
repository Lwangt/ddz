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

  // 1. Check lwt nginx config for socket.io handling
  console.log('=== lwt nginx config ===');
  let r = await exec('cat /home/lwt/nginx/conf/nginx.conf');
  console.log(r);

  // 2. Test Socket.IO connectivity via different paths
  console.log('\n=== Socket.IO 连接测试 ===');
  
  // Direct to Node
  r = await exec('curl -s "http://localhost:3000/socket.io/?EIO=4&transport=polling"');
  console.log('直连 :3000 → ' + r.trim().slice(0, 100));

  // Via lwt nginx
  r = await exec('curl -s "http://localhost:8081/ddz/socket.io/?EIO=4&transport=polling"');
  console.log('lwt nginx :8081/ddz/ → ' + r.trim().slice(0, 100));

  // Via lwt nginx (no /ddz/ prefix)
  r = await exec('curl -s "http://localhost:8081/socket.io/?EIO=4&transport=polling"');
  console.log('lwt nginx :8081 → ' + r.trim().slice(0, 100));

  // 3. Check if PM2 ddz is running 
  console.log('\n=== PM2 状态 ===');
  r = await exec('pm2 list');
  console.log(r.trim());

  // 4. Test creating and joining room via socket.io
  console.log('\n=== 测试房间创建+加入 ===');
  r = await exec('cd /home/lwt/ddz && node -e "'
    + 'const io=require(\"socket.io-client\");'
    + 'const s1=io(\"http://localhost:3000\",{transports:[\"polling\"]});'
    + 'const s2=io(\"http://localhost:3000\",{transports:[\"polling\"]});'
    + 'let roomCode=\"\";'
    + 's1.on(\"connect\",()=>{s1.emit(\"create_room\",{playerName:\"P1\"});});'
    + 's1.on(\"room_created\",(d)=>{roomCode=d.roomCode;console.log(\"Room:\",roomCode);'
    +   's2.emit(\"join_room\",{roomCode:roomCode,playerName:\"P2\"});});'
    + 's2.on(\"join_confirmed\",(d)=>{console.log(\"P2 joined! Players:\",d.players.length);'
    +   's1.close();s2.close();process.exit(0);});'
    + 's1.on(\"error\",(e)=>console.log(\"S1 err:\",e));'
    + 's2.on(\"error\",(e)=>console.log(\"S2 err:\",e));'
    + 'setTimeout(()=>{console.log(\"TIMEOUT\");process.exit(1);},5000);'
    + '" 2>&1');
  console.log(r.trim());

  conn.end();
}

main().catch(err => { console.error('失败:', err.message); conn.end(); process.exit(1); });
