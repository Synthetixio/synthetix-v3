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
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {IPerpsMarketFactoryModule} from "../interfaces/IPerpsMarketFactoryModule.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/**
 * @title Module for registering perpetual futures markets. The factory tracks all markets in the system and consolidates implementation.
 * @dev See IPerpsMarketFactoryModule.
 */
contract PerpsMarketFactoryModule is IPerpsMarketFactoryModule {
    using AssociatedSystem for AssociatedSystem.Data;
    using PerpsPrice for PerpsPrice.Data;
    using DecimalMath for uint256;

    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";

    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";

    error InvalidMarketOwner();

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

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function createMarket(
        string memory marketName,
        string memory marketSymbol,
        address marketOwner
    ) external override returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_MARKET_FEATURE_FLAG);

        if (marketOwner == address(0)) {
            revert InvalidMarketOwner();
        }

        PerpsMarketFactory.Data storage store = PerpsMarketFactory.load();
        uint128 perpsMarketId = store.synthetix.registerMarket(address(this));

        PerpsMarket.create(perpsMarketId, marketOwner, marketName, marketSymbol);

        emit MarketRegistered(perpsMarketId, marketOwner, marketName, marketSymbol);

        return perpsMarketId;
    }

    function name(uint128 perpsMarketId) external view override returns (string memory) {
        return string.concat(PerpsMarket.load(perpsMarketId).name, " Perps Market");
    }

    function symbol(uint128 perpsMarketId) external view override returns (string memory) {
        return PerpsMarket.load(perpsMarketId).symbol;
    }

    function reportedDebt(uint128 perpsMarketId) external view override returns (uint256) {
        return MathUtil.abs(PerpsMarket.load(perpsMarketId).skew);
    }

    function minimumCredit(uint128 perpsMarketId) external view override returns (uint256) {
        return
            PerpsMarket.load(perpsMarketId).size.mulDecimal(
                PerpsMarketConfiguration.load(perpsMarketId).lockedOiRatioD18
            );
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external override {
        PerpsMarket.loadWithVerifiedOwner(perpsMarketId, msg.sender);

        PerpsPrice.load(perpsMarketId).update(feedId);

        emit MarketPriceDataUpdated(perpsMarketId, feedId);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function nominateMarketOwner(
        uint128 perpsMarketId,
        address newNominatedOwner
    ) external override {
        PerpsMarket.Data storage market = PerpsMarket.loadWithVerifiedOwner(
            perpsMarketId,
            msg.sender
        );

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        market.nominatedOwner = newNominatedOwner;

        emit MarketOwnerNominated(perpsMarketId, newNominatedOwner);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function acceptMarketOwnership(uint128 perpsMarketId) external override {
        PerpsMarket.Data storage market = PerpsMarket.load(perpsMarketId);
        address currentNominatedOwner = market.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit MarketOwnerChanged(perpsMarketId, market.owner, currentNominatedOwner);

        market.owner = currentNominatedOwner;
        market.nominatedOwner = address(0);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function getMarketOwner(uint128 perpsMarketId) external view override returns (address) {
        return PerpsMarket.load(perpsMarketId).owner;
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
