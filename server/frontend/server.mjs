import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import handler from 'serve-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

const portRaw = (process.env.FRONTEND_PORT || process.env.PORT || '').trim();
const port = Number.parseInt(portRaw, 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    `FRONTEND_PORT is invalid: "${portRaw}". Expected integer between 1 and 65535.`,
  );
}

const server = http.createServer((req, res) =>
  handler(req, res, {
    public: distDir,
    rewrites: [{ source: '**', destination: '/index.html' }],
  }),
);

server.listen(port, '0.0.0.0', () => {
  console.log(`Frontend listening on ${port}`);
});
