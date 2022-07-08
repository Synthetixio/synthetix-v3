//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../submodules/FundEventAndErrors.sol";
import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/FundMixin.sol";

contract FundModule is IFundModule, FundEventAndErrors, AccountRBACMixin, FundMixin, OwnableMixin {
    // ---------------------------------------
    // Minting
    // ---------------------------------------
    modifier onlyFundOwner(uint fundId, address requestor) {
        if (_ownerOf(fundId) != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    function createFund(uint requestedFundId, address owner) external override {
        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (_exists(requestedFundId)) {
            revert FundAlreadyExists(requestedFundId);
        }

        _fundModuleStore().funds[requestedFundId].owner = owner;

        emit FundCreated(owner, requestedFundId);
    }

    // ---------------------------------------
    // Ownership
    // ---------------------------------------
    function nominateNewFundOwner(address nominatedOwner, uint256 fundId)
        external
        override
        onlyFundOwner(fundId, msg.sender)
    {
        _fundModuleStore().funds[fundId].nominatedOwner = nominatedOwner;

        emit NominatedNewOwner(nominatedOwner, fundId);
    }

    function acceptFundOwnership(uint256 fundId) external override {
        if (_fundModuleStore().funds[fundId].nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _fundModuleStore().funds[fundId].owner = msg.sender;
        _fundModuleStore().funds[fundId].nominatedOwner = address(0);

        emit OwnershipAccepted(msg.sender, fundId);
    }

    function renounceFundNomination(uint256 fundId) external override {
        if (_fundModuleStore().funds[fundId].nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _fundModuleStore().funds[fundId].nominatedOwner = address(0);

        emit OwnershipRenounced(msg.sender, fundId);
    }

    function ownerOf(uint256 fundId) external view override returns (address) {
        return _ownerOf(fundId);
    }

    function nominatedOwnerOf(uint256 fundId) external view override returns (address) {
        return _fundModuleStore().funds[fundId].nominatedOwner;
    }

    // ---------------------------------------
    // fund admin
    // ---------------------------------------
    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external override fundExists(fundId) onlyFundOwner(fundId, msg.sender) {
        if (markets.length != weights.length) {
            revert InvalidParameters();
        }

        FundData storage fund = _fundModuleStore().funds[fundId];

        // _rebalanceMarkets with second parameter in true will clean up the distribution
        // TODO improve how the fund positions are changed and only update what is different
        _rebalanceMarkets(fundId, true);

        // Cleanup previous distribution
        delete fund.fundDistribution;
        fund.totalWeights = 0;

        for (uint i = 0; i < markets.length; i++) {
            // TODO check if market exists when markets are created
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

    function setFundName(uint fundId, string memory name)
        external
        override
        fundExists(fundId)
        onlyFundOwner(fundId, msg.sender)
    {
        _fundModuleStore().funds[fundId].name = name;
    }

    function getFundName(uint fundId) external view override returns (string memory fundName) {
        return _fundModuleStore().funds[fundId].name;
    }
}
