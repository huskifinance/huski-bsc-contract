pragma solidity 0.6.6;

import "../interfaces/IHuskyToken.sol";
import "../utils/SafeToken.sol";
import "../interfaces/IStronkHuskyRelayer.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract StronkHuskyRelayer is Ownable, IStronkHuskyRelayer, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // Husky address
  address public huskyToken;

  constructor(
    address _husky
  ) public {
    huskyToken = _husky;
  }

  function transferHusky(uint256 amount) external override nonReentrant onlyOwner {
    SafeToken.safeTransfer(huskyToken, msg.sender, amount);
  }
}
