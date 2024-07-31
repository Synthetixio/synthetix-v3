pragma solidity >=0.8.11 <0.9.0;

import "./ConfigurerTimelockStorage.sol";
import "../utils/ERC2771Context.sol";

contract ConfigurerTimelock {
    event TransactionApproved(uint256 indexed index);
    event TransactionStaged(uint256 indexed index, bytes data);

    error ExecutionError(bytes reason);
    error OnlyConfigurer();
    error OnlyRiskProvider();
    error TransactionAlreadyApproved();
    error TransactionValueMismatch();
    error TransactionCannotBeExecuted(ConfigurerTimelockStorage.TxsErrors error);

    constructor(address configurer, address riskProvider, uint256 timelockPeriod) {
        ConfigurerTimelockStorage.ConfigurerTimelockData storage data = ConfigurerTimelockStorage
            .loadConfigurerTimelockData();
        data.configurer = configurer;
        data.riskProvider = riskProvider;
        data.timelockPeriod = timelockPeriod;
    }

    function stageTransaction(bytes memory _data, uint256 value) public returns (uint256 index) {
        ConfigurerTimelockStorage.ConfigurerTimelockData storage data = ConfigurerTimelockStorage
            .loadConfigurerTimelockData();
        if (ERC2771Context._msgSender() != data.configurer) revert OnlyConfigurer();
        data.transactions.push(
            ConfigurerTimelockStorage.Transaction({
                timestamp: uint240(block.timestamp),
                approved: false,
                executed: false,
                value: value,
                data: _data
            })
        );
        index = data.transactions.length - 1;
        emit TransactionStaged(index, _data);
        return index;
    }

    function approveTransaction(uint256 index) public {
        ConfigurerTimelockStorage.Transaction storage transaction = ConfigurerTimelockStorage
            .getTransaction(index);

        if (ERC2771Context._msgSender() != ConfigurerTimelockStorage.getRiskProvider())
            revert OnlyRiskProvider();
        if (transaction.approved) revert TransactionAlreadyApproved();

        emit TransactionApproved(index);
        transaction.approved = true;
    }

    function executeTransaction(uint256 index) public payable {
        ConfigurerTimelockStorage.Transaction storage transaction = ConfigurerTimelockStorage
            .getTransaction(index);
        if (msg.value != transaction.value) revert TransactionValueMismatch();
        (bool status, ConfigurerTimelockStorage.TxsErrors error) = ConfigurerTimelockStorage
            .canTransactionBeExecuted(transaction);
        if (!status) revert TransactionCannotBeExecuted(error);

        transaction.executed = true;
        (bool success, bytes memory reason) = address(this).call(transaction.data);
        if (!success) revert ExecutionError(reason);
    }
}
