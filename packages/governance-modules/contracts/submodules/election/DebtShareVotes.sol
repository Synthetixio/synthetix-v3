//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DebtShareVotesL1.sol";
import "./DebtShareVotesL2.sol";

/// @dev Implements merkle-tree migration/declaration of debt shares on L1
contract DebtShareVotes is DebtShareVotesL1, DebtShareVotesL2 {

}
