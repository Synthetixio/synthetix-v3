//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "../interfaces/IAccount.sol";

import "./account/AccountBase.sol";

contract Account is IAccount, AccountBase, UUPSImplementation, Ownable {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function stake(uint accountId, StakedCollateral calldata collateral) public {
        AccountData storage accountData = _accountStore().accountsData[accountId];

        bytes32 collateralId = _calculateId(collateral);
        if (accountData.stakedCollaterals[collateralId]) {
            revert StakedCollateralAlreadyExists(collateral);
        }

        // TODO check the rest of the info of the callateral to stake

        // TODO check if msg.sender is enabled to execute that operation for the accountID

        // TODO do the business logic on the funds

        // adds a collateralInfo to the collaterals array
        accountData.stakedCollateralIds[collateral.collateralId].push(collateralId);
        accountData.stakedCollaterals[collateralId] = collateral;
    }

    function totalCollateral(uint accountId, uint collateralType) public view returns (uint) {
        // loop through accountsData[accountId].stakedCollateralIds[collateralType] to get the ids and get the data from
        // accountsData[accountId].stakedCollaterals[collateralId]
        return 0;
    }

    function assignedCollateral(uint accountId, uint collateralType) public view returns (uint) {
        // loop through accountsData[accountId].stakedCollateralIds[collateralType] to get the ids and get the data from
        // accountsData[accountId].stakedCollaterals[collateralId]
        return 0;
    }

    function _getAssignedFunds(uint accountId, uint collateralType) internal view returns (uint) {
        return 0;
    }

    function _calculateId(StakedCollateral calldata collateral) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(collateral));
    }
}
