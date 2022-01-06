pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./HuskyToken.sol";
import "./badge/BadgeNFT.sol";
import "./badge/BadgePoints.sol";
import "../protocol/priceoracles/ComplexPriceOracle.sol";

import "../interfaces/IFairLaunch.sol";

// FairLaunch is a smart contract for distributing HUSKY by asking user to stake the ERC20-based token.
contract FairLaunch is IFairLaunch, Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // Info of each user.
  struct UserInfo {
    uint256 amount; // How many Staking tokens the user has provided.
    uint256 rewardDebt; // Reward debt. See explanation below.
    uint256 bonusDebt; // Last block that user exec something to the pool.
    address fundedBy; // Funded by who?
    uint256 lastClaimBlock; // Last block number that HUSKYs claim occurs.
    //
    // We do some fancy math here. Basically, any point in time, the amount of HUSKYs
    // entitled to a user but is pending to be distributed is:
    //
    //   pending reward = (user.amount * pool.accHuskyPerShare) - user.rewardDebt
    //
    // Whenever a user deposits or withdraws Staking tokens to a pool. Here's what happens:
    //   1. The pool's `accHuskyPerShare` (and `lastRewardBlock`) gets updated.
    //   2. User receives the pending reward sent to his/her address.
    //   3. User's `amount` gets updated.
    //   4. User's `rewardDebt` gets updated.
  }

  // Info of each pool.
  struct PoolInfo {
    string symbol;
    address stakeToken; // Address of Staking token contract.
    uint256 allocPoint; // How many allocation points assigned to this pool. HUSKYs to distribute per block.
    uint256 lastRewardBlock; // Last block number that HUSKYs distribution occurs.
    uint256 accHuskyPerShare; // Accumulated HUSKYs per share, times 1e12. See below.
    uint256 accHuskyPerShareTilBonusEnd; // Accumated HUSKYs per share until Bonus End.
  }

  // The Husky TOKEN!
  HuskyToken public husky;
  // The Badge TOKEN
  address public badgeRelayer;
  BadgePoints public badgePoints;
  ComplexPriceOracle public complexOracle;
  uint256 private lastMultiplier;
  // Dev address.
  address public devaddr;
  // HUSKY tokens created per block.
  uint256 public huskyPerBlock;
  // Bonus muliplier for early husky makers.
  uint256 public bonusMultiplier;
  // Block number when bonus HUSKY period ends.
  uint256 public bonusEndBlock;
  // Bonus lock-up in BPS
  uint256 public bonusLockUpBps;

  // Info of each pool.
  PoolInfo[] public poolInfo;
  // Info of each user that stakes Staking tokens.
  mapping(uint256 => mapping(address => UserInfo)) public userInfo;
  // Total allocation poitns. Must be the sum of all allocation points in all pools.
  uint256 public totalAllocPoint;
  // The block number when HUSKY mining starts.
  uint256 public startBlock;

  event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
  event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
  event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

  constructor(
    HuskyToken _husky,
    address _devaddr,
    uint256 _huskyPerBlock,
    uint256 _startBlock,
    uint256 _bonusLockupBps,
    uint256 _bonusEndBlock
  ) public {
    bonusMultiplier = 0;
    totalAllocPoint = 0;
    husky = _husky;
    devaddr = _devaddr;
    huskyPerBlock = _huskyPerBlock;
    bonusLockUpBps = _bonusLockupBps;
    bonusEndBlock = _bonusEndBlock;
    startBlock = _startBlock;
  }

  /*
  ██████╗░░█████╗░██████╗░░█████╗░███╗░░░███╗  ░██████╗███████╗████████╗████████╗███████╗██████╗░
  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗████╗░████║  ██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
  ██████╔╝███████║██████╔╝███████║██╔████╔██║  ╚█████╗░█████╗░░░░░██║░░░░░░██║░░░█████╗░░██████╔╝
  ██╔═══╝░██╔══██║██╔══██╗██╔══██║██║╚██╔╝██║  ░╚═══██╗██╔══╝░░░░░██║░░░░░░██║░░░██╔══╝░░██╔══██╗
  ██║░░░░░██║░░██║██║░░██║██║░░██║██║░╚═╝░██║  ██████╔╝███████╗░░░██║░░░░░░██║░░░███████╗██║░░██║
  ╚═╝░░░░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░░░░╚═╝  ╚═════╝░╚══════╝░░░╚═╝░░░░░░╚═╝░░░╚══════╝╚═╝░░╚═╝
  */

  // Update dev address by the previous dev.
  function setDev(address _devaddr) public {
    require(msg.sender == devaddr, "dev: wut?");
    devaddr = _devaddr;
  }

  function setHuskyPerBlock(uint256 _huskyPerBlock) external onlyOwner {
    huskyPerBlock = _huskyPerBlock;
  }

  function setBadgeRelayer(address _relayer) external onlyOwner {
    badgeRelayer = _relayer;
  }

  function setBadgePoints(BadgePoints _badgePoints, ComplexPriceOracle _complexOracle) external onlyOwner {
    badgePoints = _badgePoints;
    complexOracle = _complexOracle;
  }

  // Set Bonus params. bonus will start to accu on the next block that this function executed
  // See the calculation and counting in test file.
  function setBonus(
    uint256 _bonusMultiplier,
    uint256 _bonusEndBlock,
    uint256 _bonusLockUpBps
  ) external onlyOwner {
    require(_bonusEndBlock > block.number, "setBonus: bad bonusEndBlock");
    require(_bonusMultiplier > 1, "setBonus: bad bonusMultiplier");
    bonusMultiplier = _bonusMultiplier;
    bonusEndBlock = _bonusEndBlock;
    bonusLockUpBps = _bonusLockUpBps;
  }

  // Add a new lp to the pool. Can only be called by the owner.
  function addPool(
    string calldata _symbol,
    uint256 _allocPoint,
    address _stakeToken,
    bool _withUpdate
  ) external override onlyOwner {
    if (_withUpdate) {
      massUpdatePools();
    }
    require(_stakeToken != address(0), "add: not stakeToken addr");
    require(!isDuplicatedPool(_stakeToken), "add: stakeToken dup");
    uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
    totalAllocPoint = totalAllocPoint.add(_allocPoint);
    poolInfo.push(
      PoolInfo({
        symbol: _symbol,
        stakeToken: _stakeToken,
        allocPoint: _allocPoint,
        lastRewardBlock: lastRewardBlock,
        accHuskyPerShare: 0,
        accHuskyPerShareTilBonusEnd: 0
      })
    );
  }

  // Update the given pool's HUSKY allocation point. Can only be called by the owner.
  function setPool(
    uint256 _pid,
    uint256 _allocPoint,
    bool /* _withUpdate */
  ) external override onlyOwner {
    massUpdatePools();
    totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
    poolInfo[_pid].allocPoint = _allocPoint;
  }

  /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░██╗░░██╗
  ░██║░░██╗░░██║██╔══██╗██╔══██╗██║░██╔╝
  ░╚██╗████╗██╔╝██║░░██║██████╔╝█████═╝░
  ░░████╔═████║░██║░░██║██╔══██╗██╔═██╗░
  ░░╚██╔╝░╚██╔╝░╚█████╔╝██║░░██║██║░╚██╗
  ░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚═╝╚═╝░░╚═╝
  */

  function isDuplicatedPool(address _stakeToken) public view returns (bool) {
    uint256 length = poolInfo.length;
    for (uint256 _pid = 0; _pid < length; _pid++) {
      if (poolInfo[_pid].stakeToken == _stakeToken) return true;
    }
    return false;
  }

  function poolLength() external view override returns (uint256) {
    return poolInfo.length;
  }

  function manualMint(address _to, uint256 _amount) external onlyOwner {
    husky.manualMint(_to, _amount);
  }

  // Return reward multiplier over the given _from to _to block.
  function getMultiplier(uint256 _lastRewardBlock, uint256 _currentBlock) public view returns (uint256) {
    if (_currentBlock <= bonusEndBlock) {
      return _currentBlock.sub(_lastRewardBlock).mul(bonusMultiplier);
    }
    if (_lastRewardBlock >= bonusEndBlock) {
      return _currentBlock.sub(_lastRewardBlock);
    }
    // This is the case where bonusEndBlock is in the middle of _lastRewardBlock and _currentBlock block.
    return bonusEndBlock.sub(_lastRewardBlock).mul(bonusMultiplier).add(_currentBlock.sub(bonusEndBlock));
  }

  // View function to see pending HUSKYs on frontend.
  function pendingHusky(uint256 _pid, address _user) external view override returns (uint256) {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];
    uint256 accHuskyPerShare = pool.accHuskyPerShare;
    uint256 lpSupply = IERC20(pool.stakeToken).balanceOf(address(this));
    if (block.number > pool.lastRewardBlock && lpSupply != 0) {
      uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
      uint256 huskyReward = multiplier.mul(huskyPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
      accHuskyPerShare = accHuskyPerShare.add(huskyReward.mul(1e12).div(lpSupply));
    }
    return user.amount.mul(accHuskyPerShare).div(1e12).sub(user.rewardDebt);
  }

  // Update reward vairables for all pools. Be careful of gas spending!
  function massUpdatePools() public {
    uint256 length = poolInfo.length;
    for (uint256 pid = 0; pid < length; ++pid) {
      updatePool(pid);
    }
  }

  // Update reward variables of the given pool to be up-to-date.
  function updatePool(uint256 _pid) public override {
    PoolInfo storage pool = poolInfo[_pid];
    if (block.number <= pool.lastRewardBlock) {
      return;
    }
    uint256 lpSupply = IERC20(pool.stakeToken).balanceOf(address(this));
    if (lpSupply == 0) {
      pool.lastRewardBlock = block.number;
      return;
    }
    uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
    uint256 huskyReward = multiplier.mul(huskyPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
    husky.mint(devaddr, huskyReward.div(10));
    husky.mint(address(this), huskyReward);
    pool.accHuskyPerShare = pool.accHuskyPerShare.add(huskyReward.mul(1e12).div(lpSupply));
    // update accHuskyPerShareTilBonusEnd
    if (block.number <= bonusEndBlock) {
      husky.lock(devaddr, huskyReward.mul(bonusLockUpBps).div(100000));
      pool.accHuskyPerShareTilBonusEnd = pool.accHuskyPerShare;
    }
    if (block.number > bonusEndBlock && pool.lastRewardBlock < bonusEndBlock) {
      uint256 huskyBonusPortion = bonusEndBlock
        .sub(pool.lastRewardBlock)
        .mul(bonusMultiplier)
        .mul(huskyPerBlock)
        .mul(pool.allocPoint)
        .div(totalAllocPoint);
      husky.lock(devaddr, huskyBonusPortion.mul(bonusLockUpBps).div(100000));
      pool.accHuskyPerShareTilBonusEnd = pool.accHuskyPerShareTilBonusEnd.add(
        huskyBonusPortion.mul(1e12).div(lpSupply)
      );
    }
    pool.lastRewardBlock = block.number;
    lastMultiplier = multiplier;
  }

  // Deposit Staking tokens to FairLaunchToken for HUSKY allocation.
  function deposit(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) external override nonReentrant {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_for];
    if (user.fundedBy != address(0)) require(user.fundedBy == msg.sender, "bad sof");
    require(pool.stakeToken != address(0), "deposit: not accept deposit");
    updatePool(_pid);
    if (user.amount > 0) _harvest(_for, _pid);
    if (user.fundedBy == address(0)) user.fundedBy = msg.sender;
    IERC20(pool.stakeToken).safeTransferFrom(address(msg.sender), address(this), _amount);
    user.amount = user.amount.add(_amount);
    user.rewardDebt = user.amount.mul(pool.accHuskyPerShare).div(1e12);
    user.bonusDebt = user.amount.mul(pool.accHuskyPerShareTilBonusEnd).div(1e12);
    emit Deposit(msg.sender, _pid, _amount);
  }

  // Withdraw Staking tokens from FairLaunchToken.
  function withdraw(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) external override nonReentrant {
    _withdraw(_for, _pid, _amount);
  }

  function withdrawAll(address _for, uint256 _pid) external override nonReentrant {
    _withdraw(_for, _pid, userInfo[_pid][_for].amount);
  }

  function _withdraw(
    address _for,
    uint256 _pid,
    uint256 _amount
  ) internal {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_for];
    require(user.fundedBy == msg.sender, "only funder");
    require(user.amount >= _amount, "withdraw: not good");
    updatePool(_pid);
    _harvest(_for, _pid);
    user.amount = user.amount.sub(_amount);
    user.rewardDebt = user.amount.mul(pool.accHuskyPerShare).div(1e12);
    user.bonusDebt = user.amount.mul(pool.accHuskyPerShareTilBonusEnd).div(1e12);
    if (user.amount == 0) user.fundedBy = address(0);
    if (pool.stakeToken != address(0)) {
      IERC20(pool.stakeToken).safeTransfer(address(msg.sender), _amount);
    }
    emit Withdraw(msg.sender, _pid, user.amount);
  }

  // Harvest HUSKYs earn from the pool.
  function harvest(uint256 _pid) external override nonReentrant {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][msg.sender];
    updatePool(_pid);
    _harvest(msg.sender, _pid);
    user.rewardDebt = user.amount.mul(pool.accHuskyPerShare).div(1e12);
    user.bonusDebt = user.amount.mul(pool.accHuskyPerShareTilBonusEnd).div(1e12);
  }

  function _harvest(address _to, uint256 _pid) internal {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_to];
    require(user.amount > 0, "nothing to harvest");
    uint256 pending = user.amount.mul(pool.accHuskyPerShare).div(1e12).sub(user.rewardDebt);
    require(pending <= husky.balanceOf(address(this)), "wtf not enough husky");
    uint256 bonus = user.amount.mul(pool.accHuskyPerShareTilBonusEnd).div(1e12).sub(user.bonusDebt);

    safeHuskyTransfer(_to, pending);
    husky.lock(_to, bonus.mul(bonusLockUpBps).div(10000));

    if (address(complexOracle) != address(0) && address(badgePoints) != address(0)) {
      (uint256 price, ) = complexOracle.getPrice(pool.stakeToken);
      uint256 amount = user.amount.mul(price).mul(lastMultiplier).div(1e18);
      badgePoints.mint(_to, amount);
    }
  }

  // Withdraw without caring about rewards. EMERGENCY ONLY.
  function emergencyWithdraw(uint256 _pid) external nonReentrant {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][msg.sender];
    require(user.fundedBy == msg.sender, "only funder");
    IERC20(pool.stakeToken).safeTransfer(address(msg.sender), user.amount);
    emit EmergencyWithdraw(msg.sender, _pid, user.amount);
    user.amount = 0;
    user.rewardDebt = 0;
    user.fundedBy = address(0);
  }

  // Safe husky transfer function, just in case if rounding error causes pool to not have enough HUSKYs.
  function safeHuskyTransfer(address _to, uint256 _amount) internal {
    uint256 huskyBal = husky.balanceOf(address(this));
    if (_amount > huskyBal) {
      require(husky.transfer(_to, huskyBal), "failed to transfer HUSKY");
    } else {
      require(husky.transfer(_to, _amount), "failed to transfer HUSKY");
    }
  }

  // badge operation
  function lockToOwner(address _account, uint256 _amount) external {
    require(msg.sender == badgeRelayer, "badgeRelayer: wut?");
    husky.lockToOwner(_account, _amount);
  }

  function unlockFromOwner(address _account, uint256 _amount) external {
    require(msg.sender == badgeRelayer, "badgeRelayer: wut?");
    uint256 returnHusky = _amount.div(10);
    safeHuskyTransfer(devaddr, returnHusky);
    safeHuskyTransfer(_account, _amount.sub(returnHusky));
  }
}
