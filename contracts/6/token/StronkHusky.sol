pragma solidity 0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../interfaces/IDebtToken.sol";
import "../interfaces/IVaultConfig.sol";
import "../interfaces/IWorker.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IFairLaunch.sol";
import "../utils/SafeToken.sol";
import "../interfaces/IStronkHuskyRelayer.sol";

contract StronkHusky is ERC20UpgradeSafe, ReentrancyGuardUpgradeSafe, OwnableUpgradeSafe {
  /// @notice Libraries
  using SafeToken for address;
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.UintSet;

  /// @notice Events
  event AddDebt(uint256 indexed id, uint256 debtShare);
  event RemoveDebt(uint256 indexed id, uint256 debtShare);
  event Work(uint256 indexed id, uint256 loan);
  event Kill(
    uint256 indexed id,
    address indexed killer,
    address owner,
    uint256 posVal,
    uint256 debt,
    uint256 prize,
    uint256 left
  );

  /// @dev Attributes for Vault
  /// token - address of the token to be deposited in this pool
  /// name - name of the ibERC20
  /// symbol - symbol of ibERC20
  /// decimals - decimals of ibERC20, this depends on the decimal of the token
  /// debtToken - just a simple ERC20 token for staking with FairLaunch
  address public token;
  address public debtToken;

  struct Position {
    address owner;
    uint256 hodlAmount;
    uint256 blockNumber;
    uint256 lastRewardBlock;
  }

  // Info of StronkHusky.
  struct StronkInfo {
    address stakeToken; // Address of Staking token contract.
    uint256 bonusMultiplier; // Bonus muliplier for stronk husky makers.
    uint256 bonusPeriodBlock; // Block number when bonus HUSKY period ends.
  }

  mapping(uint256 => Position) public positions;
  mapping(address => EnumerableSet.UintSet) private _holderPositions;
  uint256 public nextPositionID;
  uint256 public fairLaunchPoolId;

  /// address of fairLaunch contract
  address public fairLaunch;
  /// The minimum hold size per position.
  uint256 public minHoldSize;
  bool public acceptHold;

  // Bonus lock-up interest in BPS
  uint256 public lockUpInterestBps;
  StronkInfo public stronkInfo;
  IStronkHuskyRelayer relayer;

  /// @dev Require that the caller must be an EOA account to avoid flash loans.
  modifier onlyEOA() {
    //
    require(msg.sender == tx.origin, "StronkHusky::onlyEoa: not eoa");
    _;
  }

  /// @dev Get token from msg.sender
  modifier transferHuskyToStronk(uint256 value) {
    SafeToken.safeTransferFrom(token, msg.sender, address(relayer), value);
    _;
  }

  function initialize(
    address _token,
    string calldata _name,
    string calldata _symbol,
    uint8 _decimals,
    address _debtToken,
    address _fairLaunch,
    IStronkHuskyRelayer _relayer
  ) external initializer {
    OwnableUpgradeSafe.__Ownable_init();
    ReentrancyGuardUpgradeSafe.__ReentrancyGuard_init();
    ERC20UpgradeSafe.__ERC20_init(_name, _symbol);
    _setupDecimals(_decimals);

    nextPositionID = 1;
    token = _token;

    fairLaunchPoolId = uint256(-1);
    fairLaunch = _fairLaunch;
    debtToken = _debtToken;

    acceptHold = true;
    minHoldSize = 5;
    relayer = _relayer;

    SafeToken.safeApprove(debtToken, fairLaunch, uint256(-1));
  }

  /// @notice Return Token value and debt of the given position. Be careful of unaccrued interests.
  /// @param id The position ID to query.
  function positionInfo(uint256 id) external view returns (uint256) {
    Position storage pos = positions[id];
    return (pos.hodlAmount);
  }

  /// @notice Return positions of the given address.
  /// @param owner The position's owner.
  /// @return The positions array
  function positionsOfOwner(address owner) external view returns (uint256[] memory) {
    uint256 positionCount = _holderPositions[owner].length();

    uint256[] memory result = new uint256[](positionCount);

    for (uint256 i = 0; i < positionCount; i++) {
      result[i] = _holderPositions[owner].at(i);
    }
    return result;
  }

  /// @notice Return the total token entitled to the token holders. Be careful of unaccrued interests.
  function totalToken() public view returns (uint256) {
    return SafeToken.myBalance(token);
  }

  // Return reward multiplier over the given _from to _to block.
  function getMultiplier(uint256 _lastRewardBlock, uint256 _currentBlock) public view returns (uint256) {
    return _currentBlock.sub(_lastRewardBlock).div(stronkInfo.bonusPeriodBlock);
  }

  // View function to see pending HUSKYs on frontend.
  function pendingHusky(address owner) external view returns (uint256) {
    uint256 pendingHusky;
    uint256 positionCount = _holderPositions[owner].length();
    for (uint256 i = 0; i < positionCount; i++) {
      Position storage pos;
      uint256 id = _holderPositions[owner].at(i);
      pos = positions[id];
      uint256 multiplier = getMultiplier(pos.lastRewardBlock, block.number);
      pendingHusky += multiplier.mul(pos.hodlAmount).mul(lockUpInterestBps).div(10000);
    }

    return pendingHusky;
  }

  // Harvest HUSKYs earn from the pool.
  function harvestAll() external nonReentrant {
    uint256 pending;
    uint256 positionCount = _holderPositions[msg.sender].length();
    for (uint256 i = 0; i < positionCount; i++) {
      Position storage pos;
      uint256 id = _holderPositions[msg.sender].at(i);
      pos = positions[id];
      uint256 multiplier = getMultiplier(pos.lastRewardBlock, block.number);
      pending += multiplier.mul(pos.hodlAmount).mul(lockUpInterestBps).div(10000);
      pos.lastRewardBlock += multiplier.mul(stronkInfo.bonusPeriodBlock);
    }
    require(pending <= token.balanceOf(address(this)), "StronkHusky::harvest: not enough husky");
    _safeHuskyTransfer(msg.sender, pending);
  }

  function harvest(uint256 pid) external nonReentrant {
    Position storage pos = positions[pid];
    require(pos.owner == msg.sender, "only owner");
    uint256 multiplier = getMultiplier(pos.lastRewardBlock, block.number);
    require(pos.hodlAmount > 0 && multiplier > 0, "StronkHusky::harvest: nothing to harvest");
    IFairLaunch(fairLaunch).harvest(fairLaunchPoolId);
    uint256 pending = multiplier.mul(pos.hodlAmount).mul(lockUpInterestBps).div(10000);
    require(pending <= token.balanceOf(address(this)), "StronkHusky::harvest: not enough husky");
    pos.lastRewardBlock += multiplier.mul(stronkInfo.bonusPeriodBlock);
    _safeHuskyTransfer(msg.sender, pending);
  }

  /// @notice Add more token to the lending pool. Hope to get some good returns.
  function hodl(uint256 amount) external payable transferHuskyToStronk(amount) nonReentrant {
    require(acceptHold, "StronkHusky::hodl: not accept more hodl");
    require(amount >= minHoldSize, "StronkHusky::hodl: too small hodl size");

    Position storage pos;
    uint256 id = nextPositionID++;
    pos = positions[id];
    pos.owner = msg.sender;
    pos.hodlAmount = amount;
    pos.blockNumber = block.number;
    pos.lastRewardBlock = block.number;
    _holderPositions[msg.sender].add(id);

    _mint(msg.sender, amount);
    _fairLaunchDeposit(amount);
  }

  /// @notice Withdraw token from the lending and burning ibToken.
  function withdraw(uint256 id) external nonReentrant {
    Position storage pos = positions[id];
    require(pos.owner == msg.sender, "only owner");
    uint256 amount = pos.hodlAmount;
    require(amount > 0, "StronkHusky::withdraw: not good amount");

    uint256 multiplier = getMultiplier(pos.lastRewardBlock, block.number);
    if (multiplier > 0) {
      IFairLaunch(fairLaunch).harvest(fairLaunchPoolId);
      uint256 pending = multiplier.mul(pos.hodlAmount).mul(lockUpInterestBps).div(10000);
      _safeHuskyTransfer(msg.sender, pending);
    }
    _burn(msg.sender, amount);

    _fairLaunchWithdraw(amount);
    relayer.transferHusky(amount);

    positions[id].hodlAmount = 0;
    _smartSafeTransfer(msg.sender, amount);
  }

  /// @dev Mint & deposit debtToken on behalf of farmers
  /// @param amount The amount of debt that the position holds
  function _fairLaunchDeposit(uint256 amount) internal {
    if (amount > 0) {
      IDebtToken(debtToken).mint(address(this), amount);
      IFairLaunch(fairLaunch).deposit(address(this), fairLaunchPoolId, amount);
    }
  }

  /// @dev Withdraw & burn debtToken on behalf of farmers
  /// @param amount The amount of debt that the position holds
  function _fairLaunchWithdraw(uint256 amount) internal {
    if (amount > 0) {
      // Note: Do this way because we don't want to fail open, close, or kill position
      // if cannot withdraw from FairLaunch somehow. 0xb5c5f672 is a signature of withdraw(address,uint256,uint256)
      (bool success, ) = fairLaunch.call(abi.encodeWithSelector(0xb5c5f672, address(this), fairLaunchPoolId, amount));
      if (success) IDebtToken(debtToken).burn(address(this), amount);
    }
  }

  /// @dev Moves `amount` tokens from the vault to `recipient`.
  /// @param recipient The address of receiver
  /// @param amount The amount to be withdraw
  function _smartSafeTransfer(address recipient, uint256 amount) internal {
    SafeToken.safeTransfer(token, recipient, amount);
  }

  // Safe husky transfer function, just in case if rounding error causes pool to not have enough HUSKYs.
  function _safeHuskyTransfer(address to, uint256 amount) internal {
    uint256 huskyBal = SafeToken.balanceOf(token, address(this));
    if (amount > huskyBal) {
      SafeToken.safeTransfer(token, to, huskyBal);
    } else {
      SafeToken.safeTransfer(token, to, amount);
    }
  }
  /// @dev Update debtToken to a new address. Must only be called by owner.
  /// @param _debtToken The new DebtToken
  function updateDebtToken(address _debtToken, uint256 _newPid) external onlyOwner {
    require(_debtToken != token, "StronkHusky::updateDebtToken: _debtToken must not be the same as token");
    address[] memory okHolders = new address[](2);
    okHolders[0] = address(this);
    okHolders[1] = fairLaunch;
    IDebtToken(_debtToken).setOkHolders(okHolders, true);
    debtToken = _debtToken;
    fairLaunchPoolId = _newPid;
    SafeToken.safeApprove(debtToken, fairLaunch, uint256(-1));
  }

  function setFairLaunchPoolId(uint256 _poolId) external onlyOwner {
    SafeToken.safeApprove(debtToken, fairLaunch, uint256(-1));
    fairLaunchPoolId = _poolId;
  }

  /// @dev Set worker configurations. Must be called by owner.
  function setConfigs(uint256 _minHoldSize, bool _acceptHold, uint256 _lockUpInterestBps) external onlyOwner {
    minHoldSize = _minHoldSize;
    acceptHold = _acceptHold;
    lockUpInterestBps = _lockUpInterestBps;
  }

  // Set Bonus params. bonus will start to accu on the next block that this function executed
  // See the calculation and counting in test file.
  function setStronkInfo(
    address _stakeToken,
    uint256 _bonusMultiplier,
    uint256 _bonusPeriodBlock
  ) external onlyOwner {
    require(_stakeToken != address(0), "StronkHusky::setStronkInfo: not stronk stakeToken addr");
    // require(_bonusPeriodBlock > 863999, "StronkHusky::setStronkInfo: bad stronk bonusPeriodBlock"); // 863999 = 24*60*60*30/3-1
    require(_bonusMultiplier > 0, "StronkHusky::setStronkInfo: bad stronk bonusMultiplier");
    stronkInfo.stakeToken = _stakeToken;
    stronkInfo.bonusMultiplier = _bonusMultiplier;
    stronkInfo.bonusPeriodBlock = _bonusPeriodBlock;
  }

  /// @dev Fallback function to accept ETH. Workers will send ETH back the pool.
  receive() external payable {}
}
