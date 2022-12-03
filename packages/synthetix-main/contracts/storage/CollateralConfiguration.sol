//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/oracle-manager/contracts/storage/Node.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "./OracleManager.sol";

import "../interfaces/external/IAggregatorV3Interface.sol";

library CollateralConfiguration {
    using SetUtil for SetUtil.AddressSet;
    using DecimalMath for uint256;

    error CollateralNotFound();
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
        bytes32 oracleNodeId;
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

        if (!collateralTypes.contains(config.tokenAddress)) {
            collateralTypes.add(config.tokenAddress);
        }

        if (config.minDelegationD18 < config.liquidationRewardD18) {
            revert ParameterError.InvalidParameter("minDelegation", "must be greater than liquidationReward");
        }

        Data storage storedConfig = load(config.tokenAddress);

        storedConfig.tokenAddress = config.tokenAddress;
        storedConfig.issuanceRatioD18 = config.issuanceRatioD18;
        storedConfig.liquidationRatioD18 = config.liquidationRatioD18;
        storedConfig.oracleNodeId = config.oracleNodeId;
        storedConfig.liquidationRewardD18 = config.liquidationRewardD18;
        storedConfig.minDelegationD18 = config.minDelegationD18;
        storedConfig.depositingEnabled = config.depositingEnabled;
    }

    function collateralEnabled(address token) internal view {
        if (!load(token).depositingEnabled) {
            revert CollateralDepositDisabled(token);
        }
    }

    function requireSufficientDelegation(address token, uint amountD18) internal view {
        CollateralConfiguration.Data storage config = load(token);

        uint minDelegationD18 = config.minDelegationD18;

        if (minDelegationD18 == 0) {
            minDelegationD18 = config.liquidationRewardD18;
        }

        if (amountD18 < minDelegationD18) {
            revert InsufficientDelegation(minDelegationD18);
        }
    }

    function getCollateralPrice(Data storage self) internal view returns (uint) {
        OracleManager.Data memory oracleManager = OracleManager.load();
        Node.Data memory node = IOracleManagerModule(oracleManager.oracleManagerAddress).process(self.oracleNodeId);

        return uint(node.price);
    }

    function verifyIssuanceRatio(
        Data storage self,
        uint debtD18,
        uint collateralValueD18
    ) internal view {
        if (debtD18 != 0 && collateralValueD18.divDecimal(debtD18) < self.issuanceRatioD18) {
            revert InsufficientCollateralRatio(
                collateralValueD18,
                debtD18,
                collateralValueD18.divDecimal(debtD18),
                self.issuanceRatioD18
            );
        }
    }

    function convertTokenToSystemAmount(Data storage self, uint tokenAmount) internal view returns (uint) {
        // this extra condition is to prevent potentially malicious untrusted code from being executed on the next statement
        if (self.tokenAddress == address(0)) {
            revert CollateralNotFound();
        }

        return (tokenAmount * DecimalMath.UNIT) / (10**IERC20(self.tokenAddress).decimals());
    }
}
