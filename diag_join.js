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
    conn.on('ready', resolve); conn.on('error', reject);
    conn.connect({ host: '47.112.7.97', port: 22, username: 'lwt', password: '123456lwt' });
  });
  console.log('[lwt] 已连接\n');

  // Test room create+join via nginx proxy
  console.log('=== 通过 8081/ddz/socket.io 测试加入 ===');
  let r = await exec('cd /home/lwt/ddz && node -e "'
    + 'var io=require(\"socket.io-client\");'
    + 'var s1=io(\"http://localhost:8081\",{path:\"/ddz/socket.io\"});'
    + 'var s2=io(\"http://localhost:8081\",{path:\"/ddz/socket.io\"});'
    + 'var ok=false;'
    + 's1.on(\"connect\",function(){s1.emit(\"create_room\",{playerName:\"P1\"});});'
    + 's1.on(\"room_created\",function(d){console.log(\"Room:\",d.roomCode);s2.emit(\"join_room\",{roomCode:d.roomCode,playerName:\"P2\"});});'
    + 's2.on(\"join_confirmed\",function(d){console.log(\"OK joined! Players:\",d.players.length);ok=true;s1.close();s2.close();});'
    + 's2.on(\"error\",function(e){console.log(\"S2 error:\",e.message);});'
    + 's2.on(\"connect_error\",function(e){console.log(\"S2 conn:\",e.message);});'
    + 'setTimeout(function(){if(!ok)console.log(\"TIMEOUT\");process.exit(ok?0:1);},4000);'
    + '" 2>&1');
  console.log(r.trim());
  conn.end();
}
main().catch(err => { console.error('失败:', err.message); conn.end(); process.exit(1); });
