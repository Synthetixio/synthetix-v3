import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import NodeOperations from '../mixins/Node.operations';

describe('ReducerNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let owner;
  let Node10000, Node100, Node10, Node1;

  before('prepare environment', async () => {
    NodeModule = getContract('NodeModule');
    owner = getSigners()[0];

    Node10000 = await deployAndRegisterExternalNode(10000, 1);
    Node100 = await deployAndRegisterExternalNode(100, 10);
    Node10 = await deployAndRegisterExternalNode(10, 100);
    Node1 = await deployAndRegisterExternalNode(1, 10000);
  });

  it('successfully reduces with the RECENT operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.RECENT]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 1);
    assertBn.equal(nodeOutput.timestamp, 10000);
  });

  it('successfully reduces with the MIN operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MIN]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 1);
    assertBn.equal(nodeOutput.timestamp, 10000);
  });

  it('successfully reduces with the MAX operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MAX]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 10000);
    assertBn.equal(nodeOutput.timestamp, 1);
  });

  it('successfully reduces with the MAX operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MAX]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 10000);
    assertBn.equal(nodeOutput.timestamp, 1);
  });

  it('successfully reduces with the MEAN operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MEAN]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 2527);
    assertBn.equal(nodeOutput.timestamp, 2527);
  });

  it('successfully reduces with the MEDIAN operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MEDIAN]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 55);
    assertBn.equal(nodeOutput.timestamp, 55);
  });

  it('successfully reduces with the MUL operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.MUL]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 10000000);
    assertBn.equal(nodeOutput.timestamp, 2527);
  });

  it('successfully reduces with the DIV operation', async () => {
    const NodeParameters = abi.encode(['uint'], [NodeOperations.DIV]);
    await NodeModule.registerNode(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeId = await NodeModule.getNodeId(NodeTypes.REDUCER, NodeParameters, [
      Node10000,
      Node100,
      Node10,
      Node1,
    ]);
    const nodeOutput = await NodeModule.process(nodeId);

    assertBn.equal(nodeOutput.price, 10);
    assertBn.equal(nodeOutput.timestamp, 2527);
  });

  async function deployAndRegisterExternalNode(price, timestamp) {
    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockExternalNode');
    const externalNode = await factory.connect(owner).deploy(price, timestamp);

    // Register the external node referencing the mock
    const NodeParameters = abi.encode(['address'], [externalNode.address]);
    await NodeModule.registerNode(NodeTypes.EXTERNAL, NodeParameters, []);

    // Return the ID
    return await NodeModule.getNodeId(NodeTypes.EXTERNAL, NodeParameters, []);
  }
});
