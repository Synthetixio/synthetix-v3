import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

describe('CollateralConfiguration', () => {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer;

  before('initialize fake collateral config', async () => {
    [owner] = signers();
    await (
      await systems()
        .Core.connect(owner)
        .configureCollateral({
          tokenAddress: ethers.constants.AddressZero,
          oracleNodeId: ethers.utils.formatBytes32String(''),
          issuanceRatioD18: '5000000000000000000',
          liquidationRatioD18: '1500000000000000000',
          liquidationRewardD18: '20000000000000000000',
          minDelegationD18: '20000000000000000000',
          depositingEnabled: true,
        })
    ).wait();
  });

  describe('verifyIssuanceRatio()', async () => {
    it('fails if debt is too low for c-ratio', async () => {
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          ethers.constants.AddressZero,
          100,
          499
        ),
        'InsufficientCollateralRatio("499", "100", "4990000000000000000", "5000000000000000000")',
        systems().Core
      );
    });

    it('succeeds when c-ratio is good', async () => {
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        ethers.constants.AddressZero,
        100,
        500
      );
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        ethers.constants.AddressZero,
        100,
        1000
      );
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        ethers.constants.AddressZero,
        0,
        1000
      );
    });

    it('edge case: fails if positive debt with no collateral', async () => {
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          ethers.constants.AddressZero,
          100,
          0
        ),
        'InsufficientCollateralRatio("0", "100", "0", "5000000000000000000")',
        systems().Core
      );
    });
  });
});
