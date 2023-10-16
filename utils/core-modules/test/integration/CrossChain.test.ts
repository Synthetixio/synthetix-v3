import { AnvilServer } from '@foundry-rs/hardhat-anvil/dist/src/anvil-server';
import { ethers } from 'ethers';
import { CcipRouterMock__factory } from '../../typechain-types/factories/contracts/mocks/CcipRouterMock__factory';
import { launchAnvil } from './helpers/anvil';

import type { CcipRouterMock } from '../../typechain-types/contracts/mocks/CcipRouterMock';

interface Chain {
  chainId: number;
  server: AnvilServer;
  provider: ethers.providers.JsonRpcProvider;
  ccipRouter: CcipRouterMock;
}

describe('CrossChain', function () {
  const chains: { [chainId: number]: Chain } = {};

  before('setup chains', async function () {
    const factory = new ethers.ContractFactory(
      CcipRouterMock__factory.abi,
      CcipRouterMock__factory.bytecode
    );

    for (const chainId of [1, 10]) {
      const anvil = await launchAnvil({ chainId });
      const { server, provider } = anvil;
      const signer = provider.getSigner(0);

      // Deploy CcipRouterMock
      const ccipRouter = (await factory.connect(signer).deploy()) as CcipRouterMock;
      await ccipRouter.deployTransaction.wait();

      chains[chainId] = {
        chainId,
        server,
        provider,
        ccipRouter,
      };
    }
  });

  after('stop chain servers', async function () {
    await Promise.all(
      Object.values(chains).map(async (chain) => {
        await chain.server.kill();
        await chain.server.waitUntilClosed();
      })
    );
  });

  it('do', async function () {
    console.log(chains);
    throw 1;
  });
});
