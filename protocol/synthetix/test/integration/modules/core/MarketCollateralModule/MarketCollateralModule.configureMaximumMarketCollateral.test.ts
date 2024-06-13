import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ContractTransaction, ethers, Signer } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../../bootstrap';

describe('MarketCollateralModule.configureMaximumMarketCollateral()', function () {
  const { signers, systems, marketId, collateralAddress, restore } =
    bootstrapWithMockMarketAndPool();

  let owner: Signer, user1: Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();

    // The owner assigns a maximum of 1,000
    await systems()
      .Core.connect(owner)
      .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000);
  });

  const configuredMaxAmount = ethers.utils.parseEther('1234');

  before(restore);

  it('is only owner', async () => {
    await assertRevert(
      systems()
        .Core.connect(user1)
        .configureMaximumMarketCollateral(marketId(), collateralAddress(), 1000),
      `Unauthorized("${await user1.getAddress()}")`,
      systems().Core
    );
  });

  describe('successful invoke', () => {
    let tx: ContractTransaction;
    before('configure', async () => {
      tx = await systems()
        .Core.connect(owner)
        .configureMaximumMarketCollateral(marketId(), collateralAddress(), configuredMaxAmount);
    });

    it('sets the new configured amount', async () => {
      assertBn.equal(
        await systems().Core.getMaximumMarketCollateral(marketId(), collateralAddress()),
        configuredMaxAmount
      );
    });

    it('only applies the amount to the specified market', async () => {
      assertBn.equal(
        await systems()
          .Core.connect(user1)
          .getMaximumMarketCollateral(marketId().add(1), collateralAddress()),
        0
      );
    });

    it('emits event', async () => {
      await assertEvent(
        tx,
        `MaximumMarketCollateralConfigured(${marketId()}, "${collateralAddress()}", ${configuredMaxAmount}, "${await owner.getAddress()}")`,
        systems().Core
      );
    });
  });
});
