//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IMulticallModule.sol";

import "../../storage/Config.sol";

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

/**
 * @title Module that enables calling multiple methods of the system in a single transaction.
 * @dev See IMulticallModule.
 * @dev Implementation adapted from https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/Multicall.sol
 */
contract MulticallModule is IMulticallModule {
    bytes32 internal constant _CONFIG_MESSAGE_SENDER = "_messageSender";
    bytes32 internal constant _CONFIG_ALLOWLISTED_MULTICALL_TARGETS =
        "_allowlistedMulticallTargets";

    // solhint-disable-next-line numcast/safe-cast
    bytes32 internal constant ALLOWED = bytes32(uint256(1));
    // solhint-disable-next-line numcast/safe-cast
    bytes32 internal constant DISALLOWED = bytes32(uint256(0));

    /**
     * @inheritdoc IMulticallModule
     */
    function multicall(bytes[] calldata data) public override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);

            if (!success) {
                uint len = result.length;
                assembly {
                    revert(add(result, 0x20), len)
                }
            }

            results[i] = result;
        }
    }

    /**
     * @inheritdoc IMulticallModule
     */
    function multicallThrough(
        address[] calldata to,
        bytes[] calldata data,
        uint256[] calldata values
    ) public payable override returns (bytes[] memory results) {
        if (to.length != data.length || to.length != values.length) {
            revert ParameterError.InvalidParameter("", "all arrays must be same length");
        }
        if (Config.read(_CONFIG_MESSAGE_SENDER, 0) != 0) {
            revert RecursiveMulticall(msg.sender);
        }

        // solhint-disable-next-line numcast/safe-cast
        Config.put(_CONFIG_MESSAGE_SENDER, bytes32(uint256(uint160(msg.sender))));

        results = new bytes[](data.length);
        uint256 valueUsed;
        for (uint256 i = 0; i < data.length; i++) {
            bool success;
            bytes memory result;
            if (to[i] == address(this)) {
                (success, result) = address(this).delegatecall(data[i]);
            } else if (
                Config.read(
                    keccak256(abi.encodePacked(_CONFIG_ALLOWLISTED_MULTICALL_TARGETS, to[i])),
                    0
                ) != 0
            ) {
                valueUsed += values[i];
                (success, result) = address(to[i]).call{value: values[i]}(data[i]);
            } else {
                revert DeniedMulticallTarget(to[i]);
            }

            if (!success) {
                uint len = result.length;
                assembly {
                    revert(add(result, 0x20), len)
                }
            }

            results[i] = result;
        }

        if (valueUsed > msg.value) {
            revert ParameterError.InvalidParameter("msg.value", "must exceed value total");
        }

        Config.put(_CONFIG_MESSAGE_SENDER, 0);
    }

    /**
     * @inheritdoc IMulticallModule
     */
    function setAllowlistedMulticallTarget(address target, bool allowlisted) external override {
        OwnableStorage.onlyOwner();
        Config.put(
            keccak256(abi.encodePacked(_CONFIG_ALLOWLISTED_MULTICALL_TARGETS, target)),
            allowlisted ? ALLOWED : DISALLOWED
        );
    }

    /**
     * @inheritdoc IMulticallModule
     */
    function getMessageSender() external view override returns (address) {
        return Config.readAddress(_CONFIG_MESSAGE_SENDER, address(0));
    }
}
