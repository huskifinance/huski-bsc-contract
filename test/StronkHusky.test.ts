import { ethers, upgrades, waffle } from "hardhat";
import { Signer, BigNumberish, utils, Wallet, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import {
  HuskyToken,
  HuskyToken__factory,
  FairLaunch,
  FairLaunch__factory,
  DebtToken,
  DebtToken__factory,
  StronkHusky,
  StronkHusky__factory,
  StronkHuskyRelayer,
  StronkHuskyRelayer__factory
} from "../typechain";
import * as TimeHelpers from "./helpers/time"

chai.use(solidity);
const { expect } = chai;

describe("StronkHusky and StronkHuskyRelayer", () => {
  /// Constant
  const ADDRESS0 = "0x0000000000000000000000000000000000000000";
  const HUSKI_BONUS_LOCK_UP_BPS = 0;
  const HUSKI_REWARD_PER_BLOCK = ethers.utils.parseEther('5000');

  // Instance(s)
  let stronkHusky: StronkHusky;
  let stronkHuskyRelayer: StronkHuskyRelayer;
  let stronkHuskyAsAlice: StronkHusky
  let stronkHuskyAsBob: StronkHusky;
  let huskyToken: HuskyToken;
  let fairLaunch: FairLaunch;
  let debtToken: DebtToken;
  let huskyTokenAsAlice: HuskyToken;
  let huskyTokenAsBob: HuskyToken;

  // Accounts
  let deployer: Signer;
  let admin: Signer;
  let alice: Signer;
  let bob: Signer;
  let nowBlock: number;

  beforeEach(async () => {
    nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
    [deployer, admin, alice, bob] = await ethers.getSigners();
    // Deploy HUSKIs
    const HuskyToken = (await ethers.getContractFactory(
      "HuskyToken",
      deployer
    )) as HuskyToken__factory;
    huskyToken = await HuskyToken.deploy(nowBlock, nowBlock + 300);
    await huskyToken.deployed();

    huskyTokenAsAlice = HuskyToken__factory.connect(huskyToken.address, alice);
    huskyTokenAsBob = HuskyToken__factory.connect(huskyToken.address, bob);

    const FairLaunch = (await ethers.getContractFactory(
      "FairLaunch",
      deployer
    )) as FairLaunch__factory;
    fairLaunch = await FairLaunch.deploy(
      huskyToken.address, (await deployer.getAddress()), HUSKI_REWARD_PER_BLOCK, 0, HUSKI_BONUS_LOCK_UP_BPS, 0
    );
    await fairLaunch.deployed();
    await huskyToken.transferOwnership(fairLaunch.address);

    const StronkHuskyRelayer = (await ethers.getContractFactory(
      "StronkHuskyRelayer",
      deployer
    )) as StronkHuskyRelayer__factory;
    stronkHuskyRelayer = await StronkHuskyRelayer.deploy(huskyToken.address);
    await stronkHuskyRelayer.deployed();

    const DebtToken = (await ethers.getContractFactory(
      "DebtToken",
      deployer
    )) as DebtToken__factory;
    debtToken = await upgrades.deployProxy(DebtToken, [
      'debtibBTOKEN_V2', 'debtibBTOKEN_V2', (await deployer.getAddress())], 
      { unsafeAllow: ['delegatecall'] }) as DebtToken;
    await debtToken.deployed();

    const StronkHusky = (await ethers.getContractFactory(
      "StronkHusky",
      deployer
    )) as StronkHusky__factory;
    stronkHusky = await upgrades.deployProxy(StronkHusky, [
      huskyToken.address, 'Interest Bearing BTOKEN', 'ibBTOKEN', 18, 
      debtToken.address, fairLaunch.address, stronkHuskyRelayer.address
    ], { unsafeAllow: ['delegatecall'] }) as StronkHusky;
    // stronkHusky = await StronkHusky.deploy(huskyToken.address, nowBlock+50, nowBlock + 100, nowBlock + 500);
    await stronkHusky.deployed();

    // Transfer ownership to vault
    await debtToken.transferOwnership(stronkHusky.address);
    await stronkHuskyRelayer.transferOwnership(stronkHusky.address);

    // Update DebtToken
    await fairLaunch.addPool('test', 1, debtToken.address, false);
    await stronkHusky.updateDebtToken(debtToken.address, 0);
    await stronkHusky.setStronkInfo(huskyToken.address, 1, 50);
    await stronkHusky.setConfigs(5, true, 500);

    stronkHuskyAsAlice = StronkHusky__factory.connect(stronkHusky.address, alice);
    stronkHuskyAsBob = StronkHusky__factory.connect(stronkHusky.address, bob);
  });

  context('when alice and bob want to hodl StronkHusky', async () => {
    it('should be able hodl successfully with correct balances', async () => {
      const aliceAddress = await alice.getAddress()
      const bobAddress = await bob.getAddress()

      // 120 Husky to alice
      await fairLaunch.manualMint(aliceAddress, ethers.utils.parseEther('120'))

      // 50 Husky to bob
      await fairLaunch.manualMint(bobAddress, ethers.utils.parseEther('50'))

      // Alice hodl!
      await huskyTokenAsAlice.approve(stronkHuskyAsAlice.address, ethers.utils.parseEther('100'))
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('120'))
      await stronkHuskyAsAlice.hodl(ethers.utils.parseEther('100'))
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('20'))
      // expect(await stronkHusky.positionsOfOwner(aliceAddress)).length.to.be.eq(1)
      let alicePos = await stronkHusky.positions(1)
      expect(alicePos.hodlAmount).to.deep.equal(ethers.utils.parseEther('100'))

      // Bob hodl!
      await huskyTokenAsBob.approve(stronkHuskyAsBob.address, ethers.utils.parseEther('50'))
      expect(await huskyToken.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('50'))
      await stronkHuskyAsBob.hodl(ethers.utils.parseEther('50'))
      expect(await huskyToken.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('0'))
      // expect(await stronkHusky.positionsOfOwner(bobAddress)).length.to.deep.equal(1)
      let bobPos = await stronkHusky.positions(2)
      expect(bobPos.hodlAmount).to.deep.equal(ethers.utils.parseEther('50'))

      // Evaluate the final balance of stronkHusky
      expect(await stronkHusky.totalSupply()).to.deep.equal(ethers.utils.parseEther('150'))
      expect(await huskyToken.balanceOf(stronkHuskyRelayer.address)).to.deep.equal(ethers.utils.parseEther('150'))
    })
  })

  context('when alice want to claim Husky before bonusPeriodBlock', async () => {
    it('should not allow to do so when block.number is not reach bonusPeriodBlock', async () => {
      const aliceAddress = await alice.getAddress()
      // 100 Husky to alice
      await fairLaunch.manualMint(aliceAddress, ethers.utils.parseEther('100'))
      // Alice hodl!
      await huskyTokenAsAlice.approve(stronkHuskyAsAlice.address, ethers.utils.parseEther('100'))
      await stronkHuskyAsAlice.hodl(ethers.utils.parseEther('100'))
      await expect(stronkHuskyAsAlice.harvest(1))
        .to.be
        .revertedWith('StronkHusky::harvest: nothing to harvest')
    })
  })

  context('when alice want to claim Husky after bonusPeriodBlock', async () => {
    it('should allow to do so when block.number exceeds bonusPeriodBlock', async () => {
      const aliceAddress = await alice.getAddress()
      // 100 Husky to alice
      await fairLaunch.manualMint(aliceAddress, ethers.utils.parseEther('100'))
      // Alice hodl!
      await huskyTokenAsAlice.approve(stronkHuskyAsAlice.address, ethers.utils.parseEther('100'))
      await stronkHuskyAsAlice.hodl(ethers.utils.parseEther('100'))
      let positions = await stronkHusky.positionsOfOwner(aliceAddress)

      //Advance block to not be able to hodl
      nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
      await TimeHelpers.advanceBlockTo(nowBlock + 50)
      await stronkHuskyAsAlice.harvest(positions.length)
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('5'))

      nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
      await TimeHelpers.advanceBlockTo(nowBlock + 60)
      await stronkHuskyAsAlice.harvest(positions.length)
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('10'))

      nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
      await TimeHelpers.advanceBlockTo(nowBlock + 40)
      await stronkHuskyAsAlice.harvest(positions.length)
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('15'))
    })
    it(`should get double rewards when block.number exceeds bonusPeriodBlock*2`, async () => {
      const aliceAddress = await alice.getAddress()
      // 100 Husky to alice
      await fairLaunch.manualMint(aliceAddress, ethers.utils.parseEther('100'))
      // Alice hodl!
      await huskyTokenAsAlice.approve(stronkHuskyAsAlice.address, ethers.utils.parseEther('100'))
      await stronkHuskyAsAlice.hodl(ethers.utils.parseEther('100'))
      let positions = await stronkHusky.positionsOfOwner(aliceAddress)
      //Advance block to not be able to hodl
      nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
      await TimeHelpers.advanceBlockTo(nowBlock + 100)
      await stronkHuskyAsAlice.harvest(positions.length)
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('10'))
    })
  })

  context('when alice and bob wants to unhodl', async() => {
    it('should swap Strong Husky with Husky successfully after doing hodl properly', async () => {
      const aliceAddress = await alice.getAddress()
      const bobAddress = await bob.getAddress()

      // 120 Husky to alice
      await fairLaunch.manualMint(aliceAddress, ethers.utils.parseEther('120'))
      // 50 Husky to bob
      await fairLaunch.manualMint(bobAddress, ethers.utils.parseEther('50'))

      // hodl
      await huskyTokenAsAlice.approve(stronkHuskyAsAlice.address, ethers.utils.parseEther('100'))
      await stronkHuskyAsAlice.hodl(ethers.utils.parseEther('100'))
      await huskyTokenAsBob.approve(stronkHuskyAsBob.address, ethers.utils.parseEther('50'))
      await stronkHuskyAsBob.hodl(ethers.utils.parseEther('50'))

      // fast forward to the lockEndBlock
      nowBlock = (await TimeHelpers.latestBlockNumber()).toNumber();
      await TimeHelpers.advanceBlockTo(nowBlock + 50)

      // StronkHusky supply should be 150
      expect(await stronkHusky.totalSupply()).to.deep.equal(ethers.utils.parseEther('150'))

      // alice unhodl
      expect(await stronkHusky.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('100'))
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('20'))
      await stronkHuskyAsAlice.withdraw(1)
      expect(await stronkHusky.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('0'))
      expect(await huskyToken.balanceOf(aliceAddress)).to.deep.equal(ethers.utils.parseEther('125'))

      // the husky token should be (all - 100)
      expect(await huskyToken.balanceOf(stronkHuskyRelayer.address)).to.deep.equal(ethers.utils.parseEther('50'))

      // stronkHusky does not store any stronkHusky, but burn instead
      expect(await stronkHusky.balanceOf(stronkHusky.address)).to.deep.equal(ethers.utils.parseEther('0'))
      expect(await stronkHusky.totalSupply()).to.deep.equal(ethers.utils.parseEther('50'))

      // bob unhodl
      expect(await stronkHusky.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('50'))
      expect(await huskyToken.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('0'))
      // approve to be able to transfer stronkhodl
      await stronkHuskyAsBob.withdraw(2)
      expect(await stronkHusky.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('0'))
      expect(await huskyToken.balanceOf(bobAddress)).to.deep.equal(ethers.utils.parseEther('52.5'))

      // stronkHusky does not store any stronkHusky, but burn instead
      expect(await huskyToken.balanceOf(stronkHuskyRelayer.address)).to.deep.equal(ethers.utils.parseEther('0'))
      expect(await stronkHusky.balanceOf(stronkHusky.address)).to.deep.equal(ethers.utils.parseEther('0'))
      expect(await stronkHusky.totalSupply()).to.deep.equal(ethers.utils.parseEther('0'))
    })

    // it('should not allow to do so before huskyToken.endReleaseBlock', async () => {
    //   await expect(stronkHuskyAsAlice.unhodl())
    //     .to.be
    //     .revertedWith('StronkHusky::unhodl: block.number have not reach huskyToken.endReleaseBlock')
    // })

    // it('should not allow to do so before lockEndBlock', async () => {
    //   // fast forward to huskyToken.endReleaseBlock
    //   await TimeHelpers.advanceBlockTo(nowBlock + 300)
    //   await expect(stronkHuskyAsAlice.unhodl())
    //     .to.be
    //     .revertedWith('StronkHusky::unhodl: block.number have not reach lockEndBlock')
    // })
  })
})
