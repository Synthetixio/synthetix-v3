import { ethers } from 'ethers';
import { ChainSelector, integrationBootstrap } from './bootstrap';
import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

  const nftToken = { tokenName: 'TESTNFT', tokenSymbol: '$TN', uri: 'https://google.com' };

  let voterOnSatelliteOPGoerli: ethers.Wallet;
  let voterOnSatelliteAvalancheFuji: ethers.Wallet;

  async function _fixtureSignerOnChains() {
    const signers = await Promise.all(
      chains.map(async (chain) => {
        const { address, privateKey } = ethers.Wallet.createRandom();
        await chain.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
        return new ethers.Wallet(privateKey, chain.provider);
      })
    );
    return signers;
  }

  before('set up voters', async () => {
    const result = await _fixtureSignerOnChains();
    voterOnSatelliteOPGoerli = result[1];
    voterOnSatelliteAvalancheFuji = result[2];
  });

  before('setup election cross chain state', async () => {
    const [mothership] = chains;
    const tx1 = await mothership.CoreProxy.initElectionModuleSatellite(420);
    const rx1 = await tx1.wait();
    const tx2 = await mothership.CoreProxy.initElectionModuleSatellite(43113);
    const rx2 = await tx2.wait();

    await ccipReceive({
      rx: rx1,
      sourceChainSelector: ChainSelector.Sepolia,
      targetSigner: voterOnSatelliteOPGoerli,
      ccipAddress: mothership.CcipRouter.address,
    });

    await ccipReceive({
      rx: rx2,
      sourceChainSelector: ChainSelector.Sepolia,
      targetSigner: voterOnSatelliteAvalancheFuji,
      ccipAddress: mothership.CcipRouter.address,
    });
  });

  it('NFT Module is not initialized', async () => {
    const [, satellite1, satellite2] = chains;
    assert.equal(await satellite1.CoreProxy.isInitialized(), false);
    assert.equal(await satellite2.CoreProxy.isInitialized(), false);
  });

  it('distributes NFTS after election', async () => {
    const [, satellite1, satellite2] = chains;
    await satellite1.CoreProxy.initialize(nftToken.tokenName, nftToken.tokenSymbol, nftToken.uri);
    await satellite2.CoreProxy.initialize(nftToken.tokenName, nftToken.tokenSymbol, nftToken.uri);
    assert.equal(await satellite1.CoreProxy.isInitialized(), true);
    assert.equal(await satellite2.CoreProxy.isInitialized(), true);
  });

  it('lets owner mint nft', async () => {
    const [, satellite1, satellite2] = chains;
    await satellite1.CoreProxy.mint(await satellite1.signer.getAddress(), 1);
    await satellite2.CoreProxy.mint(await satellite2.signer.getAddress(), 1);

    assert.equal(
      (await satellite1.CoreProxy.balanceOf(await satellite1.signer.getAddress())).toString(),
      '1'
    );
    assert.equal(
      (await satellite2.CoreProxy.balanceOf(await satellite2.signer.getAddress())).toString(),
      '1'
    );
  });

  it('lets owner burn nft', async () => {
    const [, satellite1, satellite2] = chains;
    await satellite1.CoreProxy.burn(1);
    await satellite2.CoreProxy.burn(1);

    assert.equal(
      (await satellite1.CoreProxy.balanceOf(await satellite1.signer.getAddress())).toString(),
      '0'
    );
    assert.equal(
      (await satellite2.CoreProxy.balanceOf(await satellite2.signer.getAddress())).toString(),
      '0'
    );
  });

  it('random user cant mint', async () => {
    const [, satellite1, satellite2] = chains;
    const { privateKey, address } = ethers.Wallet.createRandom();
    await satellite1.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
    await satellite2.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
    const randomUser = new ethers.Wallet(privateKey, satellite1.provider);
    await assertRevert(
      satellite1.CoreProxy.connect(randomUser).mint(await satellite1.signer.getAddress(), 1),
      'Unauthorized'
    );
    randomUser.connect(satellite2.provider);
    await assertRevert(
      satellite2.CoreProxy.connect(randomUser).mint(await satellite2.signer.getAddress(), 1),
      'Unauthorized'
    );
  });
});
