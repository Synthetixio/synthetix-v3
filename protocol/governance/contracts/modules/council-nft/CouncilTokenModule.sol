//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import "../../interfaces/ICouncilTokenModule.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module with custom NFT logic for the account token.
 * @dev See IAccountTokenModule.
 */
contract CouncilTokenModule is ICouncilTokenModule, NftModule {

}
