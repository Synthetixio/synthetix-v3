import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { ContractArtifact, traceActions } from '@usecannon/builder';
import { build, inspect, loadCannonfile, resolveCliSettings } from '@usecannon/cli';
import { getChainById } from '@usecannon/cli/dist/src/chains';
import { ethers } from 'ethers';
import * as viem from 'viem';

import type { ChainBuilderContext } from '@usecannon/builder';
interface NodeOptions {
  port?: number;
  chainId?: number;
}

interface BuildOptions {
  cannonfile: string;
  chainId: number;
  getArtifact: (name: string) => Promise<ContractArtifact>;
  pkgInfo: object;
  projectDirectory: string;
  port?: number;
  impersonate?: string;
  wipe?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: { [key: string]: any };
}

interface InspectOptions {
  packageRef: string;
  chainId: number;
  writeDeployments: string;
}

export type BuildOutputs = Partial<
  Pick<ChainBuilderContext, 'imports' | 'contracts' | 'txns' | 'settings'>
>;
export type CannonProvider = viem.PublicClient & viem.TestClient & viem.WalletClient;

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
  const node = await launchNode({ chainId: options.chainId, port: options.port });

  const providerOptions = {
    mode: 'anvil',
    chain: getChainById(options.chainId),
    transport: viem.http(node.rpcUrl),
  };

  let provider: CannonProvider = viem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .createTestClient(providerOptions as any)
    .extend(viem.walletActions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .extend(viem.publicActions as any);

  const { name, version, def } = await loadCannonfile(options.cannonfile);

  const getSigner = async (addr: viem.Address) => {
    await provider.impersonateAccount({ address: addr });
    await provider.setBalance({ address: addr, value: viem.parseEther('10000') });
    return { address: addr, wallet: provider };
  };

  const { outputs } = await build({
    provider,
    def,
    packageDefinition: {
      name,
      version,
      settings: options.settings || {},
    },
    getArtifact: options.getArtifact,
    getSigner,
    getDefaultSigner: options.impersonate
      ? () => getSigner(options.impersonate! as viem.Address)
      : undefined,
    pkgInfo: options.pkgInfo,
    projectDirectory: options.projectDirectory,
    wipe: options.wipe,
    registryPriority: 'local',
    publicSourceCode: false,
  });

  // Include provider error parsing
  provider = augmentProvider(provider, outputs);

  const packageRef = `${name}:${version}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethersProvider = new ethers.providers.Web3Provider(
    provider
  ) as ethers.providers.Web3Provider;

  return {
    packageRef,
    options,
    provider: ethersProvider,
    outputs,
  };
}

function augmentProvider(originalProvider: CannonProvider, outputs: BuildOutputs) {
  const provider = originalProvider.extend(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    traceActions(outputs) as any
  ) as unknown as CannonProvider;

  // Monkey patch to call original cannon extended estimateGas fn
  const originalRequest = provider.request;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider.request = async function request(args: any) {
    if (args.method === 'eth_estimateGas') {
      return await provider.estimateGas({
        maxFeePerGas: args.params[0].maxFeePerGas,
        maxPriorityFeePerGas: args.params[0].maxPriorityFeePerGas,
        account: args.params[0].from,
        to: args.params[0].to,
        data: args.params[0].data,
        value: args.params[0].value,
      });
    }

    return originalRequest(args);
  } as typeof originalRequest;

  return provider;
}

export async function cannonInspect(options: InspectOptions) {
  const cliSettings = resolveCliSettings();
  return inspect(
    options.packageRef,
    cliSettings,
    options.chainId,
    '',
    false,
    options.writeDeployments,
    true
  );
}
