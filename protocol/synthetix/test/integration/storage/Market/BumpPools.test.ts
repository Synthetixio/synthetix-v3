import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { MockMarket } from '../../../../typechain-types/contracts/mocks/MockMarket';
import { bootstrap } from '../../bootstrap';

// thanks to iosiro for providing this test during their audit!
describe('BumpPools', function () {
  const { systems, provider, signers } = bootstrap();

  const ONE = ethers.utils.parseEther('1');

  let owner: ethers.Signer;

  let FakeMarket: MockMarket;

  const fakeMarketId = 2929292;
  const fakePoolIds = [68937, 82739, 2178, 1645, 9310];
  const fakePoolMaxDebtShareValue = [
    ONE.mul(1051),
    ONE.mul(6631),
    ONE.mul(7777),
    ONE.mul(6793),
    ONE.mul(6989),
  ];

  before('init', async () => {
    FakeMarket = await (await hre.ethers.getContractFactory('MockMarket')).deploy();
    await FakeMarket.deployed();

    [owner] = signers();

    await systems().Core.connect(owner).Market_set_marketAddress(fakeMarketId, FakeMarket.address);

    for (const id in fakePoolIds) {
      await systems()
        .Core.connect(owner)
        .Market_adjustPoolShares(
          fakeMarketId,
          fakePoolIds[id],
          ONE.mul(1),
          fakePoolMaxDebtShareValue[id]
        );
    }

    await systems().Core.getMarketDebtPerShare(fakeMarketId);
  });

  const restore = snapshotCheckpoint(provider);

  describe('zero debt', async () => {
    before(restore);

    it('all pools should be in-range', async () => {
      assertBn.equal(
        await systems().Core.callStatic.Market__testOnly_inRangePools(fakeMarketId),
        5
      );
    });
  });

  describe('max', async () => {
    before(restore);

    it('distribute massive debt', async () => {
      await FakeMarket.setReportedDebt(ONE.mul(10000000000000));
      await systems().Core.getMarketDebtPerShare(fakeMarketId);
    });

    it('no pools should be in range', async () => {
      assertBn.equal(
        await systems().Core.callStatic.Market__testOnly_inRangePools(fakeMarketId),
        0
      );
    });

    it('debt reduces, should re-add pools', async () => {
      await FakeMarket.setReportedDebt(0);
      await systems().Core.getMarketDebtPerShare(fakeMarketId);
    });

    it('all pools should be in-range', async () => {
      assertBn.equal(
        await systems().Core.callStatic.Market__testOnly_inRangePools(fakeMarketId),
        5
      );
    });
  });
});
