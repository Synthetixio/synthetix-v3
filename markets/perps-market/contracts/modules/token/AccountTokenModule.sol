//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import "../../../contracts/interfaces/IAccountToken.sol";

/**
 * @title Module with NFT functionality for positions
 * @dev See IAccountToken.
 */
contract AccountToken is IAccountToken, NftModule {

}
