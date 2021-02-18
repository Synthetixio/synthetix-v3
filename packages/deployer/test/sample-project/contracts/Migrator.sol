//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "./modules/OwnerModule.sol";
import "./modules/UpgradeModule.sol";
import "./modules/StatusModule.sol";


contract Migrator {
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Migration targets
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    address public constant synthetix = 0x9c65f85425c619A6cB6D29fF8d57ef696323d188;
    address public constant newRouter = 0xa62835D1A6bf5f521C4e2746E1F51c923b8f3483;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Temp storage
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    address public owner;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // ~* THE MIGRATION *~
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function migrate() public {
        _takeOwnership();
        _preliminaryChecks();
        _suspendSystem();
        _upgradeRouter();
        _initializeModules();
        _registerModules();
        _upgradeSettings();
        _resumeSystem();
        _concludingChecks();
        _restoreOwnership();
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Upgrade / initialize
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function _upgradeRouter() internal {
        UpgradeModule(synthetix).upgradeTo(newRouter);
    }

    function _initializeModules() internal {
        // TODO
    }

    function _registerModules() internal {
        // TODO
    }

    function _upgradeSettings() internal {
        // TODO
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Validate / test
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function _preliminaryChecks() internal {
        // TODO
    }

    function _concludingChecks() internal {
        // TODO
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Suspend / resume
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function _suspendSystem() internal {
        StatusModule(synthetix).suspendSystem();
    }

    function _resumeSystem() internal {
        StatusModule(synthetix).resumeSystem();
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Ownership
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function _takeOwnership() internal {
        require(OwnerModule(synthetix).getNominatedOwner() == address(this), "Migrator not nominated for ownership");

        owner = OwnerModule(synthetix).getOwner();
        OwnerModule(synthetix).acceptOwnership();

        require(OwnerModule(synthetix).getOwner() == address(this), "Could not take ownership");
    }

    function _restoreOwnership() internal {
        require(OwnerModule(synthetix).getOwner() == address(this), "Migrator is not owner");

        OwnerModule(synthetix).nominateOwner(owner);
    }
}
