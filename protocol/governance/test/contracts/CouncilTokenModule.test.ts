import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { CouncilTokenModule } from '../generated/typechain/CouncilTokenModule';
import { bootstrap } from './bootstrap';

describe('CouncilTokenModule', function () {
  const { c, getSigners } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let CouncilToken: CouncilTokenModule;

  before('identify signers', async function () {
    [, user1, user2] = getSigners();
  });

  before('deploy new council token module with ownership', async function () {
    const [owner] = getSigners();
    const proxyFactory = await hre.ethers.getContractFactory(
      '@synthetixio/core-contracts/contracts/proxy/UUPSProxyWithOwner.sol:UUPSProxyWithOwner',
      owner
    );
    const proxy = await proxyFactory.deploy(c.CouncilTokenModule.address, await owner.getAddress());
    CouncilToken = c.CouncilToken.attach(proxy.address);
    await CouncilToken.initialize('Synthetix Governance Module', 'SNXGOV', 'https://synthetix.io');
  });

  it('can mint council nfts', async function () {
    await CouncilToken.mint(await user1.getAddress(), 1);
    await CouncilToken.mint(await user2.getAddress(), 2);
  });

  it('can burn council nfts', async function () {
    await CouncilToken.burn(1);
    await CouncilToken.burn(2);
  });

  it('reverts when trying to transfer', async function () {
    await CouncilToken.mint(await user1.getAddress(), 3);

    await assertRevert(
      CouncilToken.connect(user1).transferFrom(
        await user1.getAddress(),
        await user2.getAddress(),
        3
      ),
      'NotImplemented()'
    );
  });
});
