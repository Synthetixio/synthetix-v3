pragma solidity >=0.8.11 <0.9.0;

interface IERC7412 {
    error FeeRequired(uint256 amount);
    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    function oracleId() external view returns (bytes32 oracleId);

    function fulfillOracleQuery(bytes calldata signedOffchainData) external payable;
}
