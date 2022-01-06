import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { 
  PancakeswapV2AddBaseTokenOnly,
  PancakeswapV2AddBaseTokenOnly__factory,
  PancakeswapV2Liquidate,
  PancakeswapV2Liquidate__factory,
  PancakeswapV2WithdrawMinimizeTrading,
  PancakeswapV2WithdrawMinimizeTrading__factory,
  PancakeswapV2PartialCloseLiquidate,
  PancakeswapV2PartialCloseLiquidate__factory,
  PancakeswapV2PartialCloseMinimizeTrading,
  PancakeswapV2PartialCloseMinimizeTrading__factory,
  WNativeRelayer__factory
 } from '../../typechain';

 import MainnetConfig from '../results/mainnet.json'
 import TestnetConfig from '../results/testnet.json'
 
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network  } = hre;
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
    /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */
  const ROUTER_V2 = config.Exchanges.Pancakeswap.RouterV2;
  const WBNB = config.Tokens.WBNB;
  const WNATIVE_RELAYER = config.SharedConfig.WNativeRelayer;

  // const ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  // const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  // const WNATIVE_RELAYER = '0xE1D2CA01bc88F325fF7266DD2165944f3CAf0D3D';
  // const WHITELIST_WOKERS = []




  /**
   * Restricted StrategyAddBaseTokenOnly V2
   */
  console.log(">> Deploying an upgradable Restricted StrategyAddBaseTokenOnly V2 contract");
  const PancakeswapV2AddBaseTokenOnly = (await ethers.getContractFactory(
    "PancakeswapV2AddBaseTokenOnly",
    (await ethers.getSigners())[0],
  )) as PancakeswapV2AddBaseTokenOnly__factory;
  const strategyRestrictedAddBaseTokenOnlyV2 = await upgrades.deployProxy(
    PancakeswapV2AddBaseTokenOnly, 
    [ROUTER_V2], 
    { unsafeAllow: ['delegatecall'] }) as PancakeswapV2AddBaseTokenOnly;
  await strategyRestrictedAddBaseTokenOnlyV2.deployed()
  console.log(`>> Deployed at ${strategyRestrictedAddBaseTokenOnlyV2.address}`);
  console.log("✅ Done")

  // if(WHITELIST_WOKERS.length > 0) {
  //   console.log(">> Whitelisting workers for strategyRestrictedAddBaseTokenOnlyV2")
  //   await strategyRestrictedAddBaseTokenOnlyV2.setWorkersOk(WHITELIST_WOKERS, true)
  //   console.log("✅ Done")
  // }
  
  /**
   * Restricted StrategyLiquidate V2
   */
  console.log(">> Deploying an upgradable Restricted StrategyLiquidate V2 contract");
  const PancakeswapV2Liquidate = (await ethers.getContractFactory(
    "PancakeswapV2Liquidate",
    (await ethers.getSigners())[0],
  )) as PancakeswapV2Liquidate__factory;
  const strategyRestrictedLiquidateV2 = await upgrades.deployProxy(
    PancakeswapV2Liquidate, 
    [ROUTER_V2], { unsafeAllow: ['delegatecall'] }) as PancakeswapV2Liquidate;
  await strategyRestrictedLiquidateV2.deployed();
  console.log(`>> Deployed at ${strategyRestrictedLiquidateV2.address}`);
  console.log("✅ Done")

  // if(WHITELIST_WOKERS.length > 0) {
  //   console.log(">> Whitelisting workers for strategyRestrictedLiquidateV2")
  //   await strategyRestrictedLiquidateV2.setWorkersOk(WHITELIST_WOKERS, true)
  //   console.log("✅ Done")
  // }

  /**
   * Restricted StrategyWithdrawMinimizeTrading V2
   */
  console.log(">> Deploying an upgradable Restricted StrategyWithdrawMinimizeTrading V2 contract");
  const PancakeswapV2WithdrawMinimizeTrading = (await ethers.getContractFactory(
    "PancakeswapV2WithdrawMinimizeTrading",
    (await ethers.getSigners())[0],
  )) as PancakeswapV2WithdrawMinimizeTrading__factory;
  const strategyRestrictedWithdrawMinimizeTradingV2 = await upgrades.deployProxy(
    PancakeswapV2WithdrawMinimizeTrading, 
    [ROUTER_V2, WBNB, WNATIVE_RELAYER], 
    { unsafeAllow: ['delegatecall'] }) as PancakeswapV2WithdrawMinimizeTrading;
  await strategyRestrictedWithdrawMinimizeTradingV2.deployed()
  console.log(`>> Deployed at ${strategyRestrictedWithdrawMinimizeTradingV2.address}`);

  // if(WHITELIST_WOKERS.length > 0) {
  //   console.log(">> Whitelisting workers for strategyRestrictedWithdrawMinimizeTradingV2")
  //   await strategyRestrictedWithdrawMinimizeTradingV2.setWorkersOk(WHITELIST_WOKERS, true)
  //   console.log("✅ Done")
  // }

  console.log(">> Whitelist RestrictedStrategyWithdrawMinimizeTrading V2 on WNativeRelayer");
  const wNativeRelayer = WNativeRelayer__factory.connect(WNATIVE_RELAYER, (await ethers.getSigners())[0]);
  await wNativeRelayer.setCallerOk([strategyRestrictedWithdrawMinimizeTradingV2.address], true);
  console.log("✅ Done")

  /**
     * Restricted StrategyPartialCloseLiquidate V2
     */
   console.log(">> Deploying an upgradable Restricted StrategyPartialCloseLiquidate V2 contract");
   const PancakeswapV2PartialCloseLiquidate = (await ethers.getContractFactory(
     "PancakeswapV2PartialCloseLiquidate",
     (
       await ethers.getSigners()
     )[0]
   )) as PancakeswapV2PartialCloseLiquidate__factory;
   const restrictedStrategyPartialCloseLiquidate = (await upgrades.deployProxy(
    PancakeswapV2PartialCloseLiquidate,
     [config.Exchanges.Pancakeswap.RouterV2]
   )) as PancakeswapV2PartialCloseLiquidate;
   await restrictedStrategyPartialCloseLiquidate.deployed();
   console.log(`>> Deployed at ${restrictedStrategyPartialCloseLiquidate.address}`);
   console.log("✅ Done");

  //  console.log(">> Whitelisting workers for strategyRestrictedLiquidateV2");
  //  await restrictedStrategyPartialCloseLiquidate.setWorkersOk(whitelistedWorkerAddrs, true);
  //  console.log("✅ Done");

  /**
     * Restricted StrategyPartialCloseMinimizeTrading V2
     */
   console.log(">> Deploying an upgradable Restricted StrategyPartialCloseMinimizeTrading V2 contract");
   const PancakeswapV2PartialCloseMinimizeTrading = (await ethers.getContractFactory(
     "PancakeswapV2PartialCloseMinimizeTrading",
     (
       await ethers.getSigners()
     )[0]
   )) as PancakeswapV2PartialCloseMinimizeTrading__factory;
   const strategyRestrictedPartialCloseMinimizeTrading = (await upgrades.deployProxy(
    PancakeswapV2PartialCloseMinimizeTrading,
     [config.Exchanges.Pancakeswap.RouterV2, config.Tokens.WBNB, config.SharedConfig.WNativeRelayer]
   )) as PancakeswapV2PartialCloseMinimizeTrading;
   await strategyRestrictedPartialCloseMinimizeTrading.deployed();
   console.log(`>> Deployed at ${strategyRestrictedPartialCloseMinimizeTrading.address}`);

  //  console.log(">> Whitelisting workers for strategyRestrictedPartialCloseMinimizeTrading");
  //  await strategyRestrictedPartialCloseMinimizeTrading.setWorkersOk(whitelistedWorkerAddrs, true);
  //  console.log("✅ Done");

   console.log(">> Whitelist strategyRestrictedPartialCloseMinimizeTrading V2 on WNativeRelayer");
   await wNativeRelayer.setCallerOk([strategyRestrictedPartialCloseMinimizeTrading.address], true);
   console.log("✅ Done");

  console.log(">> Write SharedStrategies to config");
  config.SharedStrategies.StrategyAddBaseTokenOnly = strategyRestrictedAddBaseTokenOnlyV2.address;
  config.SharedStrategies.StrategyLiquidate = strategyRestrictedLiquidateV2.address;
  config.SharedStrategies.StrategyWithdrawMinimizeTrading = strategyRestrictedWithdrawMinimizeTradingV2.address;
  config.SharedStrategies.StrategyPartialCloseLiquidate = restrictedStrategyPartialCloseLiquidate.address;
  config.SharedStrategies.StrategyPartialCloseMinimizeTrading = strategyRestrictedPartialCloseMinimizeTrading.address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['ShareRestrictedStrategiesV2'];