const { ethers } = require('ethers');
const hre = require('hardhat');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');

async function insertHeapData(heap, count, salt = 'salt') {
  const vals = Array.from({ length: count }, (_, index) =>
    ethers.BigNumber.from(
      '0x' + ethers.utils.solidityKeccak256(['string'], [salt + index]).slice(64)
    )
  );
  for (const i in vals) {
    await heap.insert(i, vals[i]);
  }

  return vals;
}

describe('HeapUtil', async () => {
  let heap;

  beforeEach('initialize fresh heap', async () => {
    heap = (await (await hre.ethers.getContractFactory('HeapUtilMock')).deploy()).connect(
      (await hre.ethers.getSigners())[0]
    );
  });

  it('extractMax()', async () => {
    await insertHeapData(heap, 100);

    let lastPrio = (await heap.callStatic.extractMax()).priority;

    for (let i = 0; i < 100; i++) {
      const getNode = await heap.getMax();
      const node = await heap.callStatic.extractMax();
      await heap.extractMax();

      assertBn.equal(getNode.id, node.id);
      assertBn.lte(node.priority, lastPrio);
      lastPrio = node.priority;
    }

    assertBn.isZero(await heap.size());
  });

  it('extractById()', async () => {
    await insertHeapData(heap, 100);
    const vals = await insertHeapData(heap, 100, 'updated');

    for (let i = 0; i < 100; i++) {
      const getNode = await heap.getById(i);
      const node = await heap.callStatic.extractById(i);
      await heap.extractById(i);

      assertBn.equal(getNode.id, node.id);
      assertBn.equal(getNode.priority, node.priority);
      assertBn.equal(node.id, i);
      assertBn.equal(node.priority, vals[i]);
    }

    assertBn.isZero(await heap.size());
  });

  it('extractMax() after update', async () => {
    await insertHeapData(heap, 100);

    // now reinsert 5000 of those values
    await insertHeapData(heap, 50, 'updated');

    let lastPrio = (await heap.callStatic.extractMax()).priority;

    for (let i = 0; i < 100; i++) {
      const getNode = await heap.getMax();
      const node = await heap.callStatic.extractMax();
      await heap.extractMax();

      assertBn.equal(getNode.id, node.id);
      assertBn.lte(node.priority, lastPrio);
      lastPrio = node.priority;
    }

    assertBn.isZero(await heap.size());
  });
});
