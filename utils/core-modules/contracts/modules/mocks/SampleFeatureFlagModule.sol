//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/ISampleFeatureFlagModule.sol";
import "../../storage/SampleStorage.sol";
import "../../storage/FeatureFlag.sol";

contract SampleFeatureFlagModule is ISampleFeatureFlagModule {
    function setFeatureFlaggedValue(uint valueToSet) external {
        FeatureFlag.ensureAccessToFeature("SAMPLE_FEATURE");
        SampleStorage.load().someValue = valueToSet;
    }

    function getFeatureFlaggedValue() external view returns (uint) {
        return SampleStorage.load().someValue;
    }
}
