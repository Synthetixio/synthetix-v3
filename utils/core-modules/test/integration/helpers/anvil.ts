import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { ethers } from 'ethers';

interface Options {
  port?: number;
  chainId?: number;
}

export async function launchAnvil(options: Options = {}) {
  if (typeof options.port === 'undefined' || options.port === 0) {
    const { default: getPort } = await import('get-port');
    options.port = await getPort();
  }

  const { port } = options;
  const server = await AnvilServer.launch({ launch: true, ...options }, false);

  const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${port}/`);

  return { server, port, provider };
}
