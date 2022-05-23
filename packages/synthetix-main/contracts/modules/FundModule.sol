//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/CollateralMixin.sol";

import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

import "../satellites/FundToken.sol";

contract FundModule is
    IFundModule,
    OwnableMixin,
    FundModuleStorage,
    InitializableMixin,
    SatelliteFactory,
    AccountRBACMixin,
    CollateralMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;

    error InvalidParameters();
    error FundAlreadyApproved(uint fundId);
    error FundNotFound(uint fundId);
    error OnlyTokenProxyAllowed(address origin);

    event PreferredFundSet(uint256 fundId);
    event FundApprovedAdded(uint256 fundId);
    event FundApprovedRemoved(uint256 fundId);

    event FundCreated(address fundAddress);
    event FundPositionSet(uint fundId, uint[] markets, uint[] weights, address executedBy);
    event DelegationUpdated(
        bytes32 liquidityItemId,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    );
    event PositionAdded(
        bytes32 liquidityItemId,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage,
        uint shares,
        uint initialDebt
    );
    event PositionRemoved(bytes32 liquidityItemId, uint fundId, uint accountId, address collateralType);
    event PositionIncreased(
        bytes32 liquidityItemId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage,
        uint shares,
        uint initialDebt
    );

    event PositionDecreased(
        bytes32 liquidityItemId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage,
        uint shares,
        uint initialDebt
    );

    // ---------------------------------------
    // Chores
    // ---------------------------------------
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

    // ---------------------------------------
    // SCCP
    // ---------------------------------------

    function setPreferredFund(uint fundId) external override onlyOwner {
        FundToken(getFundTokenAddress()).ownerOf(fundId); // Will revert if do not exists

        _fundModuleStore().preferredFund = fundId;

        emit PreferredFundSet(fundId);
    }

    function getPreferredFund() external view override returns (uint) {
        return _fundModuleStore().preferredFund;
    }

    function addApprovedFund(uint fundId) external override onlyOwner {
        FundToken(getFundTokenAddress()).ownerOf(fundId); // Will revert if do not exists

        for (uint i = 0; i < _fundModuleStore().approvedFunds.length; i++) {
            if (_fundModuleStore().approvedFunds[i] == fundId) {
                revert FundAlreadyApproved(fundId);
            }
        }

        _fundModuleStore().approvedFunds.push(fundId);

        emit FundApprovedAdded(fundId);
    }

    function removeApprovedFund(uint fundId) external override onlyOwner {
        FundToken(getFundTokenAddress()).ownerOf(fundId); // Will revert if do not exists

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

        emit FundApprovedRemoved(fundId);
    }

    function getApprovedFunds() external view override returns (uint[] memory) {
        return _fundModuleStore().approvedFunds;
    }

    // ---------------------------------------
    // Minting
    // ---------------------------------------

    modifier onlyFundOwner(uint fundId, address requestor) {
        if (FundToken(getFundTokenAddress()).ownerOf(fundId) != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    function createFund(uint requestedFundId, address owner) external override {
        FundToken(getFundTokenAddress()).mint(owner, requestedFundId);
    }

    // ---------------------------------------
    // fund admin
    // ---------------------------------------
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
            // TODO check if market exists
            MarketDistribution memory distribution;
            distribution.market = markets[i];
            distribution.weight = weights[i];

            fund.fundDistribution.push(distribution);
            fund.totalWeights += weights[i];
        }

        _rebalanceMarkets(fundId, false);

        emit FundPositionSet(fundId, markets, weights, msg.sender);
    }

    function getFundPosition(uint fundId) external view override returns (uint[] memory, uint[] memory) {
        FundData storage fund = _fundModuleStore().funds[fundId];

        uint[] memory markets = new uint[](fund.fundDistribution.length);
        uint[] memory weights = new uint[](fund.fundDistribution.length);

        for (uint i = 0; i < fund.fundDistribution.length; i++) {
            markets[i] = fund.fundDistribution[i].market;
            weights[i] = fund.fundDistribution[i].weight;
        }

        return (markets, weights);
    }

    // ---------------------------------------
    // rebalance
    // ---------------------------------------
    function rebalanceMarkets(uint fundId) public override {
        // TODO check something (if needed)

        _rebalanceMarkets(fundId, false);

        // TODO emit an event
    }

    function _rebalanceMarkets(uint fundId, bool clearsLiquidity) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint totalWeights = _fundModuleStore().funds[fundId].totalWeights;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            uint weight = clearsLiquidity ? 0 : fundData.fundDistribution[i].weight;
            _distributeCollaterals(fundId, fundData.fundDistribution[i].market, weight, totalWeights);
        }
    }

    function _distributeCollaterals(
        uint fundId,
        uint marketId,
        uint marketWeight,
        uint totalWeight
    ) internal {
        // TODO
    }

    // ---------------------------------------
    // delegation
    // ---------------------------------------

    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) {
        FundToken(getFundTokenAddress()).ownerOf(fundId); // Will revert if do not exists

        bytes32 lpid = _getLiquidityItemId(accountId, collateralType, leverage);

        FundData storage fundData = _fundModuleStore().funds[fundId];
        SetUtil.Bytes32Set storage liquidityItemIds = fundData.liquidityItemIds;

        if (!liquidityItemIds.contains(lpid)) {
            if (_getAccountUnassignedCollateral(accountId, collateralType) < amount) {
                revert InsufficientAvailableCollateral(accountId, collateralType, amount);
            }

            // lpid not found in set =>  new position
            _addPosition(lpid, fundId, accountId, collateralType, amount, leverage);
        } else {
            // Position found, need to adjust (increase, decrease or remove)
            LiquidityItem storage liquidityItem = fundData.liquidityItems[lpid];

            if (
                liquidityItem.accountId != accountId ||
                liquidityItem.collateralType != collateralType ||
                liquidityItem.leverage != leverage
            ) {
                // Wrong parameters (in fact should be another lpid) but prefer to be on the safe side. Check and revert
                revert InvalidParameters();
            }

            uint currentLiquidityAmount = liquidityItem.collateralAmount;

            if (amount == 0) {
                _removePosition(lpid, liquidityItem, fundId, accountId, collateralType);
            } else if (currentLiquidityAmount < amount) {
                if (_getAccountUnassignedCollateral(accountId, collateralType) < amount - currentLiquidityAmount) {
                    revert InsufficientAvailableCollateral(accountId, collateralType, amount);
                }

                _increasePosition(lpid, liquidityItem, fundId, collateralType, amount, leverage);
            } else if (currentLiquidityAmount > amount) {
                _decreasePosition(lpid, liquidityItem, fundId, collateralType, amount, leverage);
            } else {
                // no change
                revert InvalidParameters();
            }
        }

        rebalanceMarkets(fundId);

        emit DelegationUpdated(lpid, fundId, accountId, collateralType, amount, leverage);
    }

    function _addPosition(
        bytes32 liquidityItemId,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint collateralValue = amount * _getCollateralValue(collateralType);

        fundData.liquidityItemIds.add(liquidityItemId);

        uint shares = _convertToShares(fundId, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(fundId, collateralValue, leverage); // how that works with amount adjustments?

        LiquidityItem memory liquidityItem;
        liquidityItem.collateralType = collateralType;
        liquidityItem.accountId = accountId;
        liquidityItem.leverage = leverage;
        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        fundData.liquidityItems[liquidityItemId] = liquidityItem;

        fundData.totalShares += liquidityItem.shares;
        fundData.liquidityByCollateral[collateralType] += amount;

        if (!fundData.collateralTypes.contains(collateralType)) {
            fundData.collateralTypes.add(collateralType);
        }

        emit PositionAdded(liquidityItemId, fundId, accountId, collateralType, amount, leverage, shares, initialDebt);
    }

    function _removePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        uint accountId,
        address collateralType
    ) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        fundData.liquidityItemIds.remove(liquidityItemId);

        liquidityItem.collateralAmount = 0;
        liquidityItem.shares = 0;
        liquidityItem.initialDebt = 0; // how that works with amount adjustments?

        fundData.liquidityItems[liquidityItemId] = liquidityItem;

        fundData.totalShares -= oldSharesAmount;
        fundData.liquidityByCollateral[collateralType] -= oldAmount;

        emit PositionRemoved(liquidityItemId, fundId, accountId, collateralType);
    }

    function _increasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;

        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint collateralValue = amount * _getCollateralValue(collateralType);

        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _convertToShares(fundId, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(fundId, collateralValue, leverage); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        fundData.liquidityItems[liquidityItemId] = liquidityItem;

        fundData.totalShares += liquidityItem.shares - oldSharesAmount;
        fundData.liquidityByCollateral[collateralType] += amount - oldAmount;

        emit PositionIncreased(liquidityItemId, fundId, collateralType, amount, leverage, shares, initialDebt);
    }

    function _decreasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint collateralValue = amount * _getCollateralValue(collateralType);

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        uint oldOnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _convertToShares(fundId, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(fundId, collateralValue, leverage); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        fundData.liquidityItems[liquidityItemId] = liquidityItem;

        fundData.totalShares -= oldSharesAmount - liquidityItem.shares;
        fundData.liquidityByCollateral[collateralType] -= oldAmount - amount;
        emit PositionDecreased(liquidityItemId, fundId, collateralType, amount, leverage, shares, initialDebt);
    }

    function _convertToShares(
        uint fundId,
        uint collateralValue,
        uint leverage
    ) internal view returns (uint) {
        uint leveragedCollateralValue = collateralValue * leverage; //(use mulDivDown or mulDivUp)
        uint totalShares = _totalShares(fundId);
        uint totalCollateralValue = _totalCollateral(fundId);

        return totalShares == 0 ? leveragedCollateralValue : (leveragedCollateralValue * totalShares) / totalCollateralValue;
    }

    function _perShareValue(uint fundId) internal view returns (uint) {
        uint totalShares = _totalShares(fundId);
        uint totalCollateralValue = _totalCollateral(fundId);

        return totalCollateralValue == 0 ? 1 : totalCollateralValue / totalShares;
    }

    function _totalCollateral(uint fundId) internal view returns (uint) {
        uint total;
        address[] memory collateralTypes = _fundModuleStore().funds[fundId].collateralTypes.values();

        for (uint i = 0; i < collateralTypes.length; i++) {
            address collateralType = collateralTypes[i];

            total +=
                _getCollateralValue(collateralType) *
                _fundModuleStore().funds[fundId].liquidityByCollateral[collateralType];
        }
        return total;
    }

    function _totalShares(uint fundId) internal view returns (uint) {
        return _fundModuleStore().funds[fundId].totalShares;
    }

    function _calculateInitialDebt(
        uint fundId,
        uint collateralValue,
        uint leverage
    ) internal returns (uint) {
        return leverage * collateralValue;
    }

    // ---------------------------------------
    // Mint/Burn sUSD
    // ---------------------------------------

    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "mint") {
        // TODO Check if can mint that amount
        // TODO implement it
    }

    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") {
        // TODO Check if can burn that amount
        // TODO implement it
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue / accountDebt;
    }

    function accountFundCollateralValue(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue;
    }

    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, ) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountDebt;
    }

    function _accountDebtAndCollateral(
        uint fundId,
        uint accountId,
        address collateralType
    ) internal view returns (uint, uint) {
        FundData storage fundData = _fundModuleStore().funds[fundId];

        uint perShareValue = _perShareValue(fundId);
        uint collateralPrice = _getCollateralValue(collateralType);

        uint accountDebt;
        uint accountCollateralValue;
        for (uint i = 1; i < fundData.liquidityItemsByAccount[accountId].length() + 1; i++) {
            bytes32 itemId = fundData.liquidityItemsByAccount[accountId].valueAt(i);
            LiquidityItem storage item = fundData.liquidityItems[itemId];
            if (item.collateralType == collateralType) {
                accountCollateralValue += item.collateralAmount * collateralPrice;

                //TODO review formula
                accountDebt +=
                    item.collateralAmount *
                    collateralPrice +
                    item.initialDebt -
                    perShareValue *
                    item.shares *
                    item.leverage;
            }
        }

        return (accountDebt, accountCollateralValue);
    }

    function fundDebt(uint fundId) public view override returns (uint) {
        return _totalShares(fundId) * _perShareValue(fundId);
    }

    function totalDebtShares(uint fundId) external view override returns (uint) {
        return _totalShares(fundId);
    }

    function debtPerShare(uint fundId) external view override returns (uint) {
        return _perShareValue(fundId);
    }

    // ---------------------------------------
    // Helpers / Internals
    // ---------------------------------------

    function _getLiquidityItemId(
        uint accountId,
        address collateralType,
        uint leverage
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(accountId, collateralType, leverage));
    }
}
