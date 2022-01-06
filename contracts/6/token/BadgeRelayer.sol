pragma solidity 0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./HuskyToken.sol";
import "./FairLaunch.sol";
import "./badge/BadgeNFT.sol";
import "./badge/BadgePoints.sol";

import "../utils/SafeToken.sol";
import "../protocol/WNativeRelayer.sol";
import "../interfaces/IVaultConfig.sol";
import "../protocol/priceoracles/ComplexPriceOracle.sol";

contract BadgeRelayer is OwnableUpgradeSafe {
  using SafeMath for uint256;

  HuskyToken public husky;
  FairLaunch public fairLaunch;
  BadgeNFT public badgeNft;
  BadgePoints public badgePoints;
  ComplexPriceOracle public complexOracle;

  IVaultConfig public config;

  /// @dev Get token from msg.sender
  modifier transferTokenToRelayer(address token, uint256 value) {
    if (msg.value != 0) {
      require(token == config.getWrappedNativeAddr(), "Vault::transferTokenToRelayer: baseToken is not wNative");
      require(value == msg.value, "Vault::transferTokenToRelayer: value != msg.value");
      IWETH(config.getWrappedNativeAddr()).deposit{ value: msg.value }();
    } else {
      SafeToken.safeTransferFrom(token, msg.sender, address(this), value);
    }
    _;
  }

  function initialize(
    HuskyToken _husky,
    FairLaunch _fairLaunch,
    BadgeNFT _badgeNft,
    BadgePoints _badgePoints,
    ComplexPriceOracle _complexOracle,
    IVaultConfig _config
  ) external initializer {
    OwnableUpgradeSafe.__Ownable_init();

    husky = _husky;
    fairLaunch = _fairLaunch;
    badgeNft = _badgeNft;
    badgePoints = _badgePoints;
    complexOracle = _complexOracle;

    config = _config;
  }

  function mintBadge(
    uint256 _tokenId,
    string calldata _tokenURI,
    uint256 _grade,
    uint256 _userCode,
    uint256 _inviteCode
  ) external {
    uint256 balancePoints = badgePoints.balanceOf(msg.sender);
    uint256 balanceHusky = husky.balanceOf(msg.sender);
    uint256 gradeLockHusky = badgeNft.gradeLockHuskys(_grade);
    require(balancePoints >= badgeNft.gradeNeedPoints(_grade), "mintBadge: Points not enough");
    require(balanceHusky >= gradeLockHusky, "mintBadge: Husky not enough");

    badgePoints.makeInviteRelation(msg.sender, _userCode, _inviteCode);
    badgeNft.mintTo(msg.sender, _tokenId, _grade);
    badgeNft.setTokenURI(_tokenId, _tokenURI);
    fairLaunch.lockToOwner(msg.sender, gradeLockHusky);
  }

  function upgradeBadge(uint256 _tokenId, uint256 _newGrade) external {
    uint256 grade = badgeNft.tokensGrade(_tokenId);
    require(_newGrade > grade, "upgradeBadge: NewGrade not biger");
    uint256 balancePoints = badgePoints.balanceOf(msg.sender);
    uint256 balanceHusky = husky.balanceOf(msg.sender);
    uint256 gradeLockHusky = badgeNft.gradeLockHuskys(grade);
    uint256 nextGradeLockHusky = badgeNft.gradeLockHuskys(_newGrade);
    require(msg.sender == badgeNft.ownerOf(_tokenId), "upgradeBadge: Sender not owner");
    require(balancePoints >= badgeNft.gradeNeedPoints(_newGrade), "upgradeBadge: Points not enough");
    require(balanceHusky >= nextGradeLockHusky - gradeLockHusky, "upgradeBadge: Husky not enough");

    badgeNft.upgrade(_tokenId, _newGrade);

    fairLaunch.lockToOwner(msg.sender, nextGradeLockHusky.sub(gradeLockHusky));
  }

  function transferBadge(
    address _token,
    uint256 _amount,
    address _to,
    uint256 _tokenId,
    uint256 _userCode
  ) external payable transferTokenToRelayer(_token, _amount) {
    uint256 grade = badgeNft.tokensGrade(_tokenId);
    uint256 gradePoints = badgeNft.gradeNeedPoints(grade);

    //  no need to transfer husky, it will unlock to owner if nft had burned
    badgePoints.makeInviteRelation(msg.sender, _userCode, 0);
    badgeNft.transferFrom(_to, msg.sender, _tokenId);
    badgePoints.transferFrom(_to, msg.sender, gradePoints);

    if (_token == config.getWrappedNativeAddr()) {
      SafeToken.safeTransfer(_token, config.getWNativeRelayer(), _amount);
      WNativeRelayer(uint160(config.getWNativeRelayer())).withdraw(_amount);
      SafeToken.safeTransferETH(_to, _amount);
    } else {
      SafeToken.safeTransfer(_token, _to, _amount);
    }

  }

  function burn(uint256 _tokenId) external {
    uint256 grade = badgeNft.tokensGrade(_tokenId);
    uint256 gradeLockHusky = badgeNft.gradeLockHuskys(grade);
    badgeNft.burn(msg.sender, _tokenId);
    badgePoints.deleteInvite(msg.sender);

    fairLaunch.unlockFromOwner(msg.sender, gradeLockHusky);
  }

  /// @dev Update bank configuration to a new address. Must only be called by owner.
  /// @param _config The new configurator address.
  function updateConfig(IVaultConfig _config) external onlyOwner {
    config = _config;
  }

  function mintPoints(
    address _account,
    address _stakeToken,
    uint256 _amount,
    uint256 _multiplier
  ) external onlyOwner {
    (uint256 price, ) = complexOracle.getPrice(_stakeToken);
    uint256 amount = _amount.mul(price).mul(_multiplier).div(1e18);

    badgePoints.mint(_account, amount);
  }

}
