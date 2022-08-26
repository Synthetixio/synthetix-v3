//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../../submodules/FundEventAndErrors.sol";
import "../../interfaces/IFundModule.sol";
import "../../storage/FundModuleStorage.sol";

import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/FundMixin.sol";

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
        uint[] calldata weights,
        int[] calldata maxDebtShareValues
    ) external override fundExists(fundId) onlyFundOwner(fundId, msg.sender) {
        if (markets.length != weights.length || markets.length != maxDebtShareValues.length) {
            revert InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match");
        }

        // TODO: this is not super efficient. we only call this to gather the debt accumulated from deployed funds
        // would be better if we could eliminate the call at the end somehow
        _rebalanceFundPositions(fundId);

        FundData storage fundData = _fundModuleStore().funds[fundId];

        uint totalWeight = 0;
        uint i = 0;

        for (; i < (markets.length < fundData.fundDistribution.length ? markets.length : fundData.fundDistribution.length); i++) {
            MarketDistribution storage distribution = fundData.fundDistribution[i];
            distribution.market = markets[i];
            distribution.weight = uint128(weights[i]);
            distribution.maxDebtShareValue = int128(maxDebtShareValues[i]);

            totalWeight += weights[i];
        }

        for (; i < markets.length; i++) {
            MarketDistribution memory distribution;
            distribution.market = markets[i];
            distribution.weight = uint128(weights[i]);
            distribution.maxDebtShareValue = int128(maxDebtShareValues[i]);

            fundData.fundDistribution.push(distribution);

            totalWeight += weights[i];
        }

        uint popped = fundData.fundDistribution.length - i;
        for (i = 0; i < popped; i++) {
            _rebalanceMarket(fundData.fundDistribution[fundData.fundDistribution.length - 1].market, fundId, 0, 0);
            fundData.fundDistribution.pop();
        }



        fundData.totalWeights = totalWeight;

        _rebalanceFundPositions(fundId);

        emit FundPositionSet(fundId, markets, weights, msg.sender);
    }

    function getFundPosition(uint fundId)
        external
        view
        override
        returns (
            uint[] memory,
            uint[] memory,
            int[] memory
        )
    {
        FundData storage fund = _fundModuleStore().funds[fundId];

        uint[] memory markets = new uint[](fund.fundDistribution.length);
        uint[] memory weights = new uint[](fund.fundDistribution.length);
        int[] memory maxDebtShareValues = new int[](fund.fundDistribution.length);

        for (uint i = 0; i < fund.fundDistribution.length; i++) {
            markets[i] = fund.fundDistribution[i].market;
            weights[i] = fund.fundDistribution[i].weight;
            maxDebtShareValues[i] = fund.fundDistribution[i].maxDebtShareValue;
        }

        return (markets, weights, maxDebtShareValues);
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
