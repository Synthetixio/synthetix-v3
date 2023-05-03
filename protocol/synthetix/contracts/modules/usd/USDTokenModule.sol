//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IUSDTokenModule.sol";
import "../../interfaces/external/ICcipRouterClient.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

/**
 * @title Module for managing the snxUSD token as an associated system.
 * @dev See IUSDTokenModule.
 */
contract USDTokenModule is ERC20, InitializableMixin, IUSDTokenModule {
    using AssociatedSystem for AssociatedSystem.Data;

    uint256 private constant _TRANSFER_GAS_LIMIT = 100000;

    bytes32 private constant _CCIP_CHAINLINK_SEND = "ccipChainlinkSend";
    bytes32 private constant _CCIP_CHAINLINK_RECV = "ccipChainlinkRecv";
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";

    /**
     * @dev For use as an associated system.
     */
    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }

    /**
     * @dev For use as an associated system.
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @dev For use as an associated system.
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public virtual {
        OwnableStorage.onlyOwner();
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    /**
     * @dev Allows the core system and CCIP to mint tokens.
     */
    function mint(address target, uint256 amount) external override {
        if (
            msg.sender != OwnableStorage.getOwner() &&
            msg.sender != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy
        ) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _mint(target, amount);
    }

    /**
     * @dev Allows the core system and CCIP to burn tokens.
     */
    function burn(address target, uint256 amount) external override {
        if (
            msg.sender != OwnableStorage.getOwner() &&
            msg.sender != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy
        ) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _burn(target, amount);
    }

    /**
     * @inheritdoc IUSDTokenModule
     */
    function burnWithAllowance(address from, address spender, uint256 amount) external {
        OwnableStorage.onlyOwner();

        ERC20Storage.Data storage erc20 = ERC20Storage.load();

        if (amount > erc20.allowance[from][spender]) {
            revert InsufficientAllowance(amount, erc20.allowance[from][spender]);
        }

        erc20.allowance[from][spender] -= amount;

        _burn(from, amount);
    }

    /**
     * @inheritdoc IUSDTokenModule
     */
    function transferCrossChain(
        uint64 destChainId,
        address to,
        uint256 amount
    ) external returns (uint256 feesPaid) {
        AssociatedSystem.load(_CCIP_CHAINLINK_SEND).expectKind(AssociatedSystem.KIND_UNMANAGED);

        CcipClient.EVMTokenAmount[] memory tokenAmounts = new CcipClient.EVMTokenAmount[](1);
        CcipClient.EVMTokenAmount(address(this), amount);

        ICcipRouterClient(AssociatedSystem.load(_CCIP_CHAINLINK_SEND).proxy)
            .ccipSend(
                destChainId,
                CcipClient.EVM2AnyMessage(
                    abi.encode(to), // Address of the receiver on the destination chain for EVM chains use abi.encode(destAddress).
                    "", // Bytes that we wish to send to the receiver
                    tokenAmounts,
                    address(0),
                    CcipClient._argsToBytes(CcipClient.EVMExtraArgsV1(_TRANSFER_GAS_LIMIT, false)) // the gas limit for the call to the receiver for destination chains
                )
            );

        return (0);
    }

    /**
     * @dev Included to satisfy ITokenModule inheritance.
     */
    function setAllowance(address from, address spender, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }
}
