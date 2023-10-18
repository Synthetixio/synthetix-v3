import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { CannonWrapperGenericProvider, ContractArtifact } from '@usecannon/builder';
import { build, inspect, loadCannonfile } from '@usecannon/cli';
import { ethers } from 'ethers';

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
  impersonate?: string;
  wipe?: boolean;
}

interface InspectOptions {
  packageRef: string;
  chainId: number;
  writeDeployments: string;
}

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

  const provider = new CannonWrapperGenericProvider(
    {},
    new ethers.providers.JsonRpcProvider(node.rpcUrl)
  );

  const { name, version, def } = await loadCannonfile(options.cannonfile);

  async function getSigner(addr: string) {
    await provider.send('hardhat_impersonateAccount', [addr]);
    await provider.send('hardhat_setBalance', [addr, `0x${(1e22).toString(16)}`]);
    return provider.getSigner(addr);
  }

  const { outputs } = await build({
    provider,
    def,
    packageDefinition: {
      name,
      version,
      settings: {},
    },
    getArtifact: options.getArtifact,
    getSigner,
    getDefaultSigner: options.impersonate ? () => getSigner(options.impersonate!) : undefined,
    pkgInfo: options.pkgInfo,
    projectDirectory: options.projectDirectory,
    wipe: options.wipe,
    registryPriority: 'local',
    publicSourceCode: false,
  });

  const packageRef = `${name}:${version}`;

  return { packageRef, options, provider, outputs };
}

export async function cannonInspect(options: InspectOptions) {
  return inspect(options.packageRef, options.chainId, '', false, options.writeDeployments);
}
