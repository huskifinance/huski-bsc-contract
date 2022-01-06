import { ethers, upgrades, waffle } from "hardhat";
import { Overrides, Signer, BigNumberish, utils, Wallet } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import {
  HuskyToken,
  HuskyToken__factory,
  FairLaunch,
  FairLaunch__factory,
  MockERC20,
  MockERC20__factory,
  ComplexPriceOracle,
  ComplexPriceOracle__factory,
  SimpleVaultConfig,
  SimpleVaultConfig__factory,
  WNativeRelayer,
  WNativeRelayer__factory,
  MockWBNB,
  MockWBNB__factory,
  BadgeNFT,
  BadgeNFT__factory,
  BadgePoints,
  BadgePoints__factory,
  BadgeRelayer,
  BadgeRelayer__factory,

} from "../typechain";

chai.use(solidity);
const { expect } = chai;

describe("FairLaunch", () => {
  const HUSKI_REWARD_PER_BLOCK = ethers.utils.parseEther('5000');
  const HUSKI_BONUS_LOCK_UP_BPS = 7000;

  // Contract as Signer
  let huskyTokenAsAlice: HuskyToken;
  let huskyTokenAsBob: HuskyToken;
  let huskyTokenAsDev: HuskyToken;

  let stoken0AsDeployer: MockERC20;
  let stoken0AsAlice: MockERC20;
  let stoken0AsBob: MockERC20;
  let stoken0AsDev: MockERC20;

  let stoken1AsDeployer: MockERC20;
  let stoken1AsAlice: MockERC20;
  let stoken1AsBob: MockERC20;
  let stoken1AsDev: MockERC20;

  let fairLaunchAsDeployer: FairLaunch;
  let fairLaunchAsAlice: FairLaunch;
  let fairLaunchAsBob: FairLaunch;
  let fairLaunchAsDev: FairLaunch;

  // Accounts
  let deployer: Signer;
  let alice: Signer;
  let bob: Signer;
  let dev: Signer;

  let huskyToken: HuskyToken;
  let fairLaunch: FairLaunch;
  let stakingTokens: MockERC20[];

  let badgePoints: BadgePoints;
  let badgeNFT: BadgeNFT;
  let badgeRelayer: BadgeRelayer;
  let simpleVaultConfig: SimpleVaultConfig;
  let complexPriceOracle: ComplexPriceOracle;
  let wbnb: MockWBNB;
  let wNativeRelayer: WNativeRelayer;


  const RESERVE_POOL_BPS = '1000'; // 10% reserve pool
  const KILL_PRIZE_BPS = '1000'; // 10% Kill prize
  const INTEREST_RATE = '3472222222222'; // 30% per year
  const MIN_DEBT_SIZE = ethers.utils.parseEther('1'); // 1 BTOKEN min debt size


  beforeEach(async () => {
    [deployer, alice, bob, dev] = await ethers.getSigners();

    // Setup FairLaunch contract
    // Deploy HUSKIs
    const HuskyToken = (await ethers.getContractFactory(
      "HuskyToken",
      deployer
    )) as HuskyToken__factory;
    huskyToken = await HuskyToken.deploy(132, 137);
    await huskyToken.deployed();

    const FairLaunch = (await ethers.getContractFactory(
      "FairLaunch",
      deployer
    )) as FairLaunch__factory;
    fairLaunch = await FairLaunch.deploy(
      huskyToken.address, (await dev.getAddress()), HUSKI_REWARD_PER_BLOCK, 0, HUSKI_BONUS_LOCK_UP_BPS, 0
    )
    await fairLaunch.deployed();

    await huskyToken.transferOwnership(fairLaunch.address);

    stakingTokens = new Array();
    for (let i = 0; i < 4; i++) {
      const MockERC20 = (await ethers.getContractFactory(
        "MockERC20",
        deployer
      )) as MockERC20__factory;
      const mockERC20 = await upgrades.deployProxy(MockERC20, [`STOKEN${i}`, `STOKEN${i}`], { unsafeAllow: ['delegatecall'] }) as MockERC20;
      await mockERC20.deployed();
      stakingTokens.push(mockERC20);
    }


    const ComplexPriceOracle = (await ethers.getContractFactory(
      "ComplexPriceOracle",
      deployer
    )) as ComplexPriceOracle__factory;
    complexPriceOracle = await upgrades.deployProxy(ComplexPriceOracle, [await deployer.getAddress()], { unsafeAllow: ['delegatecall'] }) as ComplexPriceOracle;
    await complexPriceOracle.deployed();

    const WBNB = (await ethers.getContractFactory(
      "MockWBNB",
      deployer
    )) as MockWBNB__factory;
    wbnb = await WBNB.deploy();
    await wbnb.deployed()


    const WNativeRelayer = (await ethers.getContractFactory(
      "WNativeRelayer",
      deployer
    )) as WNativeRelayer__factory;
    wNativeRelayer = await WNativeRelayer.deploy(wbnb.address);
    await wNativeRelayer.deployed();


    const SimpleVaultConfig = (await ethers.getContractFactory(
      "SimpleVaultConfig",
      deployer
    )) as SimpleVaultConfig__factory;
    simpleVaultConfig = await upgrades.deployProxy(SimpleVaultConfig, [
      MIN_DEBT_SIZE, INTEREST_RATE, RESERVE_POOL_BPS, KILL_PRIZE_BPS,
      wbnb.address, wNativeRelayer.address, fairLaunch.address
    ], { unsafeAllow: ['delegatecall'] }) as SimpleVaultConfig;
    await simpleVaultConfig.deployed();

    const BadgePoints = (await ethers.getContractFactory(
      "BadgePoints",
      deployer
    )) as BadgePoints__factory;
    badgePoints = await BadgePoints.deploy();
    await badgePoints.deployed();

    const BadgeNFT = (await ethers.getContractFactory(
      "BadgeNFT",
      deployer
    )) as BadgeNFT__factory;
    badgeNFT = await BadgeNFT.deploy();
    await badgeNFT.deployed();

    const BadgeRelayer = (await ethers.getContractFactory(
      "BadgeRelayer",
      deployer
    )) as BadgeRelayer__factory;
    badgeRelayer = await upgrades.deployProxy(BadgeRelayer,
      [huskyToken.address, fairLaunch.address, badgeNFT.address,
      badgePoints.address, complexPriceOracle.address,
      simpleVaultConfig.address], { unsafeAllow: ['delegatecall'] }) as BadgeRelayer;
    await badgeRelayer.deployed();


    huskyTokenAsAlice = HuskyToken__factory.connect(huskyToken.address, alice);
    huskyTokenAsBob = HuskyToken__factory.connect(huskyToken.address, bob);
    huskyTokenAsDev = HuskyToken__factory.connect(huskyToken.address, dev);

    stoken0AsDeployer = MockERC20__factory.connect(stakingTokens[0].address, deployer);
    stoken0AsAlice = MockERC20__factory.connect(stakingTokens[0].address, alice);
    stoken0AsBob = MockERC20__factory.connect(stakingTokens[0].address, bob);
    stoken0AsDev = MockERC20__factory.connect(stakingTokens[0].address, dev);

    stoken1AsDeployer = MockERC20__factory.connect(stakingTokens[1].address, deployer);
    stoken1AsAlice = MockERC20__factory.connect(stakingTokens[1].address, alice);
    stoken1AsBob = MockERC20__factory.connect(stakingTokens[1].address, bob);
    stoken1AsDev = MockERC20__factory.connect(stakingTokens[1].address, dev);

    fairLaunchAsDeployer = FairLaunch__factory.connect(fairLaunch.address, deployer);
    fairLaunchAsAlice = FairLaunch__factory.connect(fairLaunch.address, alice);
    fairLaunchAsBob = FairLaunch__factory.connect(fairLaunch.address, bob);
    fairLaunchAsDev = FairLaunch__factory.connect(fairLaunch.address, dev);

    await fairLaunch.setBadgeRelayer(badgeRelayer.address);
    await fairLaunch.setBadgePoints(badgePoints.address, complexPriceOracle.address);
  });

  context('when adjust params', async () => {
    it('should add new pool', async () => {
      for (let i = 0; i < stakingTokens.length; i++) {
        await fairLaunch.addPool('test', 1, stakingTokens[i].address, false,
          { from: (await deployer.getAddress()) } as Overrides)
      }
      expect(await fairLaunch.poolLength()).to.eq(stakingTokens.length);
    });

    it('should revert when the stakeToken is already added to the pool', async () => {
      for (let i = 0; i < stakingTokens.length; i++) {
        await fairLaunch.addPool('test', 1, stakingTokens[i].address, false,
          { from: (await deployer.getAddress()) } as Overrides)
      }
      expect(await fairLaunch.poolLength()).to.eq(stakingTokens.length);

      await expect(fairLaunch.addPool('test', 1, stakingTokens[0].address, false,
        { from: (await deployer.getAddress()) } as Overrides)).to.be.revertedWith("add: stakeToken dup");
    });
  });

  context('when use pool', async () => {
    it('should revert when there is nothing to be harvested', async () => {
      await fairLaunch.addPool('test', 1, stakingTokens[0].address.toString(), false,
        { from: (await deployer.getAddress()) } as Overrides);
      await expect(fairLaunch.harvest(0,
        { from: (await deployer.getAddress()) } as Overrides)).to.be.revertedWith("nothing to harvest");
    });

    it('should revert when that pool is not existed', async () => {
      await expect(fairLaunch.deposit((await deployer.getAddress()), 88, ethers.utils.parseEther('100'),
        { from: (await deployer.getAddress()) } as Overrides)).to.be.reverted;
    });

    it('should revert when withdrawer is not a funder', async () => {
      // 1. Mint STOKEN0 for staking
      await stoken0AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('400'));

      // 2. Add STOKEN0 to the fairLaunch pool
      await fairLaunchAsDeployer.addPool('test', 1, stakingTokens[0].address, false);

      // 3. Deposit STOKEN0 to the STOKEN0 pool
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsAlice.deposit((await bob.getAddress()), 0, ethers.utils.parseEther('100'));

      // 4. Bob try to withdraw from the pool
      // Bob shuoldn't do that, he can get yield but not the underlaying
      await expect(fairLaunchAsBob.withdrawAll((await bob.getAddress()), 0)).to.be.revertedWith("only funder");
    });

    it('should revert when 2 accounts try to fund the same user', async () => {
      // 1. Mint STOKEN0 for staking
      await stoken0AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('400'));
      await stoken0AsDeployer.mint((await dev.getAddress()), ethers.utils.parseEther('100'));

      // 2. Add STOKEN0 to the fairLaunch pool
      await fairLaunchAsDeployer.addPool('test', 1, stakingTokens[0].address, false);

      // 3. Deposit STOKEN0 to the STOKEN0 pool
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsAlice.deposit((await bob.getAddress()), 0, ethers.utils.parseEther('100'));

      // 4. Dev try to deposit to the pool on the bahalf of Bob
      // Dev should get revert tx as this will fuck up the tracking
      await stoken0AsDev.approve(fairLaunch.address, ethers.utils.parseEther("100"));
      await expect(fairLaunchAsDev.deposit((await bob.getAddress()), 0, ethers.utils.parseEther('1'))).to.be.revertedWith('bad sof');
    });

    it('should harvest yield from the position opened by funder', async () => {
      // 1. Mint STOKEN0 for staking
      await stoken0AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('400'));

      // 2. Add STOKEN0 to the fairLaunch pool
      await fairLaunchAsDeployer.addPool('test', 1, stakingTokens[0].address, false);
      await complexPriceOracle.setPrices([stakingTokens[0].address], [1])
      await badgePoints.setOperatorOk([fairLaunch.address], true);


      // 3. Deposit STOKEN0 to the STOKEN0 pool
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsAlice.deposit((await bob.getAddress()), 0, ethers.utils.parseEther('100'));

      // 4. Move 1 Block so there is some pending
      await fairLaunchAsDeployer.massUpdatePools();
      expect(await fairLaunchAsBob.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5000'));

      // 5. Harvest all yield
      await fairLaunchAsBob.harvest(0);

      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('10000'));
    });

    it('should distribute rewards according to the alloc point', async () => {
      // 1. Mint STOKEN0 and STOKEN1 for staking
      await stoken0AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('100'));
      await stoken1AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('50'));

      // 2. Add STOKEN0 to the fairLaunch pool
      await fairLaunchAsDeployer.addPool('test', 50, stakingTokens[0].address, false);
      await fairLaunchAsDeployer.addPool('test', 50, stakingTokens[1].address, false);
      await complexPriceOracle.setPrices([stakingTokens[0].address, stakingTokens[1].address], [1, 1])
      await badgePoints.setOperatorOk([fairLaunch.address], true);


      // 3. Deposit STOKEN0 to the STOKEN0 pool
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsAlice.deposit((await alice.getAddress()), 0, ethers.utils.parseEther('100'));

      // 4. Deposit STOKEN1 to the STOKEN1 pool
      await stoken1AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('50'));
      await fairLaunchAsAlice.deposit((await alice.getAddress()), 1, ethers.utils.parseEther('50'));

      // 4. Move 1 Block so there is some pending
      await fairLaunchAsDeployer.massUpdatePools();

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await fairLaunch.pendingHusky(1, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('2500'));

      // 5. Harvest all yield
      await fairLaunchAsAlice.harvest(0);
      await fairLaunchAsAlice.harvest(1);

      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));
    })

    it('should work', async () => {
      // 1. Mint STOKEN0 for staking
      await stoken0AsDeployer.mint((await alice.getAddress()), ethers.utils.parseEther('400'));
      await stoken0AsDeployer.mint((await bob.getAddress()), ethers.utils.parseEther('100'));

      // 2. Add STOKEN0 to the fairLaunch pool
      await fairLaunchAsDeployer.addPool('test', 1, stakingTokens[0].address, false);
      await complexPriceOracle.setPrices([stakingTokens[0].address], [1])
      await badgePoints.setOperatorOk([fairLaunch.address], true);

      // 3. Deposit STOKEN0 to the STOKEN0 pool
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsAlice.deposit((await alice.getAddress()), 0, ethers.utils.parseEther('100'));

      // 4. Trigger random update pool to make 1 more block mine
      await fairLaunchAsAlice.massUpdatePools();

      // 5. Check pendingHusky for Alice
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5000'));

      // 6. Trigger random update pool to make 1 more block mine
      await fairLaunchAsAlice.massUpdatePools();

      // 7. Check pendingHusky for Alice
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('10000'));

      // 8. Alice should get 15,000 HUSKIs when she harvest
      // also check that dev got his tax
      await fairLaunchAsAlice.harvest(0);
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('15000'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('1500'));

      // 9. Bob come in and join the party
      // 2 blocks are mined here, hence Alice should get 10,000 HUSKIs more
      await stoken0AsBob.approve(fairLaunch.address, ethers.utils.parseEther('100'));
      await fairLaunchAsBob.deposit((await bob.getAddress()), 0, ethers.utils.parseEther('100'));

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('10000'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('2500'));

      // 10. Trigger random update pool to make 1 more block mine
      await fairLaunch.massUpdatePools();

      // 11. Check pendingHusky
      // Reward per Block must now share amoung Bob and Alice (50-50)
      // Alice should has 12,500 HUSKIs (10,000 + 2,500)
      // Bob should has 2,500 HUSKIs
      // Dev get 10% tax per block (5,000*0.1 = 500/block)
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('12500'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('2500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('3000'));

      // 12. Trigger random update pool to make 1 more block mine
      await fairLaunchAsAlice.massUpdatePools();

      // 13. Check pendingHusky
      // Reward per Block must now share amoung Bob and Alice (50-50)
      // Alice should has 15,000 HUSKIs (12,500 + 2,500)
      // Bob should has 5,000 HUSKIs (2,500 + 2,500)
      // Dev get 10% tax per block (5,000*0.1 = 500/block)
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('15000'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5000'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('3500'));

      // 14. Bob harvest his yield
      // Reward per Block is till (50-50) as Bob is not leaving the pool yet
      // Alice should has 17,500 HUSKIs (15,000 + 2,500) in pending
      // Bob should has 7,500 HUSKIs (5,000 + 2,500) in his account as he harvest it
      // Dev get 10% tax per block (5,000*0.1 = 500/block)
      await fairLaunchAsBob.harvest(0);

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('4000'));

      // 15. Alice wants more HUSKIs so she deposit 300 STOKEN0 more
      await stoken0AsAlice.approve(fairLaunch.address, ethers.utils.parseEther('300'));
      await fairLaunchAsAlice.deposit((await alice.getAddress()), 0, ethers.utils.parseEther('300'));

      // Alice deposit to the same pool as she already has some STOKEN0 in it
      // Hence, Alice will get auto-harvest
      // Alice should get 22,500 HUSKIs (17,500 + 2,500 [B1] + 2,500 [B2]) back to her account
      // Hence, Alice should has 15,000 + 22,500 = 37,500 HUSKIs in her account and 0 pending as she harvested
      // Bob should has (2,500 [B1] + 2,500 [B2]) = 5,000 HUSKIs in pending
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5000'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('37500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5000'));

      // 16. Trigger random update pool to make 1 more block mine
      await fairLaunchAsAlice.massUpdatePools();

      // 1 more block is mined, now Alice shold get 80% and Bob should get 20% of rewards
      // How many STOKEN0 needed to make Alice get 80%: find n from 100n/(100n+100) = 0.8
      // Hence, Alice should get 0 + 4,000 = 4,000 HUSKIs in pending
      // Bob should get 5,000 + 1,000 = 6,000 HUSKIs in pending
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('4000'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('6000'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('37500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('5500'));

      // 17. Ayyooo people vote for the bonus period, 1 block executed
      // bonus will start to accu. on the next box
      await fairLaunchAsDeployer.setBonus(10, (await ethers.provider.getBlockNumber()) + 5, 7000);
      // Make block mined 7 times to make it pass bonusEndBlock
      for (let i = 0; i < 7; i++) {
        await stoken1AsDeployer.mint((await deployer.getAddress()), ethers.utils.parseEther('1'));
      }
      // Trigger this to mint token for dev, 1 more block mined
      await fairLaunchAsDeployer.massUpdatePools();
      // Expect pending balances
      // Each block during bonus period Alice will get 40,000 HUSKIs in pending
      // Bob will get 10,000 HUSKIs in pending
      // Total blocks mined = 9 blocks counted from setBonus executed
      // However, bonus will start to accu. on the setBonus's block + 1
      // Hence, 5 blocks during bonus period and 3 blocks are out of bonus period
      // Hence Alice will get 4,000 + (40,000 * 5) + (4,000 * 4) = 220,000 HUSKIs in pending
      // Bob will get 6,000 + (10,000*5)+(1,000*4) = 60,000 HUSKIs in pending
      // Dev will get 5,500 + (5,000*5*0.3) + (500*4) = 15,000 HUSKIs in account
      // Dev will get 0 + (5,000*5*0.7) = 17,500 HUSKIs locked in HuskyToken contract
      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('220000'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('60000'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('37500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('15000'));
      expect(await huskyToken.lockOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      // 18. Alice harvest her pending HUSKIs
      // Alice Total Pending is 220,000 HUSKIs
      // 50,000 * 5 = 200,000 HUSKIs are from bonus period
      // Hence subject to lock 200,000 * 0.7 = 140,000 will be locked
      // 200,000 - 140,000 = 60,000 HUSKIs from bonus period should be free float
      // Alice should get 37,500 + (220,000-140,000) + 4,000 = 121,500 HUSKIs
      // 1 Block is mined, hence Bob pending must be increased
      // Bob should get 60,000 + 1,000 = 61,000 HUSKIs
      // Dev should get 500 HUSKIs in the account
      await fairLaunchAsAlice.harvest(0);

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('61000'));
      expect(await huskyToken.lockOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('140000'));
      expect(await huskyToken.lockOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('121500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('7500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('15500'));
      expect(await huskyToken.lockOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      // 19. Bob harvest his pending HUSKIs
      // Bob Total Pending is 61,000 HUSKIs
      // 10,000 * 5 = 50,000 HUSKIs are from bonus period
      // Hence subject to lock 50,000 * 0.7 = 35,000 will be locked
      // 50,000 - 35,000 = 15,000 HUSKIs from bonus period should be free float
      // Bob should get 7,500 + (61,000-35,000) + 1,000 = 34,500 HUSKIs
      // 1 Block is mined, hence Bob pending must be increased
      // Alice should get 0 + 4,000 = 4,000 HUSKIs in pending
      // Dev should get 500 HUSKIs in the account
      await fairLaunchAsBob.harvest(0);

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('4000'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await huskyToken.lockOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('140000'));
      expect(await huskyToken.lockOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('35000'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('121500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('34500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('16000'));
      expect(await huskyToken.lockOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      // 20. Alice is happy. Now she want to leave the pool.
      // 2 Blocks are mined
      // Alice pending must be 0 as she harvest and leave the pool.
      // Alice should get 121,500 + 4,000 + 4,000 = 129,500 HUSKIs
      // Bob pending should be 1,000 HUSKIs
      // Dev get another 500 HUSKIs
      await fairLaunchAsAlice.withdrawAll((await alice.getAddress()), 0);

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('1000'));
      expect(await huskyToken.lockOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('140000'));
      expect(await huskyToken.lockOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('35000'));
      expect(await stakingTokens[0].balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('400'));
      expect(await stakingTokens[0].balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('129500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('34500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('16500'));
      expect(await huskyToken.lockOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      // 21. Bob is happy. Now he want to leave the pool.
      // 1 Blocks is mined
      // Alice should not move as she left the pool already
      // Bob pending should be 0 HUSKIs
      // Bob should has 34,500 + 1,000 + 5,000 = 40,500 HUSKIs in his account
      // Dev get another 500 HUSKIs
      await fairLaunchAsBob.withdrawAll((await bob.getAddress()), 0);

      expect(await fairLaunch.pendingHusky(0, (await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await fairLaunch.pendingHusky(0, (await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('0'));
      expect(await huskyToken.lockOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('140000'));
      expect(await huskyToken.lockOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('35000'));
      expect(await stakingTokens[0].balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('400'));
      expect(await stakingTokens[0].balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('100'));
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('129500'));
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('40500'));
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17000'));
      expect(await huskyToken.lockOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      // Oh hello! The locked HUSKIs will be released on the next block
      // so let's move four block to get all tokens unlocked
      for (let i = 0; i < 5; i++) {
        // random contract call to make block mined
        await stoken0AsDeployer.mint((await deployer.getAddress()), ethers.utils.parseEther('1'));
      }
      expect(await huskyToken.canUnlockAmount((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('140000'));
      expect(await huskyToken.canUnlockAmount((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('35000'));
      expect(await huskyToken.canUnlockAmount((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('17500'));

      await huskyTokenAsAlice.unlock();
      expect(await huskyToken.balanceOf((await alice.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('269500'));

      await huskyTokenAsBob.unlock();
      expect(await huskyToken.balanceOf((await bob.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('75500'));

      await huskyTokenAsDev.unlock();
      expect(await huskyToken.balanceOf((await dev.getAddress()))).to.be.bignumber.eq(ethers.utils.parseEther('34500'));
    });
  });
});
