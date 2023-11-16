import path from 'node:path';
import { cannonBuild } from '@synthetixio/core-modules/test/helpers/cannon';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * > DEBUG=hardhat::plugin::anvil::spawn yarn hardhat dev
 */

task('dev', 'spins up locally 3 nodes ready for test purposes').setAction(async (_, hre) => {
  const nodes = await Promise.all([
    _spinChain({
      hre,
      networkName: 'sepolia',
      cannonfile: 'cannonfile.test.toml',
    }),
    _spinChain({
      hre,
      networkName: 'optimistic-goerli',
      cannonfile: 'cannonfile.satellite.test.toml',
    }),
    _spinChain({
      hre,
      networkName: 'avalanche-fuji',
      cannonfile: 'cannonfile.satellite.test.toml',
    }),
  ]);

  for (const node of nodes) {
    const network = await node.provider.getNetwork();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcUrl = (node.provider.passThroughProvider as any).connection.url;

    console.log();
    console.log(`Network: ${network.name}`);
    console.log(`  cannonfile: ${path.basename(node.options.cannonfile)}`);
    console.log(`  chainId: ${node.options.chainId}`);
    console.log(`  rpc: ${rpcUrl}`);
  }

  await _keepAlive();
});

async function _spinChain({
  hre,
  networkName,
  cannonfile,
  ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
}: {
  hre: HardhatRuntimeEnvironment;
  networkName: string;
  cannonfile: string;
  ownerAddress?: string;
}) {
  if (!hre.config.networks[networkName]) {
    throw new Error(`Invalid network "${networkName}"`);
  }

  const { chainId } = hre.config.networks[networkName];

  if (typeof chainId !== 'number') {
    throw new Error(`Invalid chainId on network ${networkName}`);
  }

  console.log(`  Building: ${cannonfile} - Network: ${networkName}`);

  return await cannonBuild({
    cannonfile: path.join(hre.config.paths.root, cannonfile),
    chainId,
    impersonate: ownerAddress,
    wipe: true,
    getArtifact: async (contractName: string) =>
      await hre.run('cannon:get-artifact', { name: contractName }),
    pkgInfo: require(path.join(hre.config.paths.root, 'package.json')),
    projectDirectory: hre.config.paths.root,
  });
}

function _keepAlive() {
  let running = true;

  const stop = () => {
    running = false;
  };

  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('uncaughtException', stop);

  return new Promise<void>((resolve) => {
    function run() {
      setTimeout(() => {
        running ? run() : resolve();
      }, 10);
    }

    run();
  });
}
