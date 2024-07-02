import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';

interface NodeOptions {
  port?: number;
  chainId?: number;
}

export async function launchCannonNode(options: NodeOptions = {}) {
  if (typeof options.port === 'undefined' || options.port === 0) {
    const { default: getPort } = await import('get-port');
    options.port = await getPort();
  }

  const { port } = options;
  const server = await AnvilServer.launch({ launch: true, ...options }, false);
  const rpcUrl = `http://127.0.0.1:${port}/`;

  return { server, port, rpcUrl };
}
