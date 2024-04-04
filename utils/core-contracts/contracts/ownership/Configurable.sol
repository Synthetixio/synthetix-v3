//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./ConfigurableStorage.sol";
import "./OwnableStorage.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";
import "../interfaces/IConfigurable.sol";
import "../utils/ERC2771Context.sol";

/**
 * @title Contract for facilitating ownership by an owner and a configurer.
 * @dev Not intended for use without Ownable.sol.
 * See IConfigurable for natspec.
 */
contract Configurable is IConfigurable {
    /**
     * @inheritdoc IConfigurable
     */
    function acceptConfigurerRole() public override {
        ConfigurableStorage.ConfigurerData storage store = ConfigurableStorage.loadConfigurer();

        address currentNominatedConfigurer = store.nominatedConfigurer;
        if (ERC2771Context._msgSender() != currentNominatedConfigurer) {
            revert NotNominatedAsConfigurer(ERC2771Context._msgSender());
        }

        emit ConfigurerChanged(store.configurer, currentNominatedConfigurer);
        store.configurer = currentNominatedConfigurer;

        store.nominatedConfigurer = address(0);
        emit ConfigurerNominated(address(0));
    }

    /**
     * @inheritdoc IConfigurable
     */
    function nominateNewConfigurer(address newNominatedConfigurer) public override {
        ConfigurableStorage.onlyOwnerOrConfigurer();
        ConfigurableStorage.ConfigurerData storage store = ConfigurableStorage.loadConfigurer();

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
     * @inheritdoc IConfigurable
     */
    function renounceConfigurerNomination() external override {
        ConfigurableStorage.ConfigurerData storage store = ConfigurableStorage.loadConfigurer();

        if (store.nominatedConfigurer != ERC2771Context._msgSender()) {
            revert NotNominatedAsConfigurer(ERC2771Context._msgSender());
        }

        store.nominatedConfigurer = address(0);
        emit ConfigurerNominated(address(0));
    }

    /**
     * @inheritdoc IConfigurable
     */
    function setConfigurer(address newConfigurer) external override {
        OwnableStorage.onlyOwner(); // reverts if not the owner
        ConfigurableStorage.ConfigurerData storage store = ConfigurableStorage.loadConfigurer();

        if (newConfigurer == store.configurer) {
            revert ChangeError.NoChange();
        }

        if (store.nominatedConfigurer != address(0)) {
            store.nominatedConfigurer = address(0); // reset nominated configurer to address(0)
            emit ConfigurerNominated(address(0));
        }

        emit ConfigurerChanged(store.configurer, newConfigurer);
        store.configurer = newConfigurer;
    }

    /**
     * @inheritdoc IConfigurable
     */
    function configurer() external view override returns (address) {
        return ConfigurableStorage.loadConfigurer().configurer;
    }

    /**
     * @inheritdoc IConfigurable
     */
    function nominatedConfigurer() external view override returns (address) {
        return ConfigurableStorage.loadConfigurer().nominatedConfigurer;
    }
}
