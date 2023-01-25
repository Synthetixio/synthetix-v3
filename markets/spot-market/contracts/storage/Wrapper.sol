//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/**
 * @title Wrapper library servicing the wrapper module
 */
library Wrapper {
    error InvalidCollateralType();

    struct Data {
        /**
         * @dev tracks the type of collateral used for wrapping
         * helpful for checking balances and allowances
         */
        address wrapCollateralType;
        /**
         * @dev amount of collateral that can be wrapped
         */
        uint256 maxWrappableAmount;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Wrapper", marketId));
        assembly {
            store.slot := s
        }
    }

    function update(
        uint128 marketId,
        address wrapCollateralType,
        uint256 maxWrappableAmount
    ) internal {
        Data storage self = load(marketId);
        self.wrapCollateralType = wrapCollateralType;
        self.maxWrappableAmount = maxWrappableAmount;
    }

    function isValidWrapper(Data storage self) internal view {
        if (self.wrapCollateralType == address(0)) {
            revert InvalidCollateralType();
        }
    }
}
