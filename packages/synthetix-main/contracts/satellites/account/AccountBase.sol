//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../../storage/AccountStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the AcccountModule
contract AccountBase is ERC721, AccountStorage, InitializableMixin {
    error StakedCollateralAlreadyExists(StakedCollateral stakedCollateral);

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }
}
