import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';
import NodeTypes from '../mixins/Node.types';
import hre from 'hardhat';

const parseUnits = ethers.utils.parseUnits;

describe('PythNode', function () {
  const { getContract, getSigners } = bootstrap();

  const abi = ethers.utils.defaultAbiCoder;
  let NodeModule: ethers.Contract;
  let PythMock: ethers.Contract;

  const priceFeedId = ethers.utils.hexZeroPad('0x6d6f636b', 32);
  const decimals = 8;
  const price = parseUnits('1559', decimals).toString();
  const emaPrice = parseUnits('420', decimals).toString();
  const timestamp = 4000;

  before('deploy mock contract', async () => {
    NodeModule = getContract('NodeModule');

    const [owner] = getSigners();

    // Deploy the mock
    const factory = await hre.ethers.getContractFactory('MockPyth');
    PythMock = await factory.connect(owner).deploy(100, 100);
  });

  describe('use updated price feed', () => {
    before('update price feed', async () => {
      // Set the latest price
      const resp = await PythMock.createPriceFeedUpdateData(
        priceFeedId,
        price,
        1,
        -decimals,
        emaPrice,
        1,
        timestamp,
        0
      );
      const fee = await PythMock['getUpdateFee(bytes[])']([resp]);
      await PythMock.updatePriceFeeds([resp], { value: fee });
    });

    it('retrieves the latest price', async () => {
      // Register the mock
      const NodeParameters = abi.encode(
        ['address', 'bytes32', 'bool'],
        [PythMock.address, priceFeedId, false]
      );
      await NodeModule.registerNode(NodeTypes.PYTH, NodeParameters, []);
      const nodeId = await NodeModule.getNodeId(NodeTypes.PYTH, NodeParameters, []);

      // Verify the node processes output as expected
      const output = await NodeModule.process(nodeId);
      assertBn.equal(output.price, parseUnits(price, 18 - decimals).toString());
      assertBn.equal(output.timestamp, timestamp);
    });

    it('retrieves the ema price', async () => {
      // Register the mock
      const NodeParameters = abi.encode(
        ['address', 'bytes32', 'bool'],
        [PythMock.address, priceFeedId, true]
      );
      await NodeModule.registerNode(NodeTypes.PYTH, NodeParameters, []);
      const nodeId = await NodeModule.getNodeId(NodeTypes.PYTH, NodeParameters, []);

      // Verify the node processes output as expected
      const output = await NodeModule.process(nodeId);
      assertBn.equal(output.price, parseUnits(emaPrice, 18 - decimals).toString());
      assertBn.equal(output.timestamp, timestamp);
    });
  });

  describe('use parsed price feed', () => {
    let updateFee: ethers.BigNumber;
    let priceFeedData: string;
    before('gets price feed', async () => {
      // Get the latest price
      priceFeedData = await PythMock.createPriceFeedUpdateData(
        priceFeedId,
        price,
        1,
        -decimals,
        emaPrice,
        1,
        timestamp,
        0
      );
      updateFee = await PythMock['getUpdateFee(bytes[])']([priceFeedData]);
    });

    it('retrieves latest price', async () => {
      const parsedPrice = await PythMock.callStatic.parsePriceFeedUpdates(
        [priceFeedData],
        [priceFeedId],
        timestamp - 10,
        timestamp + 10,
        { value: updateFee }
      );

      assertBn.equal(parsedPrice[0].price.price, price);
      assertBn.equal(parsedPrice[0].price.conf, 1);
      assertBn.equal(parsedPrice[0].price.expo, -decimals);
      assertBn.equal(parsedPrice[0].price.publishTime, timestamp);
    });

    it('retrieves the ema price', async () => {
      const parsedPrice = await PythMock.callStatic.parsePriceFeedUpdates(
        [priceFeedData],
        [priceFeedId],
        timestamp - 10,
        timestamp + 10,
        { value: updateFee }
      );

      assertBn.equal(parsedPrice[0].emaPrice.price, emaPrice);
      assertBn.equal(parsedPrice[0].emaPrice.conf, 1);
      assertBn.equal(parsedPrice[0].emaPrice.expo, -decimals);
      assertBn.equal(parsedPrice[0].emaPrice.publishTime, timestamp);
    });
  });
});
