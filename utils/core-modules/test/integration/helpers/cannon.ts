import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { ethers } from 'ethers';
import { spawn } from './spawn';
import { CannonWrapperGenericProvider } from '@usecannon/builder';

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

interface InspectOptions {
  packageRef: string;
  networkName: string;
  writeDeployments: string;
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
    timeout: 60000,
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

  const provider = new CannonWrapperGenericProvider(
    {},
    new ethers.providers.JsonRpcProvider(node.rpcUrl)
  );

  return { options, packageRef, provider };
}

export async function cannonInspect(options: InspectOptions) {
  const args = [
    'hardhat',
    '--network',
    options.networkName,
    'cannon:inspect',
    options.packageRef,
    '--write-deployments',
    options.writeDeployments,
  ];

  await spawn('yarn', args, {
    timeout: 30000,
    env: { ...defaultEnv },
    waitForText: 'Cannonfile Topology',
  });
}
