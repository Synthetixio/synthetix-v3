import path from 'node:path';
import { cannonBuild } from '@synthetixio/core-utils/utils/bootstrap/cannon-build';
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
    cannonfile: 'cannonfile.sepolia-mothership.test.toml',
    chainSelector: '16015286601757825753',
    wormholeChainId: '10002',
  },
  {
    name: 'satellite1',
    networkName: 'optimistic-sepolia',
    cannonfile: 'cannonfile.optimistic-sepolia-satelite.test.toml',
    chainSelector: '2664363617261496610',
    wormholeChainId: '10005',
  },
  {
    name: 'satellite2',
    networkName: 'avalanche-fuji',
    cannonfile: 'cannonfile.avalanche-fuji-satelite.test.toml',
    chainSelector: '14767482510784806043',
    wormholeChainId: '43113',
  },
] as const;

task('dev', 'spins up locally 3 nodes ready for test purposes')
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

    for (const [index, config] of Object.entries(chains)) {
      const chain = nodes[index as unknown as number]!;

      console.log();
      console.log(`Chain: ${config.name}`);
      console.log(`  cannonfile: ${path.basename(chain.options.cannonfile)}`);
      console.log(`  network: ${config.networkName}`);
      console.log(`  chainId: ${chain.options.chainId}`);
      console.log(`  rpc: ${chain.node.rpcUrl}`);
      console.log(`  GovernanceProxy: ${chain.outputs.contracts?.GovernanceProxy.address}`);

      const wormholeMockAddress = chain.outputs.contracts!.WormholeMock.address;

      // Ensure govProxy is an instance of an ethers.Contract
      const wormholeMock = new ethers.Contract(
        wormholeMockAddress,
        chain.outputs.contracts!.WormholeMock.abi as ethers.ContractInterface, // Replace this with the actual ABI of the contract
        chain.provider
      );

      wormholeMock
        .connect(chain.provider)
        .attach(wormholeMock.address)
        .on('LogMessagePublished', async (evt: ethers.Event) => {
          const emitterAddress = chain.outputs.contracts!.GovernanceProxy.address;

          const encodedValue = ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint16', 'uint64'], // Types
            [emitterAddress, config.wormholeChainId, evt.args?.sequence] // Values
          );

          const payloadTypes = [
            'uint16', // targetChain
            'uint16', // wormholeChainId
            'address', // targetAddress
            'address', // emitterAddress
            'uint64', // sequence
            'bytes', // payload
            'uint256', // receiverValue
            'uint256', // gasLimit
          ];

          const decodedPayload = ethers.utils.defaultAbiCoder.decode(
            payloadTypes,
            evt.args?.payload
          );

          const targetChainIndex = chains.findIndex(
            (c) => c.wormholeChainId === decodedPayload.targetChain.toString()
          );
          const targetNode = nodes[targetChainIndex];

          const targetWormholeMock = new ethers.Contract(
            targetNode.outputs.contracts!.WormholeMock.address,
            targetNode.outputs.contracts!.WormholeMock.abi as ethers.ContractInterface,
            targetNode.provider
          );

          await targetWormholeMock.deliver([encodedValue], decodedPayload, emitterAddress, []);
        });
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
