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
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import "../interfaces/IMarketCollateralModule.sol";

contract MarketCollateralModule is IMarketCollateralModule {
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function transferTo(uint128 accountId, uint128 marketId, address collateralType, int256 amountDelta) external {
        if (collateralType == address(0)) {
            revert ZeroAddress();
        }

        // Ensures the account exists (reverts with `AccountNotFound`).
        Account.exists(accountId);

        PerpMarket.Data storage market = PerpMarket.load(marketId);
        PerpCollateral.Data storage accountCollaterals = PerpCollateral.load(accountId, marketId);

        // Prevent collateral transfers when there's a pending order.
        Order.Data storage order = market.orders[accountId];
        if (order.sizeDelta != 0) {
            revert ErrorUtil.OrderFound(accountId);
        }

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpCollateral.GlobalData storage globalCollateralConfig = PerpCollateral.load();
        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 availableAmount = accountCollaterals.available[collateralType];

        PerpCollateral.CollateralType storage collateral = globalCollateralConfig.available[collateralType];
        if (collateral.oracleNodeId == "") {
            revert UnsupportedCollateral(collateralType);
        }

        if (amountDelta > 0) {
            // Positive means to deposit into the markets.
            uint256 maxAllowable = collateral.maxAllowable;

            // Verify whether this will exceed the maximum allowable collateral amount.
            if (availableAmount + absAmountDelta > maxAllowable) {
                revert MaxCollateralExceeded(absAmountDelta, maxAllowable);
            }

            accountCollaterals.available[collateralType] += absAmountDelta;
            IERC20(collateralType).transferFrom(msg.sender, address(this), absAmountDelta);
            globalConfig.synthetix.depositMarketCollateral(marketId, collateralType, absAmountDelta);
            emit Transfer(msg.sender, address(this), absAmountDelta);
        } else if (amountDelta < 0) {
            // Negative means to withdraw from the markets.

            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (availableAmount < absAmountDelta) {
                revert InsufficientCollateral(collateralType, availableAmount, amountDelta);
            }

            accountCollaterals.available[collateralType] -= absAmountDelta;

            // If an open position exists, verify this does _not_ place them into instant liquidation.
            Position.Data storage position = market.positions[accountId];
            if (position.size != 0) {
                if (position.canLiquidate(market.getOraclePrice())) {
                    revert ErrorUtil.CanLiquidatePosition(accountId);
                }
            }

            globalConfig.synthetix.withdrawMarketCollateral(marketId, collateralType, absAmountDelta);
            IERC20(collateralType).transferFrom(address(this), msg.sender, absAmountDelta);
            emit Transfer(address(this), msg.sender, absAmountDelta);
        } else {
            // A zero amount is a no-op.
            return;
        }
    }

    /**
     * @inheritdoc IMarketCollateralModule
     */
    function setCollateralConfiguration(
        address[] calldata collateralTypes,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration.load();
        PerpCollateral.GlobalData storage config = PerpCollateral.load();

        // Clear existing collateral configuration to be replaced with new.
        uint256 existingCollateralLength = config.availableAddresses.length;
        for (uint256 i = 0; i < existingCollateralLength; ) {
            address collateralType = config.availableAddresses[i];
            delete config.available[collateralType];

            // Revoke access after wiping collateral from supported market collateral.
            //
            // TODO: Add this back later. Synthetix IERC20.approve contracts throw InvalidParameter when amount = 0.
            //
            // IERC20(collateralType).approve(address(this), 0);

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
                revert ZeroAddress();
            }

            // Perform this operation _once_ when this collateral is added as a supported collateral.
            uint128 maxAllowable = maxAllowables[i];
            IERC20(collateralType).approve(address(globalMarketConfig.synthetix), maxAllowable);
            IERC20(collateralType).approve(address(this), maxAllowable);
            config.available[collateralType] = PerpCollateral.CollateralType(oracleNodeIds[i], maxAllowable);
            newAvailableAddresses[i] = collateralType;

            unchecked {
                i++;
            }
        }
        config.availableAddresses = newAvailableAddresses;

        emit CollateralConfigured(msg.sender, newCollateralLength);
    }

    // --- Views --- //

    /**
     * @inheritdoc IMarketCollateralModule
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
