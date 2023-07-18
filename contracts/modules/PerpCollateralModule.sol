//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpCollateral} from "../storage/PerpCollateral.sol";
import {Order} from "../storage/Order.sol";
import {Position} from "../storage/Position.sol";
import {PerpErrors} from "../storage/PerpErrors.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "../interfaces/IPerpCollateralModule.sol";

contract PerpCollateralModule is IPerpCollateralModule {
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @inheritdoc IPerpCollateralModule
     */
    function transferTo(uint128 accountId, uint128 marketId, address collateralType, int256 amountDelta) external {
        // Ensures the account exists (reverts with `AccountNotFound`).
        Account.exists(accountId);

        PerpMarket.Data storage market = PerpMarket.load(marketId);
        PerpCollateral.Data storage accountCollaterals = PerpCollateral.load(accountId, marketId);

        // Prevent collateral transfers when there's a pending order.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            revert PerpErrors.OrderFound(accountId);
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpCollateral.GlobalData storage globalCollateralConfig = PerpCollateral.load();
        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 availableAmount = accountCollaterals.available[collateralType];

        if (amountDelta > 0) {
            // Positive means to deposit into the markets.
            uint256 maxAllowable = globalCollateralConfig.available[collateralType].maxAllowable;

            // Verify whether this will exceed the maximum allowable collateral amount.
            if (availableAmount + absAmountDelta > maxAllowable) {
                revert PerpErrors.MaxCollateralExceeded(amountDelta, maxAllowable);
            }

            accountCollaterals.available[collateralType] += absAmountDelta;
            IERC20(collateralType).transferFrom(msg.sender, address(this), absAmountDelta);
            globalConfig.synthetix.depositMarketCollateral(marketId, collateralType, absAmountDelta);
            emit Transfer(msg.sender, address(this), amountDelta);
        } else if (amountDelta < 0) {
            // Negative means to withdraw from the markets.

            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (availableAmount < absAmountDelta) {
                revert PerpErrors.InsufficientCollateral(availableAmount.toInt(), amountDelta);
            }

            accountCollaterals.available[collateralType] -= absAmountDelta;

            // If an open position exists, verify this does _not_ place them into instant liquidation.
            Position.Data storage position = market.positions[accountId];
            if (position.size != 0) {
                if (position.canLiquidate(market.getOraclePrice())) {
                    revert PerpErrors.CanLiquidatePosition(accountId);
                }
            }

            IERC20(collateralType).transferFrom(address(this), msg.sender, absAmountDelta);
            globalConfig.synthetix.withdrawMarketCollateral(marketId, collateralType, absAmountDelta);
            emit Transfer(address(this), msg.sender, amountDelta);
        } else {
            // A zero amount is a no-op.
            return;
        }
    }

    /**
     * @inheritdoc IPerpCollateralModule
     */
    function setCollateralConfiguration(
        address[] calldata collateralTypes,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables
    ) external {
        OwnableStorage.onlyOwner();
        PerpCollateral.GlobalData storage config = PerpCollateral.load();

        // Clear existing collateral configuration to be replaced with new.
        uint256 existingCollateralLength = config.availableAddresses.length;
        for (uint256 i = 0; i < existingCollateralLength; ) {
            delete config.available[config.availableAddresses[i]];
            unchecked {
                i++;
            }
        }
        delete config.availableAddresses;

        // Update with passed in configuration.
        uint256 newCollateralLength = collateralTypes.length;
        address[] memory newAvailableAddresses = new address[](newCollateralLength);
        for (uint256 i = 0; i < newCollateralLength; ) {
            address collateralType = collateralTypes[i];
            if (collateralType == address(0)) {
                revert InvalidConfiguration();
            }

            config.available[collateralType] = PerpCollateral.CollateralType(oracleNodeIds[i], maxAllowables[i]);
            newAvailableAddresses[i] = collateralType;
            unchecked {
                i++;
            }
        }
        config.availableAddresses = newAvailableAddresses;
    }

    // --- Views --- //

    /**
     * @inheritdoc IPerpCollateralModule
     */
    function getConfiguredCollaterals() external view returns (AvailableCollateral[] memory collaterals) {
        PerpCollateral.GlobalData storage config = PerpCollateral.load();

        uint256 length = config.availableAddresses.length;
        collaterals = new AvailableCollateral[](length);

        for (uint256 i = 0; i < length; ) {
            address _type = config.availableAddresses[i];
            PerpCollateral.CollateralType storage c = config.available[_type];
            collaterals[i] = AvailableCollateral(_type, c.oracleNodeId, c.maxAllowable);
            unchecked {
                i++;
            }
        }
    }
}
