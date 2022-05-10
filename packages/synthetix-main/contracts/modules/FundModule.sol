//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

import "../satellites/FundToken.sol";

contract FundModule is IFundModule, OwnableMixin, FundModuleStorage, InitializableMixin, SatelliteFactory {
    event FundCreated(address fundAddress);

    error InvalidParameters();
    error FundAlreadyApproved(uint fundId);
    error FundNotFound(uint fundId);

    /////////////////////////////////////////////////
    // CHORES
    /////////////////////////////////////////////////

    function _isInitialized() internal view override returns (bool) {
        return _fundModuleStore().initialized;
    }

    function isFundModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeFundModule() external override onlyOwner onlyIfNotInitialized {
        FundModuleStore storage store = _fundModuleStore();

        FundToken firstFundImplementation = new FundToken();

        UUPSProxy fundProxy = new UUPSProxy(address(firstFundImplementation));

        address fundProxyAddress = address(fundProxy);
        FundToken fund = FundToken(fundProxyAddress);

        fund.nominateNewOwner(address(this));
        fund.acceptOwnership();
        fund.initialize("Synthetix FundToken", "synthethixFundToken", "");

        store.fundToken = Satellite({
            name: "synthethixFundToken",
            contractName: "FundToken",
            deployedAddress: fundProxyAddress
        });

        store.initialized = true;

        emit FundCreated(fundProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _fundModuleStore().fundToken;
        return satellites;
    }

    function getFundModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeFundTokenImplementation(address newFundTokenImplementation)
        external
        override
        onlyOwner
        onlyIfInitialized
    {
        FundToken(getFundTokenAddress()).upgradeTo(newFundTokenImplementation);
    }

    function getFundTokenAddress() public view override returns (address) {
        return _fundModuleStore().fundToken.deployedAddress;
    }

    //////////////////////////////////////////////
    //          BUSINESS LOGIC                  //
    //////////////////////////////////////////////

    //////////////////////////////////////////////
    //          OWNERSHIP                       //
    //////////////////////////////////////////////
    modifier onlyFundOwner(uint fundId, address requestor) {
        if (FundToken(getFundTokenAddress()).ownerOf(fundId) != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    modifier onlyAccountAuthorized(uint accountId, address requestor) {
        // TODO Check if requestor is authorized in account
        // if (FundToken(getFundTokenAddress()).ownerOf(fundId) != requestor) {
        //     revert AccessError.Unauthorized();
        // }

        _;
    }

    function createFund(uint requestedFundId, address owner) external override {
        FundToken(getFundTokenAddress()).mint(owner, requestedFundId);
    }

    function nominateFundOwner(uint fundId, address owner) external override {
        FundToken(getFundTokenAddress()).nominateNewOwner(msg.sender, owner, fundId);
    }

    function acceptFundOwnership(uint fundId) external override {
        FundToken(getFundTokenAddress()).acceptOwnership(msg.sender, fundId);
    }

    function renounceFundOwnership(uint fundId) external override {
        FundToken(getFundTokenAddress()).renounceNomination(msg.sender, fundId);
    }

    //////////////////////////////////////////////
    //          OWNERSHIP                       //
    //////////////////////////////////////////////
    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external override onlyFundOwner(fundId, msg.sender) {
        if (markets.length != weights.length) {
            revert InvalidParameters();
        }

        FundData storage fund = _fundModuleStore().funds[fundId];

        // TODO check changes in markets/weights
        _rebalanceMarkets(fundId, true);

        // Cleanup previous distribution
        delete fund.fundDistribution;
        fund.totalWeights = 0;

        for (uint i = 0; i < markets.length; i++) {
            MarketDistribution memory distribution;
            distribution.market = markets[i];
            distribution.weight = weights[i];

            fund.fundDistribution.push(distribution);
            fund.totalWeights += weights[i];
        }

        _rebalanceMarkets(fundId, false);

        // TODO emit an event
    }

    //////////////////////////////////////////////
    //          REBALANCE                       //
    //////////////////////////////////////////////

    function rebalanceMarkets(uint fundId) public override {
        // TODO check something (if needed)

        _rebalanceMarkets(fundId, false);

        // TODO emit an event
    }

    function _rebalanceMarkets(uint fundId, bool zeros) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint totalWeights = _fundModuleStore().funds[fundId].totalWeights;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            uint weight = zeros ? 0 : fundData.fundDistribution[i].weight;
            _setCollateralDistribution(fundId, fundData.fundDistribution[i].market, weight, totalWeights);
        }
    }

    function _setCollateralDistribution(
        uint fundId,
        uint marketId,
        uint marketWeight,
        uint totalWeight
    ) internal {
        // TODO
    }

    //////////////////////////////////////////////
    //          DELEGATION                      //
    //////////////////////////////////////////////

    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyAccountAuthorized {
        // TODO check if fund exists
        // TODO check parameters are valid (collateralType, amount, exposure)

        bytes32 lpid = _getLiquidityItemId(fundId, accountId, collateralType, leverage);

        if (!_fundModuleStore().liquidityItemIds[fundId].contains(lpid)) {
            // lpid not found in set =>  new position
            _addPosition(lpid, fundId, accountId, collateralType, amount, leverage);
        } else {
            // Position found, need to adjust (increase, decrease or remove)
            LiquidityItem storage liquidityItem = _fundModuleStore().liquidityItems[fundId][lpid];

            if (
                liquidityItem.accountId != accountId ||
                liquidityItem.collateralType != collateralType ||
                liquidityItem.leverage != leverage
            ) {
                // Wrong parameters (in fact should be another lpid) but prefer to be on the safe side. Check and revert
                revert InvalidParameters();
            }

            if (amount == 0) {
                _removePosition(lpid, liquidityItem, fundId, accountId, collateralType);
            } else if (liquidityItem.collateralAmount < amount) {
                _increasePosition(liquidityItem, fundId, accountId, collateralType, amount, leverage);
            } else if (liquidityItem.collateralAmount > amount) {
                _decreasePosition(liquidityItem, fundId, accountId, collateralType, amount, leverage);
            } else {
                // no change
                revert InvalidParameters();
            }
        }

        rebalanceMarkets(fundId);
    }

    function _addPosition(
        bytes32 liquidityItemId,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        _fundModuleStore().liquidityItemIds[fundId].add(liquidityItemId);

        LiquidityItem memory liquidityItem;
        liquidityItem.collateralType = collateralType;
        liquidityItem.accountId = accountId;
        liquidityItem.leverage = leverage;
        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = _calculateShares(fundId, collateralType, amount, leverage);
        liquidityItem.initialDebt = _calculateInitialDebt(fundId, collateralType, amount, leverage); // how that works with amount adjustments?

        _fundModuleStore().liquidityItems[fundId][liquidityItemId] = liquidityItem;
    }

    function _removePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        uint accountId,
        address collateralType
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        _fundModuleStore().liquidityItemIds[fundId].remove(liquidityItemId);

        liquidityItem.collateralAmount = 0;
        liquidityItem.shares = 0;
        liquidityItem.initialDebt = 0; // how that works with amount adjustments?

        _fundModuleStore().liquidityItems[fundId][liquidityItemId] = liquidityItem;
    }

    function _increasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = _calculateShares(fundId, collateralType, amount, leverage);
        liquidityItem.initialDebt = _calculateInitialDebt(fundId, collateralType, amount, leverage); // how that works with amount adjustments?

        _fundModuleStore().liquidityItems[fundId][liquidityItemId] = liquidityItem;
    }

    function _decreasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = _calculateShares(fundId, collateralType, amount, leverage);
        liquidityItem.initialDebt = _calculateInitialDebt(fundId, collateralType, amount, leverage); // how that works with amount adjustments?

        _fundModuleStore().liquidityItems[fundId][liquidityItemId] = liquidityItem;
    }

    function _calculateShares(
        uint fundId,
        uint collateralType,
        uint amount,
        uint leverage
    ) internal returns (uint) {
        // TODO implement it
        return 0;
    }

    function _calculateInitialDebt(
        uint fundId,
        uint collateralType,
        uint amount,
        uint leverage
    ) internal returns (uint) {
        // TODO implement it
        return 0;
    }

    //////////////////////////////////////////////
    //          MINTING/BURNING sUSD            //
    //////////////////////////////////////////////

    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyAccountAuthorized {
        // TODO Check if can mint that amount
    }

    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyAccountAuthorized {
        // TODO Check if can burn that amount
    }

    //////////////////////////////////////////////
    //          CRatio and Debt queries         //
    //////////////////////////////////////////////
    function collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) external override {}

    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external override {}

    function fundDebt(uint fundId) external override {}

    function totalDebtShares(uint fundId) external override {}

    function debtPerShare(uint fundId) external override {}

    /////////////////////////////////////////////////
    // SCCP
    /////////////////////////////////////////////////

    function setPreferredFund(uint fundId) external override onlyOwner {
        _fundModuleStore().preferredFund = fundId;
    }

    function getPreferredFund() external override returns (uint) {
        return _fundModuleStore().preferredFund;
    }

    function addApprovedFund(uint fundId) external override onlyOwner {
        for (uint i = 0; i < _fundModuleStore().approvedFunds.length; i++) {
            if (_fundModuleStore().approvedFunds[i] == fundId) {
                revert FundAlreadyApproved(fundId);
            }
        }

        _fundModuleStore().approvedFunds.push(fundId);
    }

    function removeApprovedFund(uint fundId) external override onlyOwner {
        bool found;
        for (uint i = 0; i < _fundModuleStore().approvedFunds.length; i++) {
            if (_fundModuleStore().approvedFunds[i] == fundId) {
                _fundModuleStore().approvedFunds[i] = _fundModuleStore().approvedFunds[
                    _fundModuleStore().approvedFunds.length - 1
                ];
                _fundModuleStore().approvedFunds.pop();
                found = true;
                break;
            }
        }

        if (!found) {
            revert FundNotFound(fundId);
        }
    }

    function getApprovedFunds() external override returns (uint[] calldata) {
        return _fundModuleStore().approvedFunds;
    }

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    function _getLiquidityItemId(
        uint fundId,
        uint accountId,
        address collateralType,
        uint leverage
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(fundId, accountId, collateralType, leverage));
    }

    // TODO Check ERC4626 logic. a lot of the stuff is there

    // function accountDebt(uint fundId, uint accountId) public override returns (uint) {
    //     // bytes32 lpid = _calculateLPId(fundId, accountId, collateralType, leverage);
    //     // LiquidityProvider storage position = _fundModuleStore().liquidityProviders[lpid];
    //     bytes32[] storage liquidityProviderIds = _fundModuleStore().liquidityProviderIds[fundId];
    //     for (uint i = 0; i < liquidityProviderIds.length; i++) {
    //         LiquidityProvider storage lp = _fundModuleStore().liquidityProviders[liquidityProviderIds[i]];
    //         if (lp.accountId == accountId) {
    //             // do the math with
    //             // lp.leverage;
    //             // lp.collateralAmount;
    //             // lp.shares;
    //             // lp.initialDebt;
    //         }
    //     }

    //     return 0;
    //     // accountCollateralValue(accountId) +
    //     // position.initialDebt -
    //     // totalDebt() *
    //     // (accountShares(accountId) / totalShares());
    // }

    // function accountCollateralValue(uint accountId) public view override returns (uint) {
    //     return 0;
    //     // TODO return positions[accountId].amount - positions[accountId].amount * token(accountEntry.collateralToken).value;
    // }

    // function getCRation(uint fundId, uint accountId) public override returns (uint) {
    //     return accountCollateralValue(accountId) / accountDebt(fundId, accountId);
    // }

    // function _setMarkets(uint[] calldata marketIds, uint[] calldata weights) internal {}

    // function _assignCollateralToMarket() internal {}
}
