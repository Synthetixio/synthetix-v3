//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "../interfaces/IFundConfiguration.sol";
import "../storage/FundConfigurationStorage.sol";
import "../mixins/FundMixin.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundConfiguration is IFundConfiguration, FundConfigurationStorage, FundEventAndErrors, FundMixin, OwnableMixin {
    function setPreferredFund(uint fundId) external override onlyOwner fundExists(fundId) {
        _fundConfigurationStore().preferredFund = fundId;

        emit PreferredFundSet(fundId);
    }

    function getPreferredFund() external view override returns (uint) {
        return _fundConfigurationStore().preferredFund;
    }

    function addApprovedFund(uint fundId) external override onlyOwner fundExists(fundId) {
        for (uint i = 0; i < _fundConfigurationStore().approvedFunds.length; i++) {
            if (_fundConfigurationStore().approvedFunds[i] == fundId) {
                revert FundAlreadyApproved(fundId);
            }
        }

        _fundConfigurationStore().approvedFunds.push(fundId);

        emit FundApprovedAdded(fundId);
    }

    function removeApprovedFund(uint fundId) external override onlyOwner fundExists(fundId) {
        bool found;
        for (uint i = 0; i < _fundConfigurationStore().approvedFunds.length; i++) {
            if (_fundConfigurationStore().approvedFunds[i] == fundId) {
                _fundConfigurationStore().approvedFunds[i] = _fundConfigurationStore().approvedFunds[
                    _fundConfigurationStore().approvedFunds.length - 1
                ];
                _fundConfigurationStore().approvedFunds.pop();
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
        return _fundConfigurationStore().approvedFunds;
    }
}
