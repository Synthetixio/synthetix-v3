//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./OwnableOrConfigurerStorage.sol";
import "../interfaces/IOwnableOrConfigurer.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";

/**
 * @title Contract for facilitating ownership by an owner and a configurer.
 * See IOwnableOrConfigurer.
 */
contract OwnableOrConfigurer is IOwnableOrConfigurer {
    constructor(address initialOwner, address initialConfigurer) {
        OwnableOrConfigurerStorage.loadOwner().owner = initialOwner;
        OwnableOrConfigurerStorage.loadConfigurer().configurer = initialConfigurer;
    }

    /**
     * @inheritdoc IOwnable
     */
    function acceptOwnership() public override {
        OwnableOrConfigurerStorage.OwnerData storage store = OwnableOrConfigurerStorage.loadOwner();

        address currentNominatedOwner = store.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit OwnerChanged(store.owner, currentNominatedOwner);
        store.owner = currentNominatedOwner;

        store.nominatedOwner = address(0);
    }

    /**
     * @inheritdoc IOwnableOrConfigurer
     */
    function acceptConfigurerRole() public override {
        OwnableOrConfigurerStorage.ConfigurerData storage store = OwnableOrConfigurerStorage
            .loadConfigurer();

        address currentNominatedConfigurer = store.nominatedConfigurer;
        if (msg.sender != currentNominatedConfigurer) {
            revert NotNominated(msg.sender);
        }

        emit ConfigurerChanged(store.configurer, currentNominatedConfigurer);
        store.configurer = currentNominatedConfigurer;

        store.nominatedConfigurer = address(0);
    }

    /**
     * @inheritdoc IOwnable
     */
    function nominateNewOwner(address newNominatedOwner) public override onlyOwner {
        OwnableOrConfigurerStorage.OwnerData storage store = OwnableOrConfigurerStorage.loadOwner();

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newNominatedOwner == store.nominatedOwner) {
            revert ChangeError.NoChange();
        }

        store.nominatedOwner = newNominatedOwner;
        emit OwnerNominated(newNominatedOwner);
    }

    /**
     * @inheritdoc IOwnableOrConfigurer
     */
    function nominateNewConfigurer(address newNominatedConfigurer) public override onlyOwner {
        OwnableOrConfigurerStorage.ConfigurerData storage store = OwnableOrConfigurerStorage
            .loadConfigurer();

        if (newNominatedConfigurer == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newNominatedConfigurer == store.nominatedConfigurer) {
            revert ChangeError.NoChange();
        }

        store.nominatedConfigurer = newNominatedConfigurer;
        emit ConfigurerNominated(newNominatedConfigurer);
    }

    /**
     * @inheritdoc IOwnable
     */
    function renounceNomination() external override {
        OwnableOrConfigurerStorage.OwnerData storage store = OwnableOrConfigurerStorage.loadOwner();

        if (store.nominatedOwner != msg.sender) {
            revert NotNominated(msg.sender);
        }

        store.nominatedOwner = address(0);
    }

    /**
     * @inheritdoc IOwnableOrConfigurer
     */
    function renounceConfigurerNomination() external override {
        OwnableOrConfigurerStorage.ConfigurerData storage store = OwnableOrConfigurerStorage
            .loadConfigurer();

        if (store.nominatedConfigurer != msg.sender) {
            revert NotNominated(msg.sender);
        }

        store.nominatedConfigurer = address(0);
    }

    function setConfigurer(address newConfigurer) external override onlyOwner {
        OwnableOrConfigurerStorage.ConfigurerData storage store = OwnableOrConfigurerStorage
            .loadConfigurer();

        if (newConfigurer == store.configurer) {
            revert ChangeError.NoChange();
        }

        store.configurer = newConfigurer;
        emit ConfigurerChanged(store.configurer, newConfigurer);
    }

    /**
     * @inheritdoc IOwnable
     */
    function owner() external view override returns (address) {
        return OwnableOrConfigurerStorage.loadOwner().owner;
    }

    /**
     * @inheritdoc IOwnableOrConfigurer
     */
    function configurer() external view override returns (address) {
        return OwnableOrConfigurerStorage.loadConfigurer().configurer;
    }

    /**
     * @inheritdoc IOwnable
     */
    function nominatedOwner() external view override returns (address) {
        return OwnableOrConfigurerStorage.loadOwner().nominatedOwner;
    }

    /**
     * @inheritdoc IOwnableOrConfigurer
     */
    function nominatedConfigurer() external view override returns (address) {
        return OwnableOrConfigurerStorage.loadConfigurer().nominatedConfigurer;
    }

    /**
     * @dev Reverts if the caller is not the owner.
     */
    modifier onlyOwner() {
        OwnableOrConfigurerStorage.onlyOwner();
        _;
    }

    /**
     * @dev Reverts if the caller is not the owner or the configurer.
     */
    modifier onlyOwnerOrConfigurer() {
        OwnableOrConfigurerStorage.onlyOwnerOrConfigurer();
        _;
    }
}
