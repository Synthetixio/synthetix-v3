import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import { CollateralMock } from '../../../typechain-types/contracts/mocks/CollateralMock';

describe('CollateralConfiguration', function () {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer;

  let fakeCollateral: CollateralMock;

  const initFakeCollateralConfig = async (decimals: number) => {
    [owner] = signers();
    fakeCollateral = await (
      await hre.ethers.getContractFactory('MockMarket')
    ).deploy('token', 'TOKEN', decimals);
    await fakeCollateral.deployed();
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

  before('initialize fake collateral config', async () => {
    await initFakeCollateralConfig(0);
  });

  describe('convertTokenToSystemAmount()', async () => {
    it('scales token with 0 decimals to system amount', async () => {
      await systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
        fakeCollateral.address,
        ethers.utils.parseEther('1')
      );
    });
    
    it('scales token with 6 decimals system amount', async () => {});

    it('scales token with 18 decimals to system amount', async () => {});

    it('scales token with greater than 18 decimals to system amount', async () => {});

    it('scales token that does not define decimals to system amount', async () => {});

    it('reverts when scaling to system amount results in loss of precision', async () => {
      await assertRevert(
        systems().Core.CollateralConfiguration_convertTokenToSystemAmount(
          ethers.constants.AddressZero,
          1
        ),
        'PrecisionLost()',
        systems().Core
      );
    });
  });
});
