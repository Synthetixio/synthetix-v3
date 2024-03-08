// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @custom:proxied
 * @custom:predeploy 0x420000000000000000000000000000000000000F
 * @title GasPriceOracle
 * @notice This contract maintains the variables responsible for computing the L1 portion of the
 *         total fee charged on L2. Before Bedrock, this contract held variables in state that were
 *         read during the state transition function to compute the L1 portion of the transaction
 *         fee. After Bedrock, this contract now simply proxies the L1Block contract, which has
 *         the values used to compute the L1 portion of the fee in its state.
 *
 *         The contract exposes an API that is useful for knowing how large the L1 portion of the
 *         transaction fee will be. The following events were deprecated with Bedrock:
 *         - event OverheadUpdated(uint256 overhead);
 *         - event ScalarUpdated(uint256 scalar);
 *         - event DecimalsUpdated(uint256 decimals);
 *
 * see https://community.optimism.io/docs/useful-tools/oracles/#types-of-oracles
 */
interface IOVM_GasPriceOracle {
    /**
     * @notice Number of decimals used in the scalar.
     */
    // uint256 public constant DECIMALS = 6;
    function DECIMALS() external pure returns (uint256);

    /**
     * @notice Computes the L1 portion of the fee based on the size of the rlp encoded input
     *         transaction, the current L1 base fee, and the various dynamic parameters.
     *
     * @param _data Unsigned fully RLP-encoded transaction to get the L1 fee for.
     *
     * @return L1 fee that should be paid for the tx
     */
    function getL1Fee(bytes memory _data) external view returns (uint256);

    /**
     * @notice Retrieves the current gas price (base fee).
     *
     * @return Current L2 gas price (base fee).
     */
    function gasPrice() external view returns (uint256);

    /**
     * @notice Retrieves the current base fee.
     *
     * @return Current L2 base fee.
     */
    function baseFee() external view returns (uint256);

    /**
     * @notice Retrieves the current fee overhead.
     * @notice deprecated
     *
     * @return Current fee overhead.
     */
    function overhead() external view returns (uint256);

    /**
     * @notice Retrieves the current fee scalar.
     * @notice deprecated
     *
     * @return Current fee scalar.
     */
    function scalar() external view returns (uint256);

    /**
     * @notice Retrieves the latest known L1 base fee.
     *
     * @return Latest known L1 base fee.
     */
    function l1BaseFee() external view returns (uint256);

    /**
     * @custom:legacy
     * @notice Retrieves the number of decimals used in the scalar.
     *
     * @return Number of decimals used in the scalar.
     */
    function decimals() external pure returns (uint256);

    /**
     * @notice Computes the amount of L1 gas used for a transaction. Adds the overhead which
     *         represents the per-transaction gas overhead of posting the transaction and state
     *         roots to L1. Adds 68 bytes of padding to account for the fact that the input does
     *         not have a signature.
     *
     * @param _data Unsigned fully RLP-encoded transaction to get the L1 gas for.
     *
     * @return Amount of L1 gas used to publish the transaction.
     */
    function getL1GasUsed(bytes memory _data) external view returns (uint256);

    /// @notice Set chain to be Ecotone chain (callable by depositor account)
    function setEcotone() external;

    /// @notice Indicates whether the network has gone through the Ecotone upgrade.
    function isEcotone() external view returns (bool);

    /// @notice Semantic version.
    function version() external view returns (string memory);

    /// @notice Retrieves the current blob base fee.
    /// @return Current blob base fee.
    function blobBaseFee() external view returns (uint256);

    /// @notice Retrieves the current base fee scalar.
    /// @return Current base fee scalar.
    function baseFeeScalar() external view returns (uint32);

    /// @notice Retrieves the current blob base fee scalar.
    /// @return Current blob base fee scalar.
    function blobBaseFeeScalar() external view returns (uint32);
}
