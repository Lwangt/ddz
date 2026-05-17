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

  // Install socket.io-client for testing
  console.log('=== 安装 socket.io-client ===');
  let r = await exec('cd /home/lwt/ddz && npm install socket.io-client 2>&1 | tail -3');
  console.log(r.trim());

  // Test room create + join
  console.log('\n=== 模拟房间创建+加入 ===');
  r = await exec('cd /home/lwt/ddz && node -e "'
    + 'var io=require(\"socket.io-client\");'
    + 'var s1=io(\"http://localhost:3000\");'
    + 'var s2=io(\"http://localhost:3000\");'
    + 'var ok=false;'
    + 's1.on(\"connect\",function(){'
    + '  console.log(\"S1 connected\");'
    + '  s1.emit(\"create_room\",{playerName:\"Alice\"});'
    + '});'
    + 's1.on(\"room_created\",function(d){'
    + '  console.log(\"Room:\",d.roomCode);'
    + '  s2.emit(\"join_room\",{roomCode:d.roomCode,playerName:\"Bob\"});'
    + '});'
    + 's2.on(\"join_confirmed\",function(d){'
    + '  console.log(\"Bob joined! Players:\",d.players.length);'
    + '  ok=true; s1.close(); s2.close();'
    + '});'
    + 's1.on(\"error\",function(e){console.log(\"S1 err:\",e);});'
    + 's2.on(\"error\",function(e){console.log(\"S2 err:\",e);});'
    + 's2.on(\"connect_error\",function(e){console.log(\"S2 connect err:\",e);});'
    + 'setTimeout(function(){if(!ok)console.log(\"TIMEOUT\");process.exit(ok?0:1);},5000);'
    + '" 2>&1');
  console.log(r.trim());

  // Test via lwt nginx proxy
  console.log('\n=== 模拟通过 nginx 8081 加入 ===');
  r = await exec('cd /home/lwt/ddz && node -e "'
    + 'var io=require(\"socket.io-client\");'
    + 'var s1=io(\"http://localhost:8081\",{path:\"/ddz/socket.io\"});'
    + 'var s2=io(\"http://localhost:8081\",{path:\"/ddz/socket.io\"});'
    + 'var ok=false;'
    + 's1.on(\"connect\",function(){'
    + '  console.log(\"S1 connected via 8081\");'
    + '  s1.emit(\"create_room\",{playerName:\"Alice\"});'
    + '});'
    + 's1.on(\"room_created\",function(d){'
    + '  console.log(\"Room:\",d.roomCode);'
    + '  s2.emit(\"join_room\",{roomCode:d.roomCode,playerName:\"Bob\"});'
    + '});'
    + 's2.on(\"join_confirmed\",function(d){'
    + '  console.log(\"SUCCESS! Bob joined via 8081. Players:\",d.players.length);'
    + '  ok=true; s1.close(); s2.close();'
    + '});'
    + 's2.on(\"connect_error\",function(e){console.log(\"S2 connect err:\",e.message);});'
    + 's1.on(\"error\",function(e){console.log(\"err:\",e);});'
    + 's2.on(\"error\",function(e){console.log(\"err:\",e);});'
    + 'setTimeout(function(){if(!ok)console.log(\"TIMEOUT\");process.exit(ok?0:1);},5000);'
    + '" 2>&1');
  console.log(r.trim());

  conn.end();
}

main().catch(err => { console.error('失败:', err.message); conn.end(); process.exit(1); });
