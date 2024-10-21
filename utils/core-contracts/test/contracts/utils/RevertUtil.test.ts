import hre from 'hardhat';
import { RevertUtilMock } from '../../../typechain-types';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('RevertUtil', function () {
  let RevertUtil: RevertUtilMock;

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('RevertUtilMock');
    RevertUtil = await factory.deploy();
  });

  describe('revertIfError()', () => {
    it('does not revert if error is empty', async () => {
      await RevertUtil.revertIfError('0x');
    });

    it('reverts with the same data if there is an error', async () => {
      await assertRevert(RevertUtil.revertIfError('0x32837430'), '0x32837430');
    });
  });

  describe('revertManyIfError()', () => {
    it('does not revert if there is no error', async () => {
      await RevertUtil.revertManyIfError(['0x', '0x', '0x', '0x']);
    });

    it('reverts if even one of the elements is an error', async () => {
      await assertRevert(
        RevertUtil.revertManyIfError(['0x', '0x32837430', '0x', '0x883832', '0x']),
        'Errors("0x32837430,0x883832")'
      );
    });
  });

  describe('revertWithReason()', () => {
    it('reverts with exactly the given data', async () => {
      await assertRevert(RevertUtil.revertWithReason('0x1234'), '0x1234');
      await assertRevert(RevertUtil.revertWithReason('0x'), 'EmptyRevertReason()');
    });
  });
});
