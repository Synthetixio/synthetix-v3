// TODO: is this file just a duplicate of the old dev.ts file in the protocol/governance directory?
import path from 'node:path';
import { cannonBuild } from '@synthetixio/core-modules/test/helpers/cannon';
import { ccipReceive, CcipRouter } from '@synthetixio/core-modules/test/helpers/ccip';
import { ethers } from 'ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * > DEBUG=hardhat::plugin::anvil::spawn yarn hardhat dev
 */

const chains = [
  {
    name: 'mothership',
    networkName: 'sepolia',
    cannonfile: 'cannonfile.test.toml',
    chainSelector: '16015286601757825753',
  },
  {
    name: 'satellite1',
    networkName: 'optimistic-goerli',
    cannonfile: 'cannonfile.satellite.test.toml',
    chainSelector: '2664363617261496610',
  },
] as const;

task('dev', 'spins up locally 2 nodes ready for test purposes')
  .addOptionalParam(
    'owner',
    'Wallet address to use as signer',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
  )
  .addOptionalParam(
    'port',
    'custom port for chains to run on, increments for satellite chains by 1',
    '19000'
  )
  .setAction(async ({ owner, port }, hre) => {
    const nodes = await Promise.all(
      chains.map(({ networkName, cannonfile }, index) =>
        _spinChain({
          hre,
          networkName,
          cannonfile,
          ownerAddress: owner,
          port: Number(port) + index,
        })
      )
    );

    for (const [index, chain] of Object.entries(chains)) {
      const node = nodes[index as unknown as number]!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpcUrl = (node.provider.passThroughProvider as any).connection.url;

      console.log();
      console.log(`Chain: ${chain.name}`);
      console.log(`  cannonfile: ${path.basename(node.options.cannonfile)}`);
      console.log(`  network: ${chain.networkName}`);
      console.log(`  chainId: ${node.options.chainId}`);
      console.log(`  rpc: ${rpcUrl}`);
      console.log(`  GovernanceProxy: ${node.outputs.contracts?.GovernanceProxy.address}`);

      // Listen for cross chain message send events, and pass it on to the target network
      CcipRouter.connect(node.provider)
        .attach(node.outputs.contracts!.CcipRouterMock.address)
        .on(
          'CCIPSend',
          async (chainSelector: string, message: string, messageId: string, evt: ethers.Event) => {
            console.log('CCIPSend', { chainSelector, message, messageId });

            const targetChainIndex = chains.findIndex((c) => c.chainSelector === chainSelector);
            const targetChain = chains[targetChainIndex]!;
            const targetNode = nodes[targetChainIndex]!;

            const rx = await node.provider.getTransactionReceipt(evt.transactionHash);
            const targetSigner = targetNode.provider.getSigner(owner);

            await ccipReceive({
              rx,
              sourceChainSelector: targetChain.chainSelector,
              targetSigner,
              ccipAddress: targetNode.outputs.contracts!.CcipRouterMock.address,
            });
          }
        );
    }

    await _keepAlive();
  });

async function _spinChain({
  hre,
  networkName,
  cannonfile,
  ownerAddress,
  port,
}: {
  hre: HardhatRuntimeEnvironment;
  networkName: string;
  cannonfile: string;
  ownerAddress: string;
  port: number;
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
    port,
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
