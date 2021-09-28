const { equal } = require('assert/strict');
const { compareStorageStructs } = require('../../utils/comparator');

describe('utils/comparator.js', function () {
  const previousStructsMap = [
    {
      contract: {
        name: 'GlobalNamespace',
        id: 614,
      },
      struct: {
        name: 'GlobalStorage',
        members: [
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'someValue',
            type: 'uint256',
          },
        ],
      },
    },
    {
      contract: {
        name: 'OwnerNamespace',
        id: 630,
      },
      struct: {
        name: 'OwnerStorage',
        members: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'nominatedOwner',
            type: 'address',
          },
        ],
      },
    },
    {
      contract: {
        name: 'ProxyNamespace',
        id: 644,
      },
      struct: {
        name: 'ProxyStorage',
        members: [
          {
            name: 'implementation',
            type: 'address',
          },
        ],
      },
    },
    {
      contract: {
        name: 'SettingsNamespace',
        id: 658,
      },
      struct: {
        name: 'SettingsStorage',
        members: [
          {
            name: 'aSettingValue',
            type: 'uint256',
          },
        ],
      },
    },
  ];

  describe('compareStorageStructs no updates', function () {
    it('detects no changes when both structMaps are equal', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });
  });

  describe('compareStorageStructs with additions', function () {
    it('detects new contract added', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap.push({
        contract: {
          name: 'AnotherNamespace',
          id: 1,
        },
        struct: {
          name: 'AnotherStorage',
          members: [
            {
              name: 'value',
              type: 'uint256',
            },
            {
              name: 'someValue',
              type: 'uint256',
            },
          ],
        },
      });
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 1);
      equal(result.additions[0].completeStruct, true);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });

    it('detects new member added', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap[0].struct.members.push({
        name: 'newValue',
        type: 'uint256',
      });
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 1);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });
  });

  describe('compareStorageStructs with removals', function () {
    it('detects whole contract removed', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap.pop();
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 1);
    });

    it('detects member removed', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap[0].struct.members.pop();
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 1);
    });
  });

  describe('compareStorageStructs with modifications', function () {
    it('detects member name updated', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap[0].struct.members[0].name = 'modifiedName';
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 0);
      equal(result.modifications.length, 1);
      equal(result.removals.length, 0);
    });

    it('detects member type updated', function () {
      let currentStructsMap = JSON.parse(JSON.stringify(previousStructsMap));
      currentStructsMap[0].struct.members[0].type =
        currentStructsMap[0].struct.members[0].type == 'uint256' ? 'address' : 'uint256';
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      });
      equal(result.additions.length, 0);
      equal(result.modifications.length, 1);
      equal(result.removals.length, 0);
    });
  });
});
