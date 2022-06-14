//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/FundModuleStorage.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundMixin is FundModuleStorage, FundEventAndErrors {
    function _ownerOf(uint256 fundId) internal view returns (address) {
        return _fundModuleStore().funds[fundId].owner;
    }

    function _exists(uint256 fundId) internal view returns (bool) {
        return _ownerOf(fundId) != address(0);
    }

    modifier fundExists(uint256 fundId) {
        if (!_exists(fundId)) {
            revert FundNotFound(fundId);
        }

        _;
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
        uint totalWeight // solhint-disable-next-line no-empty-blocks
    ) internal {
        // TODO implement it when markets are created
    }
}
