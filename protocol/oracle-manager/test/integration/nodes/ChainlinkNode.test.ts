import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { BigNumber, ethers, utils } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('ChainlinkNode', () => {
  const { getSigners, getContract } = bootstrap();

  let aggregator: ethers.Contract;

  const abi = utils.defaultAbiCoder;

  let owner: ethers.Signer;

  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  before('identify owner', async () => {
    [owner] = await getSigners();
  });

  before('deploy mock aggregator', async () => {
    const factory = await hre.ethers.getContractFactory('MockChainlinkAggregator');
    aggregator = await factory.connect(owner).deploy([100, 200, 300, 400, 500]); // mock round prices with 6 decimals
  });

  describe('process()', () => {
    describe('when twapInterval is zero', async () => {
      it('returns latest price', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(0), 6]
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('500', 12));
      });
    });

    describe('when twapInterval is 25 minutes', async () => {
      it('returns avg price correctly', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(35 * 60), 6] // 25 minutes in seconds
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('400', 12)); // 500 + 400 + 300 / 3
      });
    });

    describe('when twapInterval is 80 minutes', async () => {
      it('returns avg price correctly', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(80 * 60), 6] // 25 minutes in seconds
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('300', 12)); // 500 + 400 + 300 + 200 + 100 / 5
      });
    });

    describe('when price downscale is needed', async () => {
      it('returns price with 18 decimlas', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256', 'uint8'],
          [aggregator.address, BigNumber.from(0), 6]
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('500', 12));
      });
    });
  });

  const registerNode = async (params: string) => {
    const tx = await NodeModule.registerNode(NodeTypes.CHAINLINK, params, []);
    await tx.wait();
    return await NodeModule.getNodeId(NodeTypes.CHAINLINK, params, []);
  };
});
