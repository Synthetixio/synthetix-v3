//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/FeatureFlagMixin.sol";
import "../../interfaces/ISampleFeatureFlagModule.sol";
import "../../storage/SampleStorage.sol";

contract SampleFeatureFlagModule is ISampleFeatureFlagModule, SampleStorage, FeatureFlagMixin {
    function setFeatureFlaggedValue(uint valueToSet) external onlyIfFeatureFlag("SAMPLE_FEATURE") {
        _sampleStore().someValue = valueToSet;
    }

    function getFeatureFlaggedValue() external view returns (uint) {
        return _sampleStore().someValue;
    }
}
