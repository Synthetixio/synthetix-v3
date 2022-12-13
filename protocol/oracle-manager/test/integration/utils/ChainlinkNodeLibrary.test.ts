import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { BigNumber, ethers, utils } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';

describe('ChainlinkNodeLibrary', () => {
  const { getSigners } = bootstrap();

  let aggregator: ethers.Contract;
  let node: ethers.Contract;

  const abi = utils.defaultAbiCoder;

  let owner: ethers.Signer;
  before('identify owner', async () => {
    [owner] = await getSigners();
  });

  before('identify chainlink node', async () => {
    node = await (await hre.ethers.getContractFactory('MockChainlinkNode')).connect(owner).deploy();
  });

  before('deploy mock aggregator', async () => {
    const factory = await hre.ethers.getContractFactory('MockChainlinkAggregator');
    aggregator = await factory.connect(owner).deploy([100, 200, 300, 400, 500]); // mock round prices
  });

  describe('process()', () => {
    describe('when twapInterval is zero', async () => {
      it('returns latest price', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(0), 18]
        );
        const [price] = await node.process(encodedParams);
        assertBn.equal(price, BigNumber.from(500));
      });
    });

    describe('when twapInterval is 25 minutes', async () => {
      it('returns avg price correctly', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(35 * 60), 18] // 25 minutes in seconds
        );
        const [price] = await node.process(encodedParams);
        assertBn.equal(price, BigNumber.from(400)); // 500 + 400 + 300 / 3
      });
    });

    describe('when twapInterval is 80 minutes', async () => {
      it('returns avg price correctly', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(80 * 60), 18] // 25 minutes in seconds
        );
        const [price] = await node.process(encodedParams);
        assertBn.equal(price, BigNumber.from(300)); // 500 + 400 + 300 + 200 + 100 / 5
      });
    });

    describe('when price downscale is needed', async () => {
      it('returns price with 18 decimlas', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(0), 20]
        );
        const [price] = await node.process(encodedParams);
        assertBn.equal(price, 5);
      });
    });
  });
});
