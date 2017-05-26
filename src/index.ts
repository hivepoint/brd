import { startServer } from './server';

function start() {
  const port = process.env.PORT || 31111;
  startServer(port);
}

start();
