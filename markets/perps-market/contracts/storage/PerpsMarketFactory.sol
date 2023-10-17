//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {GlobalPerpsMarketConfiguration} from "./GlobalPerpsMarketConfiguration.sol";

/**
 * @title Main factory library that registers perps markets.  Also houses global configuration for all perps markets.
 */
library PerpsMarketFactory {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;

    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));

    error PerpsMarketNotInitialized();
    error PerpsMarketAlreadyInitialized();

    struct Data {
        /**
         * @dev oracle manager address used for price feeds
         */
        INodeModule oracle;
        ITokenModule usdToken;
        /**
         * @dev Synthetix core v3 proxy address
         */
        ISynthetixSystem synthetix;
        ISpotMarketSystem spotMarket;
        uint128 perpsMarketId;
        string name;
    }

    function onlyIfInitialized(Data storage self) internal view {
        if (self.perpsMarketId == 0) {
            revert PerpsMarketNotInitialized();
        }
    }

    function onlyIfNotInitialized(Data storage self) internal view {
        if (self.perpsMarketId != 0) {
            revert PerpsMarketAlreadyInitialized();
        }
    }

    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }

    function initialize(
        Data storage self,
        ISynthetixSystem synthetix,
        ISpotMarketSystem spotMarket,
        string memory name
    ) internal returns (uint128 perpsMarketId) {
        onlyIfNotInitialized(self); // redundant check, but kept here in case this internal is called somewhere else

        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        perpsMarketId = synthetix.registerMarket(address(this));

        self.spotMarket = spotMarket;
        self.synthetix = synthetix;
        self.name = name;
        self.usdToken = ITokenModule(usdTokenAddress);
        self.oracle = synthetix.getOracleManager();
        self.perpsMarketId = perpsMarketId;
    }

    function depositMarketCollateral(
        Data storage self,
        ITokenModule collateral,
        uint256 amount
    ) internal {
        collateral.approve(address(self.synthetix), amount);
        self.synthetix.depositMarketCollateral(self.perpsMarketId, address(collateral), amount);
    }

    function depositMarketUsd(Data storage self, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        self.synthetix.depositMarketUsd(self.perpsMarketId, address(this), amount);
    }

    function withdrawMarketUsd(Data storage self, address to, uint256 amount) internal {
        self.synthetix.withdrawMarketUsd(self.perpsMarketId, to, amount);
    }

    /**
     * @notice This function returns the value of an amount of synth.
     * @dev    Use the same oracle node that is configured on the core system for the synth
     * @dev    Use the configured staleness tolerance if strict
     */
    function getSynthValue(
        Data storage self,
        uint128 synthMarketId,
        uint256 synthAmount,
        bool useStrictStalenessTolerance
    ) internal view returns (uint) {
        uint runtimeArgCount = useStrictStalenessTolerance ? 2 : 1;
        bytes32[] memory runtimeKeys = new bytes32[](runtimeArgCount);
        bytes32[] memory runtimeValues = new bytes32[](runtimeArgCount);

        if (useStrictStalenessTolerance) {
            uint stalenessTolerance = GlobalPerpsMarketConfiguration
                .load()
                .collateralStalenessTolerance(synthMarketId);

            runtimeKeys[0] = bytes32("amount");
            runtimeValues[0] = bytes32(synthAmount);
            runtimeKeys[1] = bytes32("stalenessTolerance");
            runtimeValues[1] = bytes32(stalenessTolerance);
        } else {
            runtimeKeys[0] = bytes32("amount");
            runtimeValues[0] = bytes32(synthAmount);
        }

        bytes32 synthNodeId = getSynthOracle(self, synthMarketId);
        NodeOutput.Data memory output = self.oracle.processWithRuntime(
            synthNodeId,
            runtimeKeys,
            runtimeValues
        );

        return output.price.toUint().mulDecimal(synthAmount);
    }

    function getSynthOracle(
        Data storage self,
        uint128 synthMarketId
    ) internal view returns (bytes32) {
        address synthToken = self.spotMarket.getSynth(synthMarketId);
        return self.synthetix.getCollateralConfiguration(synthToken).oracleNodeId;
    }
}
