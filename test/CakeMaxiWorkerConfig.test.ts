import { ethers, upgrades, waffle } from "hardhat";
import { Signer, BigNumberish, utils, Wallet, BigNumber } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import {
  MockERC20,
  MockERC20__factory,
  PancakeFactory,
  PancakeFactory__factory,
  PancakeRouterV2__factory,
  PancakeRouterV2,
  MockVaultForRestrictedCakeMaxiAddBaseWithFarm,
  MockVaultForRestrictedCakeMaxiAddBaseWithFarm__factory,
  WETH,
  WETH__factory,
  CakeToken,
  CakeToken__factory,
  CakeMaxiWorkerConfig,
  CakeMaxiWorkerConfig__factory,
  SimplePriceOracle,
  SimplePriceOracle__factory,
  MockPancakeswapV2CakeMaxiWorker,
  MockPancakeswapV2CakeMaxiWorker__factory,
} from "../typechain";
import * as TimeHelpers from "./helpers/time"
import * as Assert from "./helpers/assert"

chai.use(solidity);
const { expect } = chai;

describe('CakeMaxiWorker', () => {
  const FOREVER = '2000000000';

  /// PancakeswapV2-related instance(s)
  let factoryV2: PancakeFactory;
  let routerV2: PancakeRouterV2;

  /// Token-related instance(s)
  let wbnb: WETH
  let baseToken: MockERC20;
  let cake: CakeToken;

  // Accounts
  let deployer: Signer;
  let alice: Signer;
  let bob: Signer;
  let eve: Signer;

  // Workers
  let cakeMaxiWorkerNative: MockPancakeswapV2CakeMaxiWorker
  let cakeMaxiWorkerNonNative: MockPancakeswapV2CakeMaxiWorker

  // Vault
  let mockedVault: MockVaultForRestrictedCakeMaxiAddBaseWithFarm

  // Contract Signer
  let baseTokenAsAlice: MockERC20;

  let cakeAsAlice: MockERC20;

  let wbnbTokenAsAlice: WETH;
  let wbnbTokenAsBob: WETH;

  let routerV2AsAlice: PancakeRouterV2;
  let simplePriceOracleAsAlice: SimplePriceOracle;
  let cakeMaxiWorkerConfigAsAlice: CakeMaxiWorkerConfig;
  let cakeMaxiWorkerConfig: CakeMaxiWorkerConfig

  /// SimpleOracle-related instance(s)
  let simplePriceOracle: SimplePriceOracle;
  let lpPriceBaseBnb: BigNumber
  let lpPriceFarmBNB: BigNumber
  let lpPriceBNBFarm: BigNumber
  let lpPriceBNBBase: BigNumber

  beforeEach(async () => {
    [deployer, alice, bob, eve] = await ethers.getSigners();
     /// Deploy SimpleOracle
     const SimplePriceOracle = (await ethers.getContractFactory(
        'SimplePriceOracle',
        deployer
      )) as SimplePriceOracle__factory;
      simplePriceOracle = await upgrades.deployProxy(SimplePriceOracle, 
        [await alice.getAddress()], { unsafeAllow: ['delegatecall'] }) as SimplePriceOracle;
      await simplePriceOracle.deployed();

    // Setup Vault
    const MockVault =  (await ethers.getContractFactory(
        "MockVaultForRestrictedCakeMaxiAddBaseWithFarm",
        deployer
      )) as MockVaultForRestrictedCakeMaxiAddBaseWithFarm__factory;
    mockedVault = await upgrades.deployProxy(MockVault, { unsafeAllow: ['delegatecall'] }) as MockVaultForRestrictedCakeMaxiAddBaseWithFarm;
    await mockedVault.deployed();

    await mockedVault.setMockOwner(await alice.getAddress())
    // Setup Pancakeswap
    const PancakeFactory = (await ethers.getContractFactory(
      "PancakeFactory",
      deployer
    )) as PancakeFactory__factory;
    factoryV2 = await PancakeFactory.deploy((await deployer.getAddress()));
    await factoryV2.deployed();

    const WBNB = (await ethers.getContractFactory(
      "WETH",
      deployer
    )) as WETH__factory;
    wbnb = await WBNB.deploy();
    await wbnb.deployed()
    
    const PancakeRouterV2 = (await ethers.getContractFactory(
      "PancakeRouterV2",
      deployer
    )) as PancakeRouterV2__factory;
    routerV2 = await PancakeRouterV2.deploy(factoryV2.address, wbnb.address);
    await routerV2.deployed();

    /// Deploy WorkerConfig
    const WorkerConfig = (await ethers.getContractFactory(
      'CakeMaxiWorkerConfig',
      deployer
    )) as CakeMaxiWorkerConfig__factory;
    cakeMaxiWorkerConfig = await upgrades.deployProxy(WorkerConfig, 
      [simplePriceOracle.address, routerV2.address], { unsafeAllow: ['delegatecall'] }) as CakeMaxiWorkerConfig;
    await cakeMaxiWorkerConfig.deployed();

    /// Setup token stuffs
    const MockERC20 = (await ethers.getContractFactory(
      "MockERC20",
      deployer
    )) as MockERC20__factory
    baseToken = await upgrades.deployProxy(MockERC20, ['BTOKEN', 'BTOKEN'], { unsafeAllow: ['delegatecall'] }) as MockERC20;
    await baseToken.deployed();
    await baseToken.mint(await alice.getAddress(), ethers.utils.parseEther('100'));
    await baseToken.mint(await bob.getAddress(), ethers.utils.parseEther('100'));
    const CakeToken = (await ethers.getContractFactory(
        "CakeToken",
        deployer
    )) as CakeToken__factory;
    cake = await CakeToken.deploy();
    await cake.deployed()
    await cake["mint(address,uint256)"](await deployer.getAddress(), ethers.utils.parseEther('100'));
    await cake["mint(address,uint256)"](await alice.getAddress(), ethers.utils.parseEther('10'));
    await cake["mint(address,uint256)"](await bob.getAddress(), ethers.utils.parseEther('10'));
    await factoryV2.createPair(baseToken.address, wbnb.address);
    await factoryV2.createPair(cake.address, wbnb.address);

    /// Setup Cake Maxi Worker
    const CakeMaxiWorker = (await ethers.getContractFactory(
      "MockPancakeswapV2CakeMaxiWorker",
      deployer,
    )) as MockPancakeswapV2CakeMaxiWorker__factory;
    cakeMaxiWorkerNative = await CakeMaxiWorker.deploy(wbnb.address, cake.address) as MockPancakeswapV2CakeMaxiWorker
    await cakeMaxiWorkerNative.deployed();
    cakeMaxiWorkerNonNative = await CakeMaxiWorker.deploy(baseToken.address, cake.address) as MockPancakeswapV2CakeMaxiWorker
    await cakeMaxiWorkerNonNative.deployed();
    

    // Assign contract signer
    baseTokenAsAlice = MockERC20__factory.connect(baseToken.address, alice);
    cakeAsAlice = MockERC20__factory.connect(cake.address, alice);
    wbnbTokenAsAlice = WETH__factory.connect(wbnb.address, alice)
    wbnbTokenAsBob = WETH__factory.connect(wbnb.address, bob)
    routerV2AsAlice = PancakeRouterV2__factory.connect(routerV2.address, alice);
    cakeMaxiWorkerConfigAsAlice = CakeMaxiWorkerConfig__factory.connect(cakeMaxiWorkerConfig.address, alice);
    simplePriceOracleAsAlice = SimplePriceOracle__factory.connect(simplePriceOracle.address, alice);
    await simplePriceOracle.setFeeder(await alice.getAddress())
    
    // Adding liquidity to the pool
    // Alice adds 0.1 FTOKEN + 1 WBTC + 1 WBNB
    await wbnbTokenAsAlice.deposit({
        value: ethers.utils.parseEther('52')
    })
    await wbnbTokenAsBob.deposit({
        value: ethers.utils.parseEther('50')
    })
    await cakeAsAlice.approve(routerV2.address, ethers.utils.parseEther('0.1'));
    await baseTokenAsAlice.approve(routerV2.address, ethers.utils.parseEther('1'));
    await wbnbTokenAsAlice.approve(routerV2.address, ethers.utils.parseEther('11'))
    // Add liquidity to the WBTC-WBNB pool on Pancakeswap
    await routerV2AsAlice.addLiquidity(
      baseToken.address, wbnb.address,
      ethers.utils.parseEther('1'), ethers.utils.parseEther('10'), '0', '0', await alice.getAddress(), FOREVER);
      // Add liquidity to the WBNB-FTOKEN pool on Pancakeswap
    await routerV2AsAlice.addLiquidity(
        cake.address, wbnb.address,
        ethers.utils.parseEther('0.1'), 
        ethers.utils.parseEther('1'), 
        '0', 
        '0', 
        await alice.getAddress(), 
        FOREVER
    );
    lpPriceBaseBnb = ethers.utils.parseEther('10').mul(ethers.utils.parseEther('1')).div(ethers.utils.parseEther('1'))
    lpPriceBNBBase = ethers.utils.parseEther('1').mul(ethers.utils.parseEther('1')).div(ethers.utils.parseEther('10'))
    lpPriceFarmBNB = ethers.utils.parseEther('1').mul(ethers.utils.parseEther('1')).div(ethers.utils.parseEther('0.1'))
    lpPriceBNBFarm = ethers.utils.parseEther('0.1').mul(ethers.utils.parseEther('1')).div(ethers.utils.parseEther('1'))
    await cakeMaxiWorkerConfig.setConfigs(
      [
        cakeMaxiWorkerNative.address, 
        cakeMaxiWorkerNonNative.address
      ], 
      [
        { acceptDebt: true, workFactor: 1, killFactor: 1, maxPriceDiff: 11000},
        { acceptDebt: true, workFactor: 1, killFactor: 1, maxPriceDiff: 11000}
      ]
    )
  });

  describe("#isStable()", async () => {
    context("When the baseToken is not a wrap native", async () => {
      context("When the oracle hasn't updated any prices", async () => {
        it('should be reverted', async () => {
          await simplePriceOracleAsAlice.setPrices([wbnb.address, cake.address, baseToken.address, wbnb.address],[baseToken.address, wbnb.address, wbnb.address, cake.address],[1, 1, 1, 1])
          await TimeHelpers.increase(BigNumber.from('86401')) // 1 day and 1 second have passed
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too stale')
        })
      })
      context("When the price on PCS is higher than oracle price with 10% threshold", async() => {
        it('should be reverted', async() => {
          // feed the price with price too low on the first hop
          await simplePriceOracleAsAlice.setPrices([cake.address, wbnb.address],[wbnb.address, cake.address], [lpPriceFarmBNB.mul(10000).div(11001), lpPriceBNBFarm.mul(10000).div(11001)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too high')
          // when price from oracle and PCS is within the range, but price from oracle is lower than the price on PCS on the second hop
          await simplePriceOracleAsAlice.setPrices([cake.address, wbnb.address, baseToken.address, wbnb.address], [wbnb.address, cake.address, wbnb.address, baseToken.address], [lpPriceFarmBNB, lpPriceBNBFarm, lpPriceBaseBnb.mul(10000).div(11001), lpPriceBNBBase.mul(10000).div(11001)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too high')
        })
      })

      context("When the price on PCS is lower than oracle price with 10% threshold", async() => {
        it('should be reverted', async() => {
          // feed the price with price too low on the first hop
          await simplePriceOracleAsAlice.setPrices([cake.address, wbnb.address],[wbnb.address, cake.address],[lpPriceFarmBNB.mul(11001).div(10000), lpPriceBNBFarm.mul(11001).div(10000)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too low')
          // when price from oracle and PCS is within the range, but price from oracle is higher than the price on PCS on the second hop
          await simplePriceOracleAsAlice.setPrices([cake.address, wbnb.address, baseToken.address, wbnb.address], [wbnb.address, cake.address, wbnb.address, baseToken.address], [lpPriceFarmBNB, lpPriceBNBFarm, lpPriceBaseBnb.mul(11001).div(10000), lpPriceBNBBase.mul(11001).div(10000)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too low')
        })
      })

      context("when price is stable", async () => {
        it('should return true', async () => {
           // feed the correct price on both hops
           await simplePriceOracleAsAlice.setPrices([cake.address, wbnb.address, baseToken.address, wbnb.address], [wbnb.address, cake.address, wbnb.address, baseToken.address], [lpPriceFarmBNB, lpPriceBNBFarm, lpPriceBaseBnb, lpPriceBNBBase])
           const isStable = await cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNonNative.address)
           expect(isStable).to.true
        })
      })
    })

    context("When the baseToken is a wrap native", async () => {
      context("When the oracle hasn't updated any prices", async () => {
        it('should be reverted', async () => {
          await simplePriceOracleAsAlice.setPrices([wbnb.address, cake.address],[cake.address, wbnb.address],[1, 1])
          await TimeHelpers.increase(BigNumber.from('86401')) // 1 day and 1 second have passed
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too stale')
        })
      })
      context("When price is too high", async() => {
        it('should be reverted', async() => {
          // feed the price with price too low on the first hop
          await simplePriceOracleAsAlice.setPrices([wbnb.address, cake.address],[cake.address, wbnb.address], [lpPriceBNBFarm.mul(10000).div(11001), lpPriceFarmBNB.mul(10000).div(11001)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too high')
        })
      })

      context("When price is too low", async() => {
        it('should be reverted', async() => {
          // feed the price with price too low on the first hop
          await simplePriceOracleAsAlice.setPrices([wbnb.address, cake.address],[cake.address, wbnb.address],[lpPriceBNBFarm.mul(11001).div(10000), lpPriceFarmBNB.mul(11001).div(10000)])
          await expect(cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNative.address)).to.revertedWith('CakeMaxiWorkerConfig::isStable: price too low')
        })
      })

      context("when price is stable", async () => {
        it('should return true', async () => {
          // feed the price with price too low on the first hop
          await simplePriceOracleAsAlice.setPrices([wbnb.address, cake.address],[cake.address, wbnb.address],[lpPriceBNBFarm, lpPriceFarmBNB])
          const isStable = await cakeMaxiWorkerConfigAsAlice.isStable(cakeMaxiWorkerNative.address)
          expect(isStable).to.true
        })
      })
    })
  })
})
