//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/AuthorizableStorage.sol";
import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "../../interfaces/IUSDTokenModule.sol";
import "../../interfaces/external/IEVM2AnySubscriptionOnRampRouterInterface.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

contract USDTokenModule is ERC20, InitializableMixin, IUSDTokenModule {

    uint private constant _TRANSFER_GAS_LIMIT = 100000;

    bytes32 private constant _CCIP_CHAINLINK_SEND = "ccipChainlinkSend";
    bytes32 private constant _CCIP_CHAINLINK_RECV = "ccipChainlinkRecv";
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";

    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public virtual {
        OwnableStorage.onlyOwner();
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }

    function mint(
        address target,
        uint amount
    ) external override {
        if (msg.sender != OwnableStorage.getOwner() && msg.sender != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _mint(target, amount);
    }

    function burn(
        address target,
        uint amount
    ) external override {
        if (msg.sender != OwnableStorage.getOwner() && msg.sender != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _burn(target, amount);
    }

    function burnWithAllowance(
        address from,
        address spender,
        uint amount
    ) external {
        OwnableStorage.onlyOwner();

        ERC20Storage.Data storage store = ERC20Storage.load();

        if (amount < store.allowance[from][spender]) {
            revert InsufficientAllowance(amount, store.allowance[from][spender]);
        }
        store.allowance[from][spender] -= amount;
        _burn(from, amount);
    }

    function transferCrossChain(uint destChainId, address, uint amount) external returns (bool executed, uint feesPaid) {
        // TODO: collect fees
        // TODO: emit appropriate event

        IERC20[] memory tokens = new IERC20[](1);
        tokens[0] = IERC20(address(this));

        uint[] memory amounts = new uint[](1);
        amounts[0] = amount;

        IEVM2AnySubscriptionOnRampRouterInterface(AssociatedSystem.load(_CCIP_CHAINLINK_SEND).proxy).ccipSend(
            destChainId,
            IEVM2AnySubscriptionOnRampRouterInterface.EVM2AnySubscriptionMessage(
                abi.encode(address(0)), // Address of the receiver on the destination chain for EVM chains use abi.encode(destAddress).
                "", // Bytes that we wish to send to the receiver
                tokens, // The ERC20 tokens we wish to send for EVM source chains
                amounts, // The amount of ERC20 tokens we wish to send for EVM source chains
                _TRANSFER_GAS_LIMIT // the gas limit for the call to the receiver for destination chains
            )
        );

        return (true, 0);
    }
}
