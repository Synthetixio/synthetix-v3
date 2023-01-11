import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe.skip('UniswapNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let UniswapMock: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    const [owner] = getSigners();

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockObservable');
    UniswapMock = await factory.connect(owner).deploy([], [], []);
  });

  it('retrieves the latest price', async () => {
    // Register the mock
    const NodeParameters = abi.encode(
      ['address', 'address', 'address', 'uint32'],
      // eslint-disable-next-line max-len
      [UniswapMock.address, UniswapMock.address, UniswapMock.address, 10] // using the mock's address for the token addresses because the mock doesn't take them into account
    );
    await NodeModule.registerNode(NodeTypes.PYTH, NodeParameters, []);
    const nodeId = await NodeModule.getNodeId(NodeTypes.PYTH, NodeParameters, []);

    // Verify the node processes output as expected
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, 100);
    assertBn.equal(output.timestamp, 0);
  });
});
