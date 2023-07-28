//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";

library PerpCollateral {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;

    // --- Constants --- //

    bytes32 private constant _SLOT_NAMESPACE = keccak256(abi.encode("io.synthetix.bfp-market.PerpCollateral"));

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
        mapping(address => uint256) available;
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (PerpCollateral.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpCollateral", accountId, marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (PerpCollateral.GlobalData storage d) {
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
        PerpCollateral.GlobalData storage globalCollateralConfig = PerpCollateral.load();

        price = globalMarketConfig
            .oracleManager
            .process(globalCollateralConfig.supported[collateralType].oracleNodeId)
            .price
            .toUint();
    }

    /**
     * @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function getCollateralUsd(uint128 accountId, uint128 marketId) internal view returns (uint256 collateralValueUsd) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        PerpCollateral.GlobalData storage globalCollateralConfig = PerpCollateral.load();
        PerpCollateral.Data storage accountCollaterals = PerpCollateral.load(accountId, marketId);

        // Total available supported collaterals by market.
        uint256 length = globalCollateralConfig.supportedAddresses.length;

        // Current mutative collateral type we're iterating over (address and internal obj).
        address currentCollateralType;
        PerpCollateral.CollateralType memory currentCollateral;

        for (uint256 i = 0; i < length; ) {
            currentCollateralType = globalCollateralConfig.supportedAddresses[i];
            currentCollateral = globalCollateralConfig.supported[currentCollateralType];

            // `INodeModule.process()` is an expensive op, skip if we can.
            uint256 available = accountCollaterals.available[currentCollateralType];
            if (available > 0) {
                uint256 price = INodeModule(globalConfig.oracleManager)
                    .process(currentCollateral.oracleNodeId)
                    .price
                    .toUint();
                collateralValueUsd += available.mulDecimal(price);
            }

            unchecked {
                i++;
            }
        }
    }
}
