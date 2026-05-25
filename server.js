const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || '0.0.0.0';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'Content-Type': contentType });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const requestedPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(root, requestedPath);

  if (!filePath.startsWith(root)) {
    send(response, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, 'Not found');
      return;
    }

    send(response, 200, data, contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(port, host, () => {
  console.log(`24 点小游戏已启动：http://localhost:${port}`);
  console.log(`局域网访问请使用：http://<本机局域网IP>:${port}`);
});
