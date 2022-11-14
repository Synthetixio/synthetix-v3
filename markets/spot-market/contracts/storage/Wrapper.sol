//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

library Wrapper {
    error WrappingNotInitialized();

    struct Data {
        address collateralType;
        bool wrappingEnabled;
    }

    function onlyEnabledWrapper(Wrapper.Data storage self) internal view {
        if (self.wrappingEnabled) {
            revert WrappingNotInitialized();
        }
    }
}
