//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as ElectionModuleBase} from "@synthetixio/core-modules/contracts/submodules/election/ElectionModule.sol";
import "@synthetixio/core-modules/contracts/submodules/election/strategies/ElectionVotesBasic.sol";
import "@synthetixio/core-modules/contracts/submodules/election/strategies/ElectionTallyPlurality.sol";

// solhint-disable-next-line no-empty-blocks
contract ElectionModule is ElectionModuleBase, ElectionTallyPlurality, ElectionVotesBasic {

}
