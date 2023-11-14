import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import { generateExternalNode } from '../../common/oracleNode';

describe('PythOffchainLookupNode', function () {
  const { getContract } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
  });

  const createOffchainNode = async (params: string) => {
    const nodeId = await NodeModule.callStatic.registerNode(
      NodeTypes.PYTH_OFFCHAIN_LOOKUP,
      params,
      []
    );
    await NodeModule.registerNode(NodeTypes.PYTH_OFFCHAIN_LOOKUP, params, []);
    return nodeId;
  };

  describe('errors', () => {
    it('fails with parents', async () => {
      const randomNodeId = await generateExternalNode(NodeModule, 100, 100);
      const params = abi.encode(
        ['address', 'bytes32', 'uint256'],
        [NodeModule.address, ethers.utils.formatBytes32String('test'), 100]
      );

      await assertRevert(
        NodeModule.registerNode(NodeTypes.PYTH_OFFCHAIN_LOOKUP, params, [randomNodeId]),
        'InvalidNodeDefinition',
        NodeModule
      );
    });

    it('fails with invalid params', async () => {
      const params = abi.encode(
        ['address', 'bytes32'],
        [NodeModule.address, ethers.utils.formatBytes32String('test')]
      );

      await assertRevert(
        NodeModule.registerNode(NodeTypes.PYTH_OFFCHAIN_LOOKUP, params, []),
        'InvalidNodeDefinition',
        NodeModule
      );
    });
  });

  describe('works', () => {
    const priceId = ethers.utils.formatBytes32String('test');
    it('with valid params', async () => {
      const params = abi.encode(
        ['address', 'bytes32', 'uint256'],
        [NodeModule.address, priceId, 100]
      );
      const nodeId = await createOffchainNode(params);
      const expectedRevertMsg = abi.encode(['uint8', 'uint64', 'bytes32[]'], [1, 100, [priceId]]);
      await assertRevert(
        NodeModule.process(nodeId),
        `OracleDataRequired(${NodeModule.address}, ${expectedRevertMsg}`,
        NodeModule
      );
    });

    it('with stalenessTolerance override', async () => {
      const params = abi.encode(
        ['address', 'bytes32', 'uint256'],
        [NodeModule.address, priceId, 100]
      );
      const nodeId = await createOffchainNode(params);

      const runtimeKeyArg = [ethers.utils.formatBytes32String('stalenessTolerance')];
      const runtimeValueArg = [
        ethers.utils.hexZeroPad(ethers.BigNumber.from('200').toHexString(), 32),
      ];

      // note the '200' that's returned in staleness tolerance
      const expectedRevertMsg = abi.encode(['uint8', 'uint64', 'bytes32[]'], [1, 200, [priceId]]);
      await assertRevert(
        NodeModule.processWithRuntime(nodeId, runtimeKeyArg, runtimeValueArg),
        `OracleDataRequired(${NodeModule.address}, ${expectedRevertMsg}`,
        NodeModule
      );
    });
  });
});
