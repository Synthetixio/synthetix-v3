//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/external/IAggregatorV3Interface.sol";

library CollateralConfiguration {
    using SetUtil for SetUtil.AddressSet;

    error InvalidCollateral(address collateralType);

    struct Data {
        /// must be true for staking or collateral delegation
        bool stakingEnabled;
        /// accounts cannot mint sUSD if their debt brings their cratio below this value
        uint targetCRatio;
        /// accounts below the ratio specified here are immediately liquidated
        uint minimumCRatio;
        /// amount of token to award when an account is liquidated with this collateral type
        uint liquidationReward;
        /// address which reports the current price of the collateral
        address priceFeed;
        /// address which should be used for transferring this collateral
        address tokenAddress;
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

    function set(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool stakingEnabled
    ) internal {
        SetUtil.AddressSet storage collateralTypes = loadAvailableCollaterals();

        // TODO: should we be *removing* the collateralType if it is disabled here, or if it is set to nothing?
        if (!collateralTypes.contains(collateralType)) {
            collateralTypes.add(collateralType);
        }

        Data storage collateral = load(collateralType);

        collateral.tokenAddress = collateralType;
        collateral.targetCRatio = targetCRatio;
        collateral.minimumCRatio = minimumCRatio;
        collateral.priceFeed = priceFeed;
        collateral.liquidationReward = liquidationReward;
        collateral.stakingEnabled = stakingEnabled;
    }

    modifier collateralEnabled(address token) {
        if (!load(token).stakingEnabled) {
            revert InvalidCollateral(token);
        }

        _;
    }

    function getCollateralPrice(Data storage self) internal view returns (uint) {
        (, int256 answer, , , ) = IAggregatorV3Interface(self.priceFeed).latestRoundData();

        // sanity check
        // TODO: this will be removed when we get the oracle manager
        require(answer > 0, "The collateral value is 0");

        return uint(answer);
    }
}
