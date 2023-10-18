import { spawnSync } from 'node:child_process';
import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { CannonWrapperGenericProvider } from '@usecannon/builder';
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
    '--json',
  ];

  const res = await spawnSync('yarn', args, {
    timeout: 90000,
    env: { ...process.env, ...defaultEnv },
  });

  if (res.error) {
    throw res.error;
  }

  const result = JSON.parse(res.stdout.toString());

  const artifacts = Object.values(result.state)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => s.artifacts)
    .reduce(
      (artifacts, artifact) => {
        if (artifact.imports) Object.assign(artifacts.imports, artifact.imports);
        if (artifact.contracts) Object.assign(artifacts.contracts, artifact.contracts);
        return artifacts;
      },
      { imports: {}, contracts: {} }
    );

  return { artifacts };
}
