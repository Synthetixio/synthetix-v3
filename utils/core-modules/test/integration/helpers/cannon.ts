import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { ethers } from 'ethers';
import { spawn } from './spawn';

interface NodeOptions {
  port?: number;
  chainId?: number;
}

interface BuildOptions {
  cannonfile: string;
  networkName: string;
  chainId: number;
  impersonate?: string;
  wipe?: boolean;
}

interface RunOptions {
  packageRef: string;
  networkName: string;
  port?: number;
  impersonate?: string;
}

const defaultEnv = {
  CANNON_REGISTRY_PRIORITY: 'local',
};

export async function launchNode(options: NodeOptions = {}) {
  if (typeof options.port === 'undefined' || options.port === 0) {
    const { default: getPort } = await import('get-port');
    options.port = await getPort();
  }

  const { port } = options;
  const server = await AnvilServer.launch({ launch: true, ...options }, false);
  const rpcUrl = `http://127.0.0.1:${port}/`;

  return { server, port, rpcUrl };
}

export async function cannonBuild(options: BuildOptions) {
  const node = await launchNode({ chainId: options.chainId });

  const args = ['hardhat', '--network', options.networkName, 'cannon:build', options.cannonfile];
  const spawnEnv: { [key: string]: string } = {
    ...defaultEnv,
    NETWORK_ENDPOINT: node.rpcUrl,
  };

  if (options.wipe) args.push('--wipe');
  if (options.impersonate) args.push('--impersonate', options.impersonate);

  let packageRef = '';

  await spawn('yarn', args, {
    env: spawnEnv,
    waitForText: (data) => {
      const m = data.match(/Successfully built package (\S+)/);
      if (!m) return false;
      packageRef = m[1];
      return true;
    },
  });

  if (!packageRef) {
    throw new Error(`Could not build ${options.cannonfile} with --network ${options.networkName}`);
  }

  node.server.kill();

  return { options, packageRef };
}

export async function cannonRun(options: RunOptions) {
  if (!options.port) {
    const { default: getPort } = await import('get-port');
    options.port = await getPort();
  }

  const args = [
    'hardhat',
    '--network',
    options.networkName,
    'cannon:run',
    options.packageRef,
    '--logs',
  ];

  if (options.port) args.push('--port', `${options.port}`);
  if (options.impersonate) args.push('--impersonate', options.impersonate);

  const child = await spawn('yarn', args, {
    env: { ...defaultEnv },
    waitForText: (data) => {
      return data.includes('has been deployed to a local node running');
    },
  });

  const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${options.port}/`);

  // wait until server responds correctly
  const retries = 6; // 3secs
  for (let i = 0; i < retries; i++) {
    try {
      await provider.getNetwork();
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { child, options, provider };
}
