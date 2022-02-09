pragma experimental ABIEncoderV2;
pragma solidity ^0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "../utils/SafeToken.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./PublicOfferingConfig.sol";

contract PublicOffering is ReentrancyGuardUpgradeSafe, OwnableUpgradeSafe {
  using SafeMath for uint256;
  using SafeToken for address;

  AggregatorV3Interface internal priceFeed;
  PublicOfferingConfig internal config;

  mapping(address => uint256) public investorBalanceOf;
  bool publicOfferingClosed = false;
  address token;

  struct Investor {
    address investor;
    bytes4 inviterCode;
    uint256 amount;
  }
  Investor[] private investors;

  // Function to receive Ether. msg.data must be empty
  receive() external payable {}

  // Fallback function is called when msg.data is not empty
  fallback() external payable {}

  constructor(
    address _config,
    address _token,
    address _aggregatorV3Interface
  ) public {
    OwnableUpgradeSafe.__Ownable_init();
    ReentrancyGuardUpgradeSafe.__ReentrancyGuard_init();
    priceFeed = AggregatorV3Interface(_aggregatorV3Interface);
    config = PublicOfferingConfig(_config);
    token = _token;
  }

  function deposit(
    uint256 _value,
    uint80 _roundID,
    bytes4 _inviterCode
  ) external payable nonReentrant {
    (uint256 fundingGoal, uint256 minInvestment, uint256 maxInvestment, uint256 raisedAmount) = config.getConfig();
    uint256 amount = _tokenToUSD(_value, _roundID);
    require(!publicOfferingClosed, "PublicOffering::deposit:Public offering closed");
    require(!config.getInvestorStatus(msg.sender), "PublicOffering::deposit:User has invested");
    require(
      amount <= fundingGoal.sub(raisedAmount),
      "PublicOffering::deposit:The investment amount exceeds the total remaining investable amount"
    );
    require(amount <= maxInvestment, "PublicOffering::deposit:The investment amount is greater than the maxInvestment");
    require(amount >= minInvestment, "PublicOffering::deposit:The investment amount is less than minInvestment");
    if (msg.value != 0) {
      require(_value == msg.value, "PublicOffering::deposit:value != msg.value");
      (bool sent, bytes memory data) = address(this).call{ value: msg.value }("");
      require(sent, "PublicOffering::deposit:Failed to send Ether");
    } else {
      require(token != address(0), "PublicOffering::deposit:token == address(0)");
      SafeToken.safeTransferFrom(token, msg.sender, address(this), _value);
    }
    Investor memory x = Investor(msg.sender, _inviterCode, amount);
    investors.push(x);
    config.addInvestor(msg.sender);
    config.addRaisedAmount(amount);
    investorBalanceOf[msg.sender] = amount;
  }

  function getPrice()
    public
    view
    returns (
      int256,
      uint80,
      uint256,
      uint256,
      uint80
    )
  {
    (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) = priceFeed
      .latestRoundData();
    return (price, roundID, startedAt, timeStamp, answeredInRound);
  }

  function getRoundData(uint80 _roundID)
    public
    view
    returns (
      uint256,
      uint80,
      uint256,
      uint256,
      uint80
    )
  {
    (uint80 roundID, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound) = priceFeed
      .getRoundData(_roundID);
    (, , , uint256 latestTimeStamp, ) = priceFeed.latestRoundData();
    require((latestTimeStamp).sub(timeStamp) < 1 hours, "PublicOffering::getRoundData:more than an hour");
    require(price > 0, "PublicOffering::getRoundData:price is negative");
    return (uint256(price), roundID, startedAt, timeStamp, answeredInRound);
  }

  function _tokenToUSD(uint256 _value, uint80 _roundID) internal returns (uint256) {
    (uint256 price, , , , ) = getRoundData(_roundID);
    return price.mul(_value).div(1e8);
  }

  function getInvestors() external view onlyOwner returns (Investor[] memory) {
    return investors;
  }

  function withdraw(uint256 amount) external onlyOwner {
    if (token == address(0)) {
      (bool sent, bytes memory data) = msg.sender.call{ value: amount }("");
      require(sent, "PublicOffering::withdraw:Failed to send Ether");
    } else {
      SafeToken.safeTransfer(token, msg.sender, amount);
    }
  }

  function emergencyWithdraw() external onlyOwner {
    if (token == address(0)) {
      (bool sent, bytes memory data) = msg.sender.call{ value: address(this).balance }("");
      require(sent, "PublicOffering::emergencyWithdraw:Failed to send Ether");
    } else {
      uint256 amount = SafeToken.balanceOf(token, address(this));
      SafeToken.safeTransfer(token, msg.sender, amount);
    }
  }

  function setPublicOfferingState(bool set) external onlyOwner {
    publicOfferingClosed = set;
  }

  function getCode() public view returns (bytes4) {
    bytes4 code = bytes4(keccak256(abi.encodePacked(msg.sender)));
    return code;
  }
}
