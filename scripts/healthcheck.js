'use strict';

const http = require('node:http');

const port = Number(process.env.PORT || 8080);
const request = http.get(
  {
    hostname: '127.0.0.1',
    port,
    path: '/health',
    timeout: 3000
  },
  response => {
    response.resume();
    process.exit(response.statusCode >= 200 && response.statusCode < 500 ? 0 : 1);
  }
);

request.on('timeout', () => request.destroy(new Error('timeout')));
request.on('error', () => process.exit(1));
