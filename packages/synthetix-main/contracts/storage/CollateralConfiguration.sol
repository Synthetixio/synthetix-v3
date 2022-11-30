//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

import "../interfaces/external/IAggregatorV3Interface.sol";

library CollateralConfiguration {
    using SetUtil for SetUtil.AddressSet;
    using DecimalMath for uint256;

    error InvalidParameters(string incorrectParameter, string help);
    error CollateralDepositDisabled(address collateralType);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDelegation(uint minDelegation);

    struct Data {
        /// must be true for staking or collateral delegation
        bool depositingEnabled;
        /// accounts cannot mint sUSD if their debt brings their cratio below this value
        uint issuanceRatioD18;
        /// accounts below the ratio specified here are immediately liquidated
        uint liquidationRatioD18;
        /// amount of token to award when an account is liquidated with this collateral type
        uint liquidationRewardD18;
        /// address which reports the current price of the collateral
        address priceFeed;
        /// address which should be used for transferring this collateral
        address tokenAddress;
        /// minimum delegation amount (other than 0), to prevent sybil/attacks on the system due to new entries.
        uint minDelegationD18;
    }

    function load(address token) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("CollateralConfiguration", token));
        assembly {
            data.slot := s
        }
    }

    function loadAvailableCollaterals() internal pure returns (SetUtil.AddressSet storage data) {
        bytes32 s = keccak256(abi.encode("CollateralConfiguration_availableCollaterals"));
        assembly {
            data.slot := s
        }
    }

    function set(Data memory config) internal {
        SetUtil.AddressSet storage collateralTypes = loadAvailableCollaterals();

        // TODO: should we be *removing* the collateralType if it is disabled here, or if it is set to nothing?
        if (!collateralTypes.contains(config.tokenAddress)) {
            collateralTypes.add(config.tokenAddress);
        }

        if (config.minDelegationD18 < config.liquidationRewardD18) {
            revert InvalidParameters("minDelegation", "must be greater than liquidationReward");
        }

        Data storage storedConfig = load(config.tokenAddress);

        storedConfig.tokenAddress = config.tokenAddress;
        storedConfig.issuanceRatioD18 = config.issuanceRatioD18;
        storedConfig.liquidationRatioD18 = config.liquidationRatioD18;
        storedConfig.priceFeed = config.priceFeed;
        storedConfig.liquidationRewardD18 = config.liquidationRewardD18;
        storedConfig.minDelegationD18 = config.minDelegationD18;
        storedConfig.depositingEnabled = config.depositingEnabled;
    }

    function collateralEnabled(address token) internal view {
        if (!load(token).depositingEnabled) {
            revert CollateralDepositDisabled(token);
        }
    }

    function requireSufficientDelegation(address token, uint amount) internal view {
        CollateralConfiguration.Data storage config = load(token);

        uint minDelegationD18 = config.minDelegationD18;

        if (minDelegationD18 == 0) {
            minDelegationD18 = config.liquidationRewardD18;
        }

        if (amount < minDelegationD18) {
            revert InsufficientDelegation(minDelegationD18);
        }
    }

    function getCollateralPrice(Data storage self) internal view returns (uint) {
        (, int256 answerD18, , , ) = IAggregatorV3Interface(self.priceFeed).latestRoundData();

        // sanity check
        // TODO: this will be removed when we get the oracle manager
        require(answerD18 > 0, "The collateral value is 0");

        return uint(answerD18);
    }

    function verifyCollateralRatio(
        Data storage self,
        uint debt,
        uint collateralValue
    ) internal view {
        if (debt != 0 && collateralValue.divDecimal(debt) < self.issuanceRatioD18) {
            revert InsufficientCollateralRatio(
                collateralValue,
                debt,
                collateralValue.divDecimal(debt),
                self.issuanceRatioD18
            );
        }
    }
}
