const { spawn } = require('child_process');
const express = require('express');
const path = require('path');
const app = require('express')();
const http = require('http').createServer(app)
const io = require('socket.io')(http);
const token = 'Hit delivery requested: ';
const debug = spawn('adb', ['shell', 'setprop', 'log.tag.GAv4', 'DEBUG']);
debug.on('close', console.log);

app.use(express.static(path.join(__dirname, '/src')))

app.get('/',(req,res)=>{
  res.sendFile(__dirname + '/src/panel.html');
})

const adb = spawn('adb', ['logcat']);
adb.stdout.on('data', data => {
  const hits = String(data)
    .split('\n')
    .filter(txt => txt.indexOf(token) >= 0)
    .map(txt => {
      console.log(txt);

      return txt
        .split(token)
        .pop()
        .split(', ')
        .reduce((acc, cur) => {
          const [key, value] = cur.split('=');
          acc[key] = value;
          return acc;
        }, {});
    });
  hits.forEach(hit => {
    io.emit('hit sent',hit)
    console.table(hit)
  });
});

adb.stderr.on('data', data => {
  console.error(`stderr: ${data}`);
});

adb.on('close', code => {
  console.log(`child process exited with code ${code}`);
});


http.listen(3000,()=>{
  console.log("listening on port 3000.")
})