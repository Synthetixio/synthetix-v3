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
            revert AccessError.Unauthorized();
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
        FundToken(getFundTokenAddress()).renounce(msg.sender, fundId);
    }

    //////////////////////////////////////////////
    //          OWNERSHIP                       //
    //////////////////////////////////////////////
    function setFundPosition(
        uint fundId,
        uint[] calldata markets,
        uint[] calldata weights
    ) external override onlyFundOwner {}

    function rebalanceMarkets(uint fundId) external override {}

    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint exposure
    ) external override onlyAccountAuthorized {}

    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyAccountAuthorized {}

    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyAccountAuthorized {}

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

    // function adjust(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) public override {
    //     // TODO require accountId can operate on collateralType

    //     // TODO require input data checking

    //     bytes32 lpid = _calculateLPId(fundId, accountId, collateralType, leverage);
    //     LiquidityProvider storage position = _fundModuleStore().liquidityProviders[lpid];

    //     if (position.collateralAmount == 0) {
    //         _addPosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // new position
    //     } else if (collateralAmount == 0) {
    //         _removePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // remove position
    //     } else if (position.collateralAmount < collateralAmount) {
    //         _increasePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // increase position
    //     } else if (position.collateralAmount > collateralAmount) {
    //         _decreasePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // decrease position
    //     } else {
    //         // no change
    //     }
    // }

    // function _addPosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _removePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _increasePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _decreasePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // TODO Check ERC4626 logic. a lot of the stuff is there

    // function getAccountCurrentDebt(uint accountId) public override returns (uint) {
    //     return 0;
    // }

    // function accountShares(uint accountId) public override returns (uint) {
    //     return 0;
    // }

    // function totalShares() public override returns (uint) {
    //     return 0;
    // }

    // function totalDebt() public override returns (uint) {
    //     return 0;
    // }

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

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    // function _calculateLPId(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint leverage
    // ) internal view returns (bytes32) {
    //     return keccak256(abi.encodePacked(fundId, accountId, collateralType, leverage));
    // }
}
