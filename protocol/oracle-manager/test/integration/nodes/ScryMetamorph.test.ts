import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { BigNumber, ethers, utils } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('ScryMetaMorphNode', () => {
  const { getSigners, getContract } = bootstrap();

  let metamorph: ethers.Contract;

  const abi = utils.defaultAbiCoder;

  let owner: ethers.Signer;

  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  before('identify owner', async () => {
    [owner] = await getSigners();
  });

  before('deploy mock MM', async () => {
    const factory = await hre.ethers.getContractFactory('MockMetaMorph');
    metamorph = await factory.connect(owner).deploy();
  });

  describe('process()', () => {
    describe('check value = 100', async () => {
      it('returns latest price', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256'],
          [metamorph.address, 0] 
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('100',18));
      });
    });

    describe('when upscale is needed', async () => {
      it('returns price with 18 decimals', async () => {
        const encodedParams = abi.encode(
          ['address', 'uint256'],
          [metamorph.address, 1] 
        );

        const nodeId = await registerNode(encodedParams);
        const [price] = await NodeModule.process(nodeId);
        assertBn.equal(price, ethers.utils.parseUnits('100', 18));
      });
    });
  });

  const registerNode = async (params: string) => {
    const tx = await NodeModule.registerNode(NodeTypes.SCRY, params, []);
    await tx.wait();
    return await NodeModule.getNodeId(NodeTypes.SCRY, params, []);
  };
});
