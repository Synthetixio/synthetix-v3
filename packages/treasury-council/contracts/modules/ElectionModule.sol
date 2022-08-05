//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as SynthetixElectionModule} from "@synthetixio/synthetix-governance/contracts/modules/ElectionModule.sol";

contract ElectionModule is SynthetixElectionModule {
    // ---------------------------------------
    // Internal
    // ---------------------------------------

    /// @dev Overrides the user's voting power by combining local chain debt share with debt shares in other chains
    /// @dev Note that this removes the use of Math.sqrt defined in synthetix-governance
    function _getVotePower(address user) internal view override returns (uint) {
        return _getDebtShare(user) + _getDeclaredCrossChainDebtShare(user);
    }
}
