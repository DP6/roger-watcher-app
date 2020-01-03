const { spawn } = require('child_process');
const express = require('express');
const path = require('path');
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const ga_token = 'Hit delivery requested: ';
const firebase_token = /FA-SVC\s*:\s*Event recorded:\s*/;
const instances = {};

app.use(express.static(path.join(__dirname, '/src')));

app.get('/', (_, res) => {
  res.sendFile(__dirname + '/src/panel.html');
});

http.listen(3000, () => {
  console.log('listening on port 3000.');
});

io.on('create_connection', ({ tool, app }) => {
  if (tool === 'universal_analytics') return startGA();
  if (tool === 'firebase_analytics') return startFirebase(app);
});

io.on('end_connection', ({ tool }) => {
  if (tool === 'universal_analytics') return endGA();
  if (tool === 'firebase_analytics') return endFirebase();
});

function startGA() {
  endInstance('ga-debug', 'ga-logcat');

  createADBInstance({
    name: 'ga-debug',
    params: ['shell', 'setprop', 'log.tag.GAv4', 'DEBUG'],
    handler: console.log
  });

  createADBInstance({
    name: 'ga-logcat',
    params: ['logcat'],
    handler: data => {
      const hits = String(data)
        .split('\n')
        .filter(txt => txt.indexOf(ga_token) >= 0)
        .map(txt => {
          console.log(txt);

          return txt
            .split(ga_token)
            .pop()
            .split(', ')
            .reduce((acc, cur) => {
              const [key, value] = cur.split('=');
              acc[key] = value;
              return acc;
            }, {});
        });
      hits.forEach(hit => {
        io.emit('hit sent', { data: hit, tool: 'google_analytics' });
        //console.table(hit);
      });
    }
  });
}

function endGA() {
  endInstance('ga-debug-end');
  createADBInstance({
    name: 'ga-debug-end',
    params: ['shell', 'setprop', 'log.tag.GAv4', 'DEBUG'],
    handler: console.log
  });
}

function startFirebase(app) {
  endInstance('fa-debug', 'fa-verbose', 'fa-verbose-svc', 'fa-main');
  console.log('oi');
  createADBInstance({
    name: 'fa-debug',
    params: ['shell', 'setprop', 'debug.firebase.analytics.app', app],
    handler: console.log
  });
  createADBInstance({
    name: 'fa-verbose',
    params: ['shell', 'setprop', 'log.tag.FA', 'VERBOSE'],
    handler: console.log
  });
  createADBInstance({
    name: 'fa-verbose-svc',
    params: ['shell', 'setprop', 'log.tag.FA-SVC', 'VERBOSE'],
    handler: console.log
  });

  createADBInstance({
    name: 'fa-main',
    params: ['logcat'],
    handler: data => {
      const hits = String(data)
        .split('\n')
        .filter(txt => txt.match(firebase_token))
        .map(txt => {
          //console.log(txt);
          const event = txt
            .split(firebase_token)
            .pop()
            .slice(6, -2);
          const [, bundle] = event.match(/Bundle\[\{(.*)\}\]/);
          const data = event.replace(`Bundle[{${bundle}}]`, '[]');
          const res = { ...parse(data), ...parse(bundle) };

          return res;
        });
      hits.forEach(data => {
        io.emit('hit sent', { data, tool: 'firebase_analytics' });
        //console.table(hit);
      });
    }
  });
}

function parse(txt) {
  return txt.split(', ').reduce((acc, next) => {
    const [key, val] = next.split('=');
    acc[key] = val.replace(/^'|'$/g, '');
    return acc;
  }, {});
}

function endFirebase() {
  endInstance('fa-debug-end');
  createADBInstance({
    name: 'fa-debug-end',
    params: ['shell', 'setprop', 'debug.firebase.analytics.app', '.none.'],
    handler: console.log
  });
}

function createADBInstance({ name, params, handler }) {
  const instance = spawn('adb', params);
  instances[name] = instance;

  console.log(`Creating instance for ${name}`);

  instance.stdout.on('data', handler);

  instance.stderr.on('data', data => {
    console.error(`stderr: ${data}`);
  });

  instance.on('close', code => {
    console.log(`child process exited with code ${code}`);
  });
}

function endInstance(...names) {
  names.forEach(name => {
    const instance = instances[name];
    if (!instance) return;

    console.log(`Killing ${name}...`);
    instance.stdin.pause();
    instance.kill();
    delete instances[name];
    console.log(`${name} killed`);
  });
}

try {
  fs.unlinkSync('teste.txt');
} catch ($$e) {
  console.error($$e);
}

//startFirebase('com.itau.aco');

//startFirebase('com.itaucard.activity');
startGA();
