import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';
import hre from 'hardhat';

describe('CollateralConfiguration', function () {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer;

  let fakeCollateral: ethers.Contract;

  const ONE = ethers.utils.parseEther('1');
  const ONE_HUNDRED = ONE.mul(10).mul(10);

  const initFakeCollateralConfig = async (decimals: number) => {
    [owner] = signers();

    const CollateralMock = await hre.ethers.getContractFactory('CollateralMock');
    fakeCollateral = await CollateralMock.deploy();

    await fakeCollateral.deployed();
    await fakeCollateral.initialize('token', 'TOKEN', decimals);
    await (
      await systems()
        .Core.connect(owner)
        .configureCollateral({
          tokenAddress: fakeCollateral.address,
          oracleNodeId: ethers.utils.formatBytes32String(''),
          issuanceRatioD18: '5000000000000000000',
          liquidationRatioD18: '1500000000000000000',
          liquidationRewardD18: '20000000000000000000',
          minDelegationD18: '20000000000000000000',
          depositingEnabled: true,
        })
    ).wait();
  };

  describe('verifyIssuanceRatio()', async () => {
    before('initialize fake collateral config', async () => {
      await initFakeCollateralConfig(18);
    });

    it('fails if debt is too low for c-ratio', async () => {
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          fakeCollateral.address,
          100,
          499,
          0
        ),
        'InsufficientCollateralRatio("499", "100", "4990000000000000000", "5000000000000000000")',
        systems().Core
      );

      // default to system issuanceRatioD18
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          fakeCollateral.address,
          100,
          499,
          ONE.mul(3)
        ),
        'InsufficientCollateralRatio("499", "100", "4990000000000000000", "5000000000000000000")',
        systems().Core
      );

      // override with minIssuanceRatioD18
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          fakeCollateral.address,
          100,
          500,
          ONE.mul(6)
        ),
        'InsufficientCollateralRatio("500", "100", "5000000000000000000", "6000000000000000000")',
        systems().Core
      );
    });

    it('succeeds when c-ratio is good', async () => {
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        fakeCollateral.address,
        100,
        500,
        0
      );
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        fakeCollateral.address,
        100,
        1000,
        0
      );
      await systems().Core.CollateralConfiguration_verifyIssuanceRatio(
        fakeCollateral.address,
        0,
        1000,
        0
      );
    });

    it('edge case: fails if positive debt with no collateral', async () => {
      await assertRevert(
        systems().Core.CollateralConfiguration_verifyIssuanceRatio(
          fakeCollateral.address,
          100,
          0,
          0
        ),
        'InsufficientCollateralRatio("0", "100", "0", "5000000000000000000")',
        systems().Core
      );
    });
  });

  describe('convertTokenToSystemAmount()', async () => {
    describe('scaling tokens with 0 decimals to system amount', async () => {
      it('reverts', async function () {
        const CollateralMock = await hre.ethers.getContractFactory('CollateralMock');
        fakeCollateral = await CollateralMock.deploy();
        await fakeCollateral.deployed();

        await assertRevert(
          fakeCollateral.initialize('token', 'TOKEN', 0),
          'InvalidParameter("tokenName|tokenSymbol|tokenDecimals", "At least one is zero")',
          fakeCollateral
        );
      });
    });

    describe('scaling tokens with 6 decimals to system amount', async () => {
      const DECIMALS = 6;

      before('initialize fake collateral config', async () => {
        await initFakeCollateralConfig(DECIMALS);
      });

      it('correctly scales token', async () => {
        const amountD18 = await systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
          fakeCollateral.address,
          ONE
        );

        const expectedAmountD18 = ONE.mul(ethers.BigNumber.from(10).pow(18)).div(
          ethers.BigNumber.from(10).pow(DECIMALS)
        );

        // expect 1 * 10^30
        assertBn.equal(amountD18, expectedAmountD18);
      });
    });

    describe('scaling tokens with 18 decimals to system amount', async () => {
      const DECIMALS = 18;

      before('initialize fake collateral config', async () => {
        await initFakeCollateralConfig(DECIMALS);
      });

      it('correctly scales token', async () => {
        const amountD18 = await systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
          fakeCollateral.address,
          ONE
        );

        const expectedAmountD18 = ONE.mul(ethers.BigNumber.from(10).pow(18)).div(
          ethers.BigNumber.from(10).pow(DECIMALS)
        );

        // expect 1 * 10^18
        assertBn.equal(amountD18, expectedAmountD18);
      });
    });

    describe('scaling tokens with greater than 18 decimals to system amount', async () => {
      const DECIMALS = 20;

      before('initialize fake collateral config', async () => {
        await initFakeCollateralConfig(DECIMALS);
      });

      it('correctly scales token', async () => {
        const amountD18 = await systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
          fakeCollateral.address,
          ONE_HUNDRED // with 20 decimals, this is 1.0, or in the context of the system 1 * 10^18
        );

        const expectedAmountD18 = ONE_HUNDRED.mul(ethers.BigNumber.from(10).pow(18)).div(
          ethers.BigNumber.from(10).pow(DECIMALS)
        );

        // expect 1 * 10^18
        assertBn.equal(amountD18, expectedAmountD18);
      });

      it('reverts when scaling down to system amount results in loss of precision', async () => {
        await assertRevert(
          systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
            fakeCollateral.address,
            ONE_HUNDRED.add(1) // with 20 decimals, this is 1.00000000000000000001, or in the context of the system 1.00000000000000000001 * 10^18
          ),
          `PrecisionLost("${ONE_HUNDRED.add(1)}", "${DECIMALS}")`,
          systems().Core
        );
      });

      it('reverts when scaling down to system amount results in too small of an amount', async () => {
        const TOKEN_AMOUNT = 99;

        await assertRevert(
          systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
            fakeCollateral.address,
            TOKEN_AMOUNT // 100 would not result in a revert, but [99, 98, 97, ... 2, 1] would
          ),
          `PrecisionLost("${TOKEN_AMOUNT}", "${DECIMALS}")`,
          systems().Core
        );
      });
    });

    describe('scaling tokens that do not define decimals to system amount', async () => {
      const DECIMALS = 18; // assumed decimals when ERC20 token does not define decimals()

      before('initialize fake collateral config', async () => {
        const CollateralMockWithoutDecimals = await hre.ethers.getContractFactory(
          'CollateralMockWithoutDecimals'
        );

        fakeCollateral = await CollateralMockWithoutDecimals.deploy();
        await fakeCollateral.deployed();
        await fakeCollateral.initialize('token', 'TOKEN');
        await (
          await systems()
            .Core.connect(owner)
            .configureCollateral({
              tokenAddress: fakeCollateral.address,
              oracleNodeId: ethers.utils.formatBytes32String(''),
              issuanceRatioD18: '5000000000000000000',
              liquidationRatioD18: '1500000000000000000',
              liquidationRewardD18: '20000000000000000000',
              minDelegationD18: '20000000000000000000',
              depositingEnabled: true,
            })
        ).wait();
      });

      it('correctly scales token', async () => {
        const amountD18 = await systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
          fakeCollateral.address,
          ONE
        );

        const expectedAmountD18 = ONE.mul(ethers.BigNumber.from(10).pow(18)).div(
          ethers.BigNumber.from(10).pow(DECIMALS)
        );

        // expect 1 * 10^18
        assertBn.equal(amountD18, expectedAmountD18);
      });
    });
  });
});
