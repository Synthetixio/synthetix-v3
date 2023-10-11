import { ethers } from 'ethers';
import { CcipRouterMock } from '../../typechain-types/contracts/mocks/CcipRouterMock';
import { CcipRouterMock__factory } from '../../typechain-types/factories/contracts/mocks/CcipRouterMock__factory';
import { launchAnvil } from './helpers/anvil';

interface Chain {
  chainId: number;
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
      const { provider } = anvil;

      const signer = provider.getSigner(0);
      const router = await factory.connect(signer).deploy();
      await router.deployTransaction.wait();

      chains[chainId] = {
        chainId,
        provider,
        ccipRouter: router as CcipRouterMock,
      };
    }
  });

  it('do', async function () {
    console.log(chains);
  });
});
