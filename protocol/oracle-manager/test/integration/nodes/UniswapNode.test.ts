import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrapWithNodes } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';

describe('UniswapNode', function () {
  const { getContract, nodeId1, nodeId2, nodeId3 } = bootstrapWithNodes();

  const abi = ethers.utils.defaultAbiCoder;
  let parents: string[];
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    parents = [nodeId1(), nodeId2(), nodeId3()];
  });
});
