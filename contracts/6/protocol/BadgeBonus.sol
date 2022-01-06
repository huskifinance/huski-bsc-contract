pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IVaultConfig.sol";
import "../token/badge/BadgeNFT.sol";
import "../utils/SafeToken.sol";
import "./WNativeRelayer.sol";

contract BadgeBonus is ERC20("BadgeBonus", "BBonus"), ReentrancyGuard, Ownable {
  /// @notice Libraries
  using SafeToken for address;
  using SafeMath for uint256;

  address public token;
  BadgeNFT public badgeToken;

  IVaultConfig public config;
  uint256 public lastAccrueTime;
  uint256 public reservePool;

  /// @dev Require that the caller must be an EOA account to avoid flash loans.
  modifier onlyEOA() {
    //
    require(msg.sender == tx.origin, "Vault::onlyEoa: not eoa");
    _;
  }

  /// @dev Get token from msg.sender
  modifier transferTokenToBonus(uint256 value) {
    if (msg.value != 0) {
      require(token == config.getWrappedNativeAddr(), "Vault::transferTokenToBonus: baseToken is not wNative");
      require(value == msg.value, "Vault::transferTokenToBonus: value != msg.value");
      IWETH(config.getWrappedNativeAddr()).deposit{ value: msg.value }();
    } else {
      SafeToken.safeTransferFrom(token, msg.sender, address(this), value);
    }
    _;
  }

  constructor(
    IVaultConfig _config,
    address _token,
    BadgeNFT _badgeToken
  ) public {
    config = _config;
    token = _token;
    badgeToken = _badgeToken;
  }

  /// @dev Return the total token entitled to the token holders. Be careful of unaccrued interests.
  function totalToken() public view returns (uint256) {
    return SafeToken.myBalance(token);
  }

  /// @dev Add more token to the lending pool. Hope to get some good returns.
  function deposit(uint256 amountToken) external payable transferTokenToBonus(amountToken) nonReentrant {
    _deposit(amountToken);
  }

  function _deposit(uint256 amountToken) internal {
    uint256 length = badgeToken.totalSupply();
    uint256 amount = amountToken.div(badgeToken.GRADE_LIMIT() - 1);
    for (uint256 idx = 0; idx < length; idx++) {
      uint256 tokenId = badgeToken.tokenByIndex(idx);
      if (badgeToken.tokensGrade(tokenId) > 0) {
        address ueser = badgeToken.ownerOf(tokenId);
        uint256 grade = badgeToken.tokensGrade(tokenId);
        uint256 badgeAmount = badgeToken.gradeLimitAmount(grade);
        _mint(ueser, amount.div(badgeAmount));
      }
    }
  }

  /// @dev Withdraw token from the lending and burning.
  function withdraw() external nonReentrant {
    uint256 amount = balanceOf(msg.sender);
    _burn(msg.sender, amount);
    if (token == config.getWrappedNativeAddr()) {
      SafeToken.safeTransfer(token, config.getWNativeRelayer(), amount);
      WNativeRelayer(uint160(config.getWNativeRelayer())).withdraw(amount);
      SafeToken.safeTransferETH(msg.sender, amount);
    } else {
      SafeToken.safeTransfer(token, msg.sender, amount);
    }
  }

  /// @dev Update bank configuration to a new address. Must only be called by owner.
  /// @param _config The new configurator address.
  function updateConfig(IVaultConfig _config) external onlyOwner {
    config = _config;
  }

  /// @dev Withdraw BaseToken reserve for underwater positions to the given address.
  /// @param to The address to transfer BaseToken to.
  /// @param value The number of BaseToken tokens to withdraw. Must not exceed `reservePool`.
  function withdrawReserve(address to, uint256 value) external onlyOwner nonReentrant {
    reservePool = reservePool.sub(value);
    SafeToken.safeTransfer(token, to, value);
  }

  /// @dev Reduce BaseToken reserve, effectively giving them to the depositors.
  /// @param value The number of BaseToken reserve to reduce.
  function reduceReserve(uint256 value) external onlyOwner {
    reservePool = reservePool.sub(value);
  }

  /// @dev Fallback function to accept ETH. Workers will send ETH back the pool.
  receive() external payable {}
}
