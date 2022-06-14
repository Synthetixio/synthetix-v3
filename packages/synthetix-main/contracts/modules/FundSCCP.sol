//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "../interfaces/IFundSCCP.sol";
import "../storage/FundSCCPStorage.sol";
import "../mixins/FundMixin.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundSCCP is IFundSCCP, FundSCCPStorage, FundEventAndErrors, FundMixin, OwnableMixin {
    function setPreferredFund(uint fundId) external override onlyOwner fundExists(fundId) {
        _fundSCCPStore().preferredFund = fundId;

        emit PreferredFundSet(fundId);
    }

    function getPreferredFund() external view override returns (uint) {
        return _fundSCCPStore().preferredFund;
    }

    function addApprovedFund(uint fundId) external override onlyOwner fundExists(fundId) {
        for (uint i = 0; i < _fundSCCPStore().approvedFunds.length; i++) {
            if (_fundSCCPStore().approvedFunds[i] == fundId) {
                revert FundAlreadyApproved(fundId);
            }
        }

        _fundSCCPStore().approvedFunds.push(fundId);

        emit FundApprovedAdded(fundId);
    }

    function removeApprovedFund(uint fundId) external override onlyOwner fundExists(fundId) {
        bool found;
        for (uint i = 0; i < _fundSCCPStore().approvedFunds.length; i++) {
            if (_fundSCCPStore().approvedFunds[i] == fundId) {
                _fundSCCPStore().approvedFunds[i] = _fundSCCPStore().approvedFunds[
                    _fundSCCPStore().approvedFunds.length - 1
                ];
                _fundSCCPStore().approvedFunds.pop();
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
        return _fundSCCPStore().approvedFunds;
    }
}
