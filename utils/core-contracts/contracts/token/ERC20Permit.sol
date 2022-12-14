//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "./ERC20PermitStorage.sol";
import "./ERC20Storage.sol";

/*
 * @title ERC20Permit token implementation.
 * See IERC20Permit.
 *
 * Reference implementations:
 * - Rari-Capital - https://github.com/Rari-Capital/solmate/blob/main/src/tokens/ERC20.sol
 */
contract ERC20Permit is ERC20 {
    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal virtual override {
        super._initialize(tokenName, tokenSymbol, tokenDecimals);

        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        store.initialChainId = block.chainid;
        store.initialDomainSeprator = computeDomainSeparator();
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        require(deadline >= block.timestamp, "PERMIT_DEADLINE_EXPIRED");

        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        ERC20Storage.Data storage erc20Store = ERC20Storage.load();

        uint256 nounce = store.nonces[owner];

        unchecked {
            address recoveredAddress = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        DOMAIN_SEPARATOR(),
                        keccak256(
                            abi.encode(
                                keccak256(
                                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                                ),
                                owner,
                                spender,
                                value,
                                nounce,
                                deadline
                            )
                        )
                    )
                ),
                v,
                r,
                s
            );

            store.nonces[owner] = nounce + 1;

            require(recoveredAddress != address(0) && recoveredAddress == owner, "INVALID_SIGNER");

            erc20Store.allowance[recoveredAddress][spender] = value;
        }

        emit Approval(owner, spender, value);
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        return
            block.chainid == store.initialChainId
                ? store.initialDomainSeprator
                : computeDomainSeparator();
    }

    function computeDomainSeparator() internal view virtual returns (bytes32) {
        ERC20Storage.Data storage store = ERC20Storage.load();
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(store.name)),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @dev See {IERC20Permit-nonces}.
     */
    function nonces(address owner) public view virtual returns (uint256) {
        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        return store.nonces[owner];
    }
}
