import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers, Signer } from 'ethers';
import hre from 'hardhat';
import { ERC20Mock__factory } from '../../../typechain-types/index';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('UniswapNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let ERC20MockFactory: ERC20Mock__factory;
  let NodeModule: ethers.Contract;
  let MockObservable: ethers.Contract;
  let token0: ethers.Contract;
  let token1: ethers.Contract;
  let nodeId: string;
  let owner: Signer;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    [owner] = getSigners();

    ERC20MockFactory = await hre.ethers.getContractFactory('ERC20Mock');
    token0 = await ERC20MockFactory.connect(owner).deploy();
    await token0.initialize('Tether USD', 'usdt', 6);
    token1 = await ERC20MockFactory.connect(owner).deploy();
    await token1.initialize('Synthetix Network Token', 'snx', 18);

    // Deploy the mock V3 Pool
    const factory = await hre.ethers.getContractFactory('MockObservable');
    MockObservable = await factory
      .connect(owner)
      .deploy([4, 0], [12, 12], [10, 20], token0.address, token1.address);
  });

  it('reverts with invalid token', async () => {
    const invalidToken = await ERC20MockFactory.connect(owner).deploy();
    await invalidToken.initialize('Other Tether USD', 'usdt', 6);

    const NodeParameters = abi.encode(
      ['address', 'address', 'uint8', 'uint8', 'address', 'uint32'],
      [invalidToken.address, token1.address, 6, 18, MockObservable.address, 4]
    );
    await assertRevert(
      NodeModule.registerNode(NodeTypes.UNISWAP, NodeParameters, []),
      'InvalidNodeDefinition'
    );
  });

  it('register the uniswap node the latest price', async () => {
    const NodeParameters = abi.encode(
      ['address', 'address', 'uint8', 'uint8', 'address', 'uint32'],
      [token0.address, token1.address, 6, 18, MockObservable.address, 4]
    );
    await NodeModule.registerNode(NodeTypes.UNISWAP, NodeParameters, []);
    nodeId = await NodeModule.getNodeId(NodeTypes.UNISWAP, NodeParameters, []);
  });

  it('retrieves the latest price', async () => {
    const timestamp = (await hre.ethers.provider.getBlock('latest')).timestamp;
    const output = await NodeModule.process(nodeId);

    assertBn.equal(output.price, 1000000);
    assertBn.equal(timestamp, output.timestamp);
  });

  it('reverts with secondAgo = 0', async () => {
    const NodeParameters = abi.encode(
      ['address', 'address', 'uint8', 'uint8', 'address', 'uint32'],
      [token0.address, token1.address, 6, 18, MockObservable.address, 0]
    );

    await assertRevert(
      NodeModule.registerNode(NodeTypes.UNISWAP, NodeParameters, []),
      'InvalidNodeDefinition'
    );
  });
});
