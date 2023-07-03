//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarketManagerModule} from "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import {AssociatedSystemsModule, AssociatedSystem} from "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import {InitializableMixin} from "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {IPerpsMarketFactoryModule} from "../interfaces/IPerpsMarketFactoryModule.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/**
 * @title Module for registering perpetual futures markets. The factory tracks all markets in the system and consolidates implementation.
 * @dev See IPerpsMarketFactoryModule.
 */
contract PerpsMarketFactoryModule is IPerpsMarketFactoryModule {
    using AssociatedSystem for AssociatedSystem.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsPrice for PerpsPrice.Data;
    using DecimalMath for uint256;

    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";

    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.Data storage store = PerpsMarketFactory.load();

        store.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        store.usdToken = ITokenModule(usdTokenAddress);
        store.oracle = synthetix.getOracleManager();
    }

    function setSpotMarket(ISpotMarketSystem spotMarket) external override {
        OwnableStorage.onlyOwner();

        PerpsMarketFactory.load().spotMarket = spotMarket;
    }

    function initializeFactory() external override returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_MARKET_FEATURE_FLAG);
        OwnableStorage.onlyOwner();

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        if (factory.perpsMarketId == 0) {
            uint128 perpsMarketId = factory.synthetix.registerMarket(address(this));
            factory.perpsMarketId = perpsMarketId;

            emit FactoryInitialized(perpsMarketId);

            return perpsMarketId;
        } else {
            return factory.perpsMarketId;
        }
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function createMarket(
        uint128 requestedMarketId,
        string memory marketName,
        string memory marketSymbol
    ) external override returns (uint128) {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.load().onlyIfInitialized();

        if (requestedMarketId == 0) {
            revert ParameterError.InvalidParameter("requestedMarketId", "cannot be 0");
        }

        PerpsMarket.createValid(requestedMarketId, marketName, marketSymbol);
        GlobalPerpsMarket.load().addMarket(requestedMarketId);

        emit MarketCreated(requestedMarketId, marketName, marketSymbol);

        return requestedMarketId;
    }

    function name(uint128 perpsMarketId) external view override returns (string memory) {
        // todo: set name on initialize?
        return "Perps Market";
    }

    function reportedDebt(uint128 perpsMarketId) external view override returns (uint256) {
        // skew * price - accumulator
        uint price = PerpsPrice.getCurrentPrice(perpsMarketId);

        // TODO - this is a temporary fix since reportedDebt requires a uint and marketDebt is an int (not taking into account margin)
        return MathUtil.abs(PerpsMarket.marketDebt(PerpsMarket.load(perpsMarketId), price));
    }

    function minimumCredit(uint128 perpsMarketId) external view override returns (uint256) {
        return
            PerpsMarket.load(perpsMarketId).size.mulDecimal(
                PerpsMarketConfiguration.load(perpsMarketId).lockedOiRatioD18
            );
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
