//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IMulticallModule.sol";

import "../../storage/Config.sol";

/**
 * @title Module that enables calling multiple methods of the system in a single transaction.
 * @dev See IMulticallModule.
 * @dev Implementation adapted from https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/Multicall.sol
 */
contract MulticallModule is IMulticallModule {
    bytes32 internal constant _CONFIG_MESSAGE_SENDER = "_messageSender";

    error RecursiveMulticall(address);

    /**
     * @inheritdoc IMulticallModule
     */
    function multicall(
        bytes[] calldata data
    ) public payable override returns (bytes[] memory results) {
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

    // uncomment this when governance approves `multicallThrough` functionality (didnt want to put this in a separate PR for now)
    /*function multicallThrough(
        address[] calldata to,
        bytes[] calldata data
    ) public payable override returns (bytes[] memory results) {
        if (Config.read(_CONFIG_MESSAGE_SENDER, 0) != 0) {
            revert RecursiveMulticall(msg.sender);
        }

        Config.put(_CONFIG_MESSAGE_SENDER, bytes32(uint256(uint160(msg.sender))));

        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            bool success;
            bytes memory result;
            if (to[i] == address(this)) {
                (success, result) = address(this).delegatecall(data[i]);
            } else {
                (success, result) = address(to[i]).call(data[i]);
            }

            if (!success) {
                uint len = result.length;
                assembly {
                    revert(add(result, 0x20), len)
                }
            }

            results[i] = result;
        }

        Config.put(_CONFIG_MESSAGE_SENDER, 0);
    }

    function getMessageSender() external view override returns (address) {
        return Config.readAddress(_CONFIG_MESSAGE_SENDER, address(0));
    }*/
}
