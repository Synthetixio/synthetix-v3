//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

import "../satellites/Fund.sol";

contract FundModule is IFundModule, OwnableMixin, FundModuleStorage, InitializableMixin, SatelliteFactory {
    event FundCreated(address fundAddress);

    function _isInitialized() internal view override returns (bool) {
        return _fundModuleStore().initialized;
    }

    function isFundModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeFundModule() external override onlyOwner onlyIfNotInitialized {
        FundModuleStore storage store = _fundModuleStore();

        Fund firstFundImplementation = new Fund();

        UUPSProxy fundProxy = new UUPSProxy(address(firstFundImplementation));

        address fundProxyAddress = address(fundProxy);
        Fund fund = Fund(fundProxyAddress);

        fund.nominateNewOwner(address(this));
        fund.acceptOwnership();
        fund.initialize("Synthetix Fund", "synthethixFund", "");

        store.fund = Satellite({name: "synthethixFund", contractName: "Fund", deployedAddress: fundProxyAddress});

        store.initialized = true;

        emit FundCreated(fundProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _fundModuleStore().fund;
        return satellites;
    }

    function getFundModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeFundImplementation(address newFundTokenImplementation) external override onlyOwner onlyIfInitialized {
        Fund(getFundAddress()).upgradeTo(newFundTokenImplementation);
    }

    function getFundAddress() public view override returns (address) {
        return _fundModuleStore().fund.deployedAddress;
    }
}
