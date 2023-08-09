//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {Position} from "./Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

library Margin {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Constants --- //

    bytes32 private constant _SLOT_NAMESPACE = keccak256(abi.encode("io.synthetix.bfp-market.Margin"));

    // --- Structs --- //

    struct CollateralType {
        // Oracle price feed node id.
        bytes32 oracleNodeId;
        // Maximum allowable deposited amount.
        uint128 maxAllowable;
    }

    // --- Storage --- //

    struct GlobalData {
        // {collateralAddress: CollateralType}.
        mapping(address => CollateralType) supported;
        // Array of addresses of supported collaterals for iteration.
        address[] supportedAddresses;
    }

    struct Data {
        // {collateralAddress: amount} (amount of collateral deposited into this account).
        mapping(address => uint256) collaterals;
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (Margin.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin", accountId, marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (Margin.GlobalData storage d) {
        bytes32 s = _SLOT_NAMESPACE;

        assembly {
            d.slot := s
        }
    }

    // --- Mutative --- //

    // TODO: Need better names for `updateCollateralUsd` and `writeOffCollateral` :thinking:

    /**
     * @dev Reduces deposited collateral amountUsd
     */
    function updateCollateralUsd(uint128 accountId, PerpMarket.Data storage market, int256 amountUsd) internal {
        // Nothing to update, this is a no-op.
        if (amountUsd == 0) {
            return;
        }

        // This is invoked when an order is settled and a modification of an existing position needs to be
        // performed. There are a few scenarios we are trying to capture:
        //
        // 1. Increasing size for a profitable position
        // 2. Increasing size for a unprofitable position
        // 3. Decreasing size for an profitable position (partial close)
        // 4. Decreasing size for an unprofitable position (partial close)
        // 5. Closing a profitable position (full close)
        // 6. Closing an unprofitable position (full close)
        //
        // The commonalities:
        // - There is an existing position
        // - All position modifications involve 'touching' a position which realizes the profit/loss
        // - All profitable positions are given more sUSD as collateral
        // - All accounting can be performed within the market (i.e. no need to move tokens around)

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);
        address usdToken = address(globalConfig.usdToken);

        if (amountUsd > 0) {
            accountMargin.collaterals[usdToken] += amountUsd.toUint();
        } else {
            Margin.GlobalData storage globalMarginConfig = Margin.load();
            uint256 length = globalMarginConfig.supportedAddresses.length;
            uint256 amountToDeductUsd = MathUtil.abs(amountUsd);

            // Variable declaration outside of loop to be more gas efficient.
            Margin.CollateralType memory collateral;
            address collateralType;
            uint256 available;
            uint256 price;
            uint256 deductionAmount;
            uint256 deductionAmountUsd;

            for (uint256 i = 0; i < length; ) {
                collateralType = globalMarginConfig.supportedAddresses[i];
                collateral = globalMarginConfig.supported[collateralType];
                available = accountMargin.collaterals[collateralType];

                if (available > 0) {
                    price = INodeModule(globalConfig.oracleManager).process(collateral.oracleNodeId).price.toUint();
                    deductionAmountUsd = MathUtil.min(amountToDeductUsd, available.mulDecimal(price));
                    deductionAmount = deductionAmountUsd.divDecimal(price);
                    accountMargin.collaterals[collateralType] -= deductionAmount;
                    amountToDeductUsd -= deductionAmountUsd;
                }

                unchecked {
                    i++;
                }
            }

            // Not enough remaining margin to deduct from `-amount`.
            //
            // TODO: Think through when this could happen and if reverting is the best path forward.
            if (amountToDeductUsd > 0) {
                revert ErrorUtil.InsufficientMargin();
            }
        }
    }

    /**
     * @dev Zeros out the deposited collateral for `accountId` in `marketId`.
     */
    function writeOffCollateral(uint128 accountId, uint128 marketId) internal {
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedAddresses.length;
        address collateralType;
        uint256 available;

        for (uint256 i = 0; i < length; ) {
            collateralType = globalMarginConfig.supportedAddresses[i];
            available = accountMargin.collaterals[collateralType];

            if (available > 0) {
                accountMargin.collaterals[collateralType] = 0;
            }

            unchecked {
                i++;
            }
        }
    }

    // --- Views --- //

    /**
     * @dev Returns the latest oracle price for the collateral at `collateralType`.
     */
    function getOraclePrice(address collateralType) internal view returns (uint256 price) {
        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        price = globalMarketConfig
            .oracleManager
            .process(globalMarginConfig.supported[collateralType].oracleNodeId)
            .price
            .toUint();
    }

    /**
     * @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function getNotionalValueUsd(uint128 accountId, uint128 marketId) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedAddresses.length;

        // Variable declaration outside of loop to be more gas efficient.
        address collateralType;
        Margin.CollateralType memory collateral;
        uint256 available;
        uint256 price;
        uint256 notionalValueUsd;

        for (uint256 i = 0; i < length; ) {
            collateralType = globalMarginConfig.supportedAddresses[i];
            collateral = globalMarginConfig.supported[collateralType];

            // `INodeModule.process()` is an expensive op, skip if we can.
            available = accountMargin.collaterals[collateralType];
            if (available > 0) {
                price = INodeModule(globalConfig.oracleManager).process(collateral.oracleNodeId).price.toUint();
                notionalValueUsd += available.mulDecimal(price);
            }

            unchecked {
                i++;
            }
        }

        return notionalValueUsd;
    }

    /**
     * @dev Returns the `notionalValueUsd - position.feesPaid` on an open position.
     */
    function getMarginUsd(uint128 accountId, PerpMarket.Data storage market) internal view returns (uint256) {
        uint256 notionalValueUsd = getNotionalValueUsd(accountId, market.id);
        Position.Data storage position = market.positions[accountId];

        if (position.size == 0) {
            return notionalValueUsd;
        }

        uint256 oraclePrice = market.getOraclePrice();
        return
            MathUtil
                .max(
                    notionalValueUsd.toInt() +
                        position.getPnl(oraclePrice) +
                        position.getAccruedFunding(market, oraclePrice) -
                        position.feesIncurredUsd.toInt(),
                    0
                )
                .toUint();
    }
}
