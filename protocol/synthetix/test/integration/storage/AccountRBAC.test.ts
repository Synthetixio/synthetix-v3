import hre from 'hardhat';
import { ethers } from 'ethers';
import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../bootstrap';
import { getContractAst } from '@synthetixio/core-utils/utils/hardhat/contracts';
import { findAll } from '@synthetixio/core-utils/utils/ast/finders';

describe('AccountRBAC', () => {
  const { systems } = bootstrap();

  /*
   * Looks into the AccountRBAC.sol AST and finds constant variable declarations,
   * which is where permissions are declared in this contract.
   * */
  async function findAllPermissions() {
    const ast = await getContractAst('contracts/storage/AccountRBAC.sol:AccountRBAC', hre);
    const variableDeclarations = findAll(
      ast,
      'VariableDeclaration',
      (node) => node.mutability === 'constant'
    );
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
