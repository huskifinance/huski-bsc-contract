pragma solidity ^0.6.6;
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract PublicOfferingConfig is OwnableUpgradeSafe {
  using SafeMath for uint256;
  uint256 public fundingGoal = 5000000e18;
  uint256 public minInvestment = 1000e18;
  uint256 public maxInvestment = 50000e18;
  uint256 public raisedAmount = 0;

  mapping(address => bool) invested;
  mapping(address => bool) public allows;

  constructor() public {
    OwnableUpgradeSafe.__Ownable_init();
  }

  modifier allow() {
    require(allows[msg.sender], "PublicOfferingConfig::allow:Permission denied");
    _;
  }

  function getConfig()
    external
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    return (fundingGoal, minInvestment, maxInvestment, raisedAmount);
  }

  function addRaisedAmount(uint256 amount) external allow returns (uint256) {
    require(
      raisedAmount.add(amount) < fundingGoal,
      "PublicOfferingConfig::addRaisedAmount:The investment amount exceeds the total remaining investable amount"
    );
    raisedAmount = raisedAmount.add(amount);
    return raisedAmount;
  }

  function addInvestor(address investor) external allow {
    invested[investor] = true;
  }

  function getInvestorStatus(address investor) external view returns (bool) {
    return invested[investor];
  }

  function setPublicOffering(address publicOffering, bool set) external onlyOwner {
    allows[publicOffering] = set;
  }

  function setMinInvestment(uint256 amount) external onlyOwner returns (uint256) {
    minInvestment = amount;
    return minInvestment;
  }

  function setMaxInvestment(uint256 amount) external onlyOwner returns (uint256) {
    maxInvestment = amount;
    return maxInvestment;
  }
}
