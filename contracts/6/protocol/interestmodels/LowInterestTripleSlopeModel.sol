pragma solidity 0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../../interfaces/InterestModel.sol";

contract LowInterestTripleSlopeModel is InterestModel {
  using SafeMath for uint256;

  uint256 public constant CEIL_SLOPE_1 = 40e18;
  uint256 public constant CEIL_SLOPE_2 = 95e18;
  uint256 public constant CEIL_SLOPE_3 = 100e18;

  uint256 public constant MAX_INTEREST_SLOPE_1 = 3e16;
  uint256 public constant MAX_INTEREST_SLOPE_2 = 6e16;
  uint256 public constant MAX_INTEREST_SLOPE_3 = 100e16;

  /// @dev Return the interest rate per second, using 1e18 as denom.
  function getInterestRate(uint256 debt, uint256 floating) external pure override returns (uint256) {
    if (debt == 0 && floating == 0) return 0;

    uint256 total = debt.add(floating);
    uint256 utilization = debt.mul(100e18).div(total);
    if (utilization < CEIL_SLOPE_1) {
      // Less than 40% utilization - 0%-3% APY
      return utilization.mul(MAX_INTEREST_SLOPE_1).div(CEIL_SLOPE_1) / 365 days;
    } else if (utilization < CEIL_SLOPE_2) {
      // Between 40% and 95% - 6% APY
      return uint256(MAX_INTEREST_SLOPE_2) / 365 days;
    } else if (utilization < CEIL_SLOPE_3) {
      // Between 95% and 100% - 6%-100% APY
      return (MAX_INTEREST_SLOPE_2 + utilization.sub(CEIL_SLOPE_2).mul(MAX_INTEREST_SLOPE_3.sub(MAX_INTEREST_SLOPE_2)).div(CEIL_SLOPE_3.sub(CEIL_SLOPE_2))) / 365 days;
    } else {
      // Not possible, but just in case - 100% APY
      return MAX_INTEREST_SLOPE_3 / 365 days;
    }
  }
}