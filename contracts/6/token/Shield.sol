pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IFairLaunchV1.sol";

contract Shield is Ownable {
  using SafeMath for uint256;

  IFairLaunchV1 public fairLaunchV1;

  uint256 public mintLimit = 8000000e18;
  uint256 public mintCount = 250000e18;

  event SetHuskyPerBlock(uint256 indexed _huskyPerBlock);
  event SetBonus(uint256 _bonusMultiplier, uint256 _bonusEndBlock, uint256 _bonusLockUpBps);
  event MintWarchest(address indexed _to, uint256 _amount);
  event AddPool(uint256 indexed _pid, uint256 _allocPoint, address indexed _stakeToken);
  event SetPool(uint256 indexed _pid, uint256 _allocPoint);

  constructor(address _owner, IFairLaunchV1 _fairLaunchV1) public {
    transferOwnership(_owner);
    fairLaunchV1 = _fairLaunchV1;
  }

  /// @dev Set HUSKY per Block on FLV1. Effect immediately on the next block.
  /// @param _huskyPerBlock The new huskyPerBlock
  function setHuskyPerBlock(uint256 _huskyPerBlock) external onlyOwner {
    fairLaunchV1.setHuskyPerBlock(_huskyPerBlock);
    emit SetHuskyPerBlock(_huskyPerBlock);
  }

  /// @dev Set Bonus period on FLV1. This shouldn't be used much. Better use FLV2
  /// @param _bonusMultiplier New bonusMultiplier
  /// @param _bonusEndBlock The block that this bonus will be ended
  /// @param _bonusLockUpBps The % that will rewards on bonus period will be locked
  function setBonus(uint256 _bonusMultiplier, uint256 _bonusEndBlock, uint256 _bonusLockUpBps) external onlyOwner {
    fairLaunchV1.setBonus(_bonusMultiplier, _bonusEndBlock, _bonusLockUpBps);
    emit SetBonus(_bonusMultiplier, _bonusEndBlock, _bonusLockUpBps);
  }

  /// @dev Maunally mint HUSKY warchest portion.
  /// @param _to Mint to which address
  /// @param _amount Amount to be minted
  function mintWarchest(address _to, uint256 _amount) external onlyOwner {
    require(mintCount.add(_amount) <= mintLimit, "Shield::mintWarchest: mint exceeded mintLimit");
    fairLaunchV1.manualMint(_to, _amount);
    mintCount = mintCount.add(_amount);
    emit MintWarchest(_to, _amount);
  }

  /// @dev Add new pool to FLV1
  /// @param _allocPoint Allocation point of a new pool
  /// @param _stakeToken Token to be staked
  /// @param _withUpdate Mass update pool?
  function addPool(uint256 _allocPoint, address _stakeToken, bool _withUpdate) external onlyOwner {
    fairLaunchV1.addPool(_allocPoint, _stakeToken, _withUpdate);
    emit AddPool(fairLaunchV1.poolLength().sub(1), _allocPoint, _stakeToken);
  }

  /// @dev Set pool on FLV1. Update pool allocation point
  /// @param _pid PoolId to be updated
  /// @param _allocPoint New allocPoint
  /// @param _withUpdate Mass update pool?
  function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyOwner {
    fairLaunchV1.setPool(_pid, _allocPoint, _withUpdate);
    emit SetPool(_pid, _allocPoint);
  }
}
