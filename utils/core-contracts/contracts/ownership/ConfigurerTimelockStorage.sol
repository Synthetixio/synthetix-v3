//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library ConfigurerTimelockStorage {
    bytes32 private constant _SLOT_CONFIGURER_TIMELOCK_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.ConfigurerTimelock"));

    struct ConfigurerTimelockData {
        address configurer;
        address riskProvider;
        uint256 timelockPeriod;
        Transaction[] transactions;
    }

    struct Transaction {
        uint240 timestamp;
        bool approved;
        bool executed;
        bytes data;
    }

    function loadConfigurerTimelockData()
        internal
        pure
        returns (ConfigurerTimelockData storage store)
    {
        bytes32 s = _SLOT_CONFIGURER_TIMELOCK_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function getRiskProvider() internal view returns (address) {
        return ConfigurerTimelockStorage.loadConfigurerTimelockData().configurer;
    }

    function getTransaction(uint256 index) internal view returns (Transaction storage) {
        return ConfigurerTimelockStorage.loadConfigurerTimelockData().transactions[index];
    }

    function getTransactionData(uint256 index) internal view returns (bytes memory) {
        return ConfigurerTimelockStorage.loadConfigurerTimelockData().transactions[index].data;
    }

    function getTimelockPeriod() internal view returns (uint256) {
        return ConfigurerTimelockStorage.loadConfigurerTimelockData().timelockPeriod;
    }

    function canTransactionBeExecuted(uint256 index) internal view returns (bool) {
        ConfigurerTimelockData storage configurerTimelock = ConfigurerTimelockStorage
            .loadConfigurerTimelockData();
        return
            configurerTimelock.transactions[index].approved &&
            !configurerTimelock.transactions[index].executed &&
            configurerTimelock.transactions[index].timestamp + configurerTimelock.timelockPeriod <=
            block.timestamp;
    }
}
