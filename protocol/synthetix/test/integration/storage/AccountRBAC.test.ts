/* eslint-disable @typescript-eslint/ban-ts-comment */

import { getContractAst } from '@synthetixio/core-utils/src/utils/hardhat/contracts';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findAll } from '@synthetixio/core-utils/utils/ast/finders';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';

describe('AccountRBAC', () => {
  const { systems } = bootstrap();

  /*
   * Looks into the AccountRBAC.sol AST and finds constant variable declarations,
   * which is where permissions are declared in this contract.
   * */
  async function findAllPermissions() {
    // @ts-ignore couldn't figure out why the hre type is wrong :(
    const ast = await getContractAst(hre, 'contracts/storage/AccountRBAC.sol:AccountRBAC');

    const variableDeclarations = findAll(
      ast,
      'VariableDeclaration',
      (node) => node.mutability === 'constant'
    );
    // @ts-ignore according to types value doesn't exists, the tests seems to pass so ignoring type for now
    return variableDeclarations.map((v) => v.value.value);
  }

  it('shows all declared permissions are valid', async function () {
    const permissions = await findAllPermissions();

    for (const permission of permissions) {
      assert.ok(
        await systems().Core.AccountRBAC_isPermissionValid(
          ethers.utils.formatBytes32String(permission)
        )
      );
    }
  });

  it('shows undeclared permissions are invalid', async function () {
    const permission = ethers.utils.formatBytes32String('NOT A PERMISSION');

    await assertRevert(
      systems().Core.AccountRBAC_isPermissionValid(permission),
      `InvalidPermission("${permission}")`,
      systems().Core
    );
  });
});
