import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';

describe('UniswapNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let MockObservable: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    const [owner] = getSigners();

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockObservable');
    MockObservable = await factory.connect(owner).deploy([4, 0], [12, 12], [10, 20]);
  });

  it('retrieves the latest price', async () => {
    // Register the mock
    const NodeParameters = abi.encode(
      ['address', 'address', 'address', 'uint32'],
      // eslint-disable-next-line max-len
      [ethers.constants.AddressZero, ethers.constants.AddressZero, MockObservable.address, 4] // using the mock's address for the token addresses because the mock doesn't take them into account
    );
    await NodeModule.registerNode(NodeTypes.UNISWAP, NodeParameters, []);
    const nodeId = await NodeModule.getNodeId(NodeTypes.UNISWAP, NodeParameters, []);

    // Verify the node processes output as expected
    const output = await NodeModule.process(nodeId);
    assertBn.equal(output.price, 1000000);
    assertBn.equal(output.timestamp, 0);
  });
});
