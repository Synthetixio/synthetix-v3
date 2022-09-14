import { equal } from 'assert/strict';

import { clone } from '../../../src/utils/misc/clone';
import { compareStorageStructs } from '../../../src/utils/ast/comparator';

describe('utils/ast/comparator.ts compareStorageStructs', function () {
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
      const currentStructsMap = clone(previousStructsMap);
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });
  });

  describe('compareStorageStructs with appends', function () {
    it('detects new contract added', function () {
      const currentStructsMap = clone(previousStructsMap);
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
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 1);
      equal(result.appends[0].completeStruct, true);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });

    it('detects new member appended', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap[0].struct.members.push({
        name: 'newValue',
        type: 'uint256',
      });
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 1);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 0);
    });

    it('detects new member added before the last one', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap[0].struct.members.unshift({
        name: 'newValue',
        type: 'uint256',
      });
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 1);
      // two since two members changed the index
      equal(result.modifications.length, 2);
      equal(result.removals.length, 0);
    });
  });

  describe('compareStorageStructs with removals', function () {
    it('detects whole contract removed', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap.pop();
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 1);
    });

    it('detects member removed', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap[0].struct.members.pop();
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 0);
      equal(result.modifications.length, 0);
      equal(result.removals.length, 1);
    });
  });

  describe('compareStorageStructs with modifications', function () {
    it('detects member name updated', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap[0].struct.members[0].name = 'modifiedName';
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 0);
      equal(result.modifications.length, 1);
      equal(result.removals.length, 0);
    });

    it('detects member type updated', function () {
      const currentStructsMap = clone(previousStructsMap);
      currentStructsMap[0].struct.members[0].type =
        currentStructsMap[0].struct.members[0].type == 'uint256' ? 'address' : 'uint256';
      const result = compareStorageStructs({
        previousStructsMap,
        currentStructsMap,
      } as Parameters<typeof compareStorageStructs>[0]);
      equal(result.appends.length, 0);
      equal(result.modifications.length, 1);
      equal(result.removals.length, 0);
    });
  });
});
