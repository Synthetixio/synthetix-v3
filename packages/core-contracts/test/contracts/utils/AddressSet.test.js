const { equal, deepEqual } = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assert-bignumber');

const { ethers } = hre;

describe('AddressSet', () => {
  let AddressSet;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('AddressSetMock');
    AddressSet = await factory.deploy();
  });

  it('correctly manages values', async () => {
    const randomAddress1 = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    const randomAddress2 = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
    const randomAddress3 = '0x0Ac1dF02185025F65202660F8167210A80dD5086';

    const assertValues = async (values) => {
      deepEqual(await AddressSet.values(), values);
      assertBn.eq(await AddressSet.length(), values.length);
    };

    // Starts empty
    await assertValues([]);

    // Add one value
    await AddressSet.add(randomAddress1);
    await assertValues([randomAddress1]);
    equal(await AddressSet.lastMockResult(), true);

    // Add another value
    await AddressSet.add(randomAddress2);
    await assertValues([randomAddress1, randomAddress2]);
    equal(await AddressSet.lastMockResult(), true);

    // Should not add a repeated value
    await (await AddressSet.add(randomAddress2)).wait();
    equal(await AddressSet.lastMockResult(), false);
    await assertValues([randomAddress1, randomAddress2]);

    // Should return false when trying to remove an unexistant value
    await (await AddressSet.remove(randomAddress3)).wait();
    equal(await AddressSet.lastMockResult(), false);

    equal(await AddressSet.contains(randomAddress1), true);
    equal(await AddressSet.contains(randomAddress2), true);
    equal(await AddressSet.contains(randomAddress3), false);

    equal(await AddressSet.at(0), randomAddress1);
    equal(await AddressSet.at(1), randomAddress2);

    await AddressSet.remove(randomAddress1);
    await assertValues([randomAddress2]);
  });
});
