//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/**
 * @title Wrapper library servicing the wrapper module
 */
library Wrapper {
    error WrappingNotInitialized();

    struct Data {
        /**
         * @dev tracks the type of collateral used for wrapping
         * helpful for checking balances and allowances
         */
        address collateralType;
        /**
         * @dev sets if wrapping is enabled for given market id
         */
        bool wrappingEnabled;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Wrapper", marketId));
        assembly {
            store.slot := s
        }
    }

    function create(uint128 marketId, address collateralType) internal {
        update(load(marketId), true, collateralType);
    }

    function update(Data storage self, bool wrappingEnabled, address collateralType) internal {
        self.collateralType = collateralType;
        self.wrappingEnabled = wrappingEnabled;
    }

    function onlyEnabledWrapper(Wrapper.Data storage self) internal view {
        if (self.wrappingEnabled) {
            revert WrappingNotInitialized();
        }
    }
}
