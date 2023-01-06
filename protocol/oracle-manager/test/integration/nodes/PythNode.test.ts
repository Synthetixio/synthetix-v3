import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('PythNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let PythMock: ethers.Contract;

  const priceFeedId = ethers.utils.hexZeroPad('0x6d6f636b', 32);
  const price = 1559;
  const emaPrice = 420;
  const timestamp = 4000;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');

    const [owner] = getSigners();

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockPyth');
    PythMock = await factory.connect(owner).deploy(100, 100);

    // Set the latest price
    const resp = await PythMock.createPriceFeedUpdateData(
      priceFeedId,
      price,
      1,
      1,
      emaPrice,
      1,
      timestamp
    );
    await PythMock.updatePriceFeeds([resp]);
  });

  it('retrieves the latest price', async () => {
    // Register the mock
    const NodeParameters = abi.encode(
      ['address', 'string', 'bool'],
      [PythMock.address, priceFeedId, false]
    );
    await NodeModule.registerNode(NodeTypes.PYTH, NodeParameters, []);
    const nodeId = await NodeModule.getNodeId(NodeTypes.PYTH, NodeParameters, []);

    // Verify the node processes output as expected
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, price);
    assertBn.equal(output.timestamp, timestamp);
  });

  it('retrieves the ema price', async () => {
    // Register the mock
    const NodeParameters = abi.encode(
      ['address', 'string', 'bool'],
      [PythMock.address, priceFeedId, true]
    );
    await NodeModule.registerNode(NodeTypes.PYTH, NodeParameters, []);
    const nodeId = await NodeModule.getNodeId(NodeTypes.PYTH, NodeParameters, []);

    // Verify the node processes output as expected
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, emaPrice);
    assertBn.equal(output.timestamp, timestamp);
  });
});
