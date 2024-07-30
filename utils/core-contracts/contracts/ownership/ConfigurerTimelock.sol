pragma solidity >=0.8.11 <0.9.0;

import "./ConfigurerTimelockStorage.sol";
import "../utils/ERC2771Context.sol";

contract ConfigurerTimelock {
    event TransactionApproved(uint256 indexed index);
    event TransactionStaged(uint256 indexed index, bytes data);

    error OnlyConfigurer();
    error OnlyRiskProvider();
    error TransactionAlreadyApproved();

    constructor(address configurer, address riskProvider, uint256 timelockPeriod) {
        ConfigurerTimelockStorage.ConfigurerTimelockData storage data = ConfigurerTimelockStorage
            .loadConfigurerTimelockData();
        data.configurer = configurer;
        data.riskProvider = riskProvider;
        data.timelockPeriod = timelockPeriod;
    }

    function stageTransaction(bytes memory _data) public returns (uint256 index) {
        ConfigurerTimelockStorage.ConfigurerTimelockData storage data = ConfigurerTimelockStorage
            .loadConfigurerTimelockData();
        if (ERC2771Context._msgSender() != data.configurer) revert OnlyConfigurer();
        data.transactions.push(
            ConfigurerTimelockStorage.Transaction({
                timestamp: uint240(block.timestamp),
                approved: false,
                executed: false,
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
}
