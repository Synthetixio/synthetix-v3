import Wei from '@synthetixio/wei';

type InterestRateParams = {
  lowUtilGradient: Wei;
  gradientBreakpoint: Wei;
  highUtilGradient: Wei;
};

export const calculateInterestRate = (utilRate: Wei, interestRateParams: InterestRateParams) => {
  return (
    utilRate.lt(interestRateParams.gradientBreakpoint)
      ? utilRate.mul(interestRateParams.lowUtilGradient)
      : interestRateParams.lowUtilGradient
          .mul(interestRateParams.gradientBreakpoint)
          .add(
            utilRate
              .sub(interestRateParams.gradientBreakpoint)
              .mul(interestRateParams.highUtilGradient)
          )
  ).mul(100);
};
