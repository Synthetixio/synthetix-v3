//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library Margin {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

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

        // Total available supported collaterals by market.
        uint256 length = globalMarginConfig.supportedAddresses.length;

        // Current mutative collateral type we're iterating over (address and internal obj).
        address currentCollateralType;
        Margin.CollateralType memory currentCollateral;

        uint256 notionalValueUsd;
        for (uint256 i = 0; i < length; ) {
            currentCollateralType = globalMarginConfig.supportedAddresses[i];
            currentCollateral = globalMarginConfig.supported[currentCollateralType];

            // `INodeModule.process()` is an expensive op, skip if we can.
            uint256 available = accountMargin.collaterals[currentCollateralType];
            if (available > 0) {
                uint256 price = INodeModule(globalConfig.oracleManager)
                    .process(currentCollateral.oracleNodeId)
                    .price
                    .toUint();
                notionalValueUsd += available.mulDecimal(price);
            }

            unchecked {
                i++;
            }
        }

        return notionalValueUsd;
    }

    /**
     * @dev Retrieves the `notionalValueUsd - position.feesPaid` on an open position.
     */
    function getMarginUsd(uint128 accountId, PerpMarket.Data storage market) internal view returns (uint256) {
        uint256 notionalValueUsd = getNotionalValueUsd(accountId, market.id);
        uint256 feesIncurredUsd = market.positions[accountId].feesIncurredUsd;
        if (feesIncurredUsd == 0) {
            return notionalValueUsd;
        } else {
            return MathUtil.max(notionalValueUsd.toInt() - feesIncurredUsd.toInt(), 0).toUint();
        }
    }
}
