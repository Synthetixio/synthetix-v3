//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {SpotMarketFactory} from "./SpotMarketFactory.sol";

/**
 * @title Wrapper library servicing the wrapper module
 */
library Wrapper {
    error InvalidCollateralType(address configuredCollateralType);
    /**
     * @notice Thrown when user tries to wrap more than the set supply cap for the market.
     */
    error WrapperExceedsMaxAmount(
        uint256 maxWrappableAmount,
        uint256 currentSupply,
        uint256 amountToWrap
    );

    struct Data {
        /**
         * @dev tracks the type of collateral used for wrapping
         * helpful for checking balances and allowances
         */
        address wrapCollateralType;
        /**
         * @dev amount of collateral that can be wrapped, denominated with 18 decimals of precision.
         */
        uint256 maxWrappableAmount;
    }

    function load(uint128 marketId) internal pure returns (Data storage wrapper) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Wrapper", marketId));
        assembly {
            wrapper.slot := s
        }
    }

    function checkMaxWrappableAmount(
        Data storage self,
        uint128 marketId,
        uint256 wrapAmount,
        ISynthetixSystem synthetix
    ) internal view {
        uint256 currentDepositedCollateral = synthetix.getMarketCollateralAmount(
            marketId,
            self.wrapCollateralType
        );
        if (currentDepositedCollateral + wrapAmount > self.maxWrappableAmount) {
            revert WrapperExceedsMaxAmount(
                self.maxWrappableAmount,
                currentDepositedCollateral,
                wrapAmount
            );
        }
    }

    function updateValid(
        uint128 marketId,
        address wrapCollateralType,
        uint256 maxWrappableAmount
    ) internal {
        Data storage self = load(marketId);
        address configuredCollateralType = self.wrapCollateralType;

        uint256 currentMarketCollateralAmount = SpotMarketFactory
            .load()
            .synthetix
            .getMarketCollateralAmount(marketId, configuredCollateralType);
        // you are only allowed to update the collateral type if the collateral amount deposited
        // into the market manager is 0.
        if (wrapCollateralType != configuredCollateralType && currentMarketCollateralAmount != 0) {
            revert InvalidCollateralType(configuredCollateralType);
        }

        self.wrapCollateralType = wrapCollateralType;
        self.maxWrappableAmount = maxWrappableAmount;
    }

    function validateWrapper(Data storage self) internal view {
        if (self.wrapCollateralType == address(0)) {
            revert InvalidCollateralType(address(0));
        }
    }
}
