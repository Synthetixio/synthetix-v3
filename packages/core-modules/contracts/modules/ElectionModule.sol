//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as ElectionModuleBase} from "../submodules/election/ElectionModule.sol";
import "../submodules/election/strategies/ElectionVotesBasic.sol";
import "../submodules/election/strategies/ElectionTallyPlurality.sol";

/// @title Demo election module.
/// @dev Please inherit submodules/election/ElectionModule.sol in production. This is just intended as an example.
// solhint-disable-next-line no-empty-blocks
contract ElectionModule is ElectionModuleBase, ElectionTallyPlurality, ElectionVotesBasic {

}
