const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

describe.only('MathUtil', () => {
  let MathUtil;

  let user;

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('MathUtilMock');
    MathUtil = await factory.deploy();
  });

  describe('sqrt(x)', () => {
    const ONE = ethers.BigNumber.from(1);
    const TWO = ethers.BigNumber.from(2);

    function sqrt(value) {
      return Math.floor(Math.sqrt(value))
    }

    function bnSqrt(value) {
        x = ethers.BigNumber.from(value);

        let z = x.add(ONE).div(TWO);
        let y = x;

        while (z.sub(y).isNegative()) {
            y = z;
            z = x.div(z).add(z).div(TWO);
        }

        return y;
    }

    async function assertSqrt(value) {
      assertBn.equal(await MathUtil.sqrt(value), sqrt(value));
    }

    async function assertBnSqrt(value) {
      assertBn.equal(await MathUtil.sqrt(value), bnSqrt(value));
    }

    it('calculates small square roots', async function () {
      await assertSqrt(0);
      await assertSqrt(4);
      await assertSqrt(42);
      await assertSqrt(1337);
      await assertSqrt(20000);
      await assertSqrt(450000);
      await assertSqrt(10333333);
      await assertSqrt(100000000);
    });

    it('calculates big roots', async () => {
      await assertBnSqrt(ethers.utils.parseEther('0'));
      await assertBnSqrt(ethers.utils.parseEther('4'));
      await assertBnSqrt(ethers.utils.parseEther('42'));
      await assertBnSqrt(ethers.utils.parseEther('1337'));
      await assertBnSqrt(ethers.utils.parseEther('20000'));
      await assertBnSqrt(ethers.utils.parseEther('450000'));
      await assertBnSqrt(ethers.utils.parseEther('10333333'));
      await assertBnSqrt(ethers.utils.parseEther('100000000'));
    });
  });
});
