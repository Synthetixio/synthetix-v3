import { cannonBuild, cannonRun } from '@synthetixio/core-modules/test/integration/helpers/cannon';
import { ethers } from 'ethers';
import hre from 'hardhat';

type TestChain = 'sepolia' | 'optimistic-goerli' | 'avalanche-fuji';

interface Chain {
  networkName: TestChain;
  chainId: number;
  provider: ethers.providers.JsonRpcProvider;
}

const ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

export function integrationBootstrap() {
  const chains: Chain[] = [];

  before(`setup chains`, async function () {
    this.timeout(90000);

    /// @dev: show logs with DEBUG=synthetix:core-modules:spawn
    const res = await Promise.all([
      _spinNetwork({
        networkName: 'sepolia',
        cannonfile: 'cannonfile.test.toml',
      }),
      _spinNetwork({
        networkName: 'optimistic-goerli',
        cannonfile: 'cannonfile.satellite.test.toml',
      }),
      _spinNetwork({
        networkName: 'avalanche-fuji',
        cannonfile: 'cannonfile.satellite.test.toml',
      }),
    ]);

    chains.push(...res);
  });

  return { chains };
}

async function _spinNetwork({
  networkName,
  cannonfile,
}: {
  networkName: TestChain;
  cannonfile: string;
}) {
  if (!hre.config.networks[networkName]) {
    throw new Error(`Invalid network "${networkName}"`);
  }

  const { chainId } = hre.config.networks[networkName];

  if (typeof chainId !== 'number') {
    throw new Error(`Invalid chainId on network ${networkName}`);
  }

  console.log(`  Building: ${cannonfile} - Network: ${networkName}`);

  const { packageRef } = await cannonBuild({
    cannonfile,
    networkName,
    chainId,
    impersonate: ownerAddress,
    wipe: true,
  });

  console.log(`  Running: ${packageRef} - Network: ${networkName}`);

  const { provider } = await cannonRun({
    networkName,
    packageRef,
  });

  return { networkName, chainId, provider };
}
