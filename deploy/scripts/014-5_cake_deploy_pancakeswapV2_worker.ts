import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import {
  PancakeswapV2AddBaseTokenOnly__factory,
  PancakeswapV2Liquidate__factory,
  PancakeswapV2Worker,
  PancakeswapV2Worker__factory,
  Timelock__factory,
  WorkerConfig__factory,
  BasicVaultConfig__factory
} from '../../typechain';

import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network } = hre;
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  /*
░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
Check all variables below before execute the deployment script
Must first create a trading pair, Smart contract will check LPToken
*/
  const vaultIndex = 5;
  const WORKERS = [
    {
      WORKER_NAME: 'BNB-CAKE Worker',
      POOL_ID: 21,
      REINVEST_BOUNTY_BPS: '200',
      WORK_FACTOR: '7000',
      KILL_FACTOR: '8000',
      MAX_PRICE_DIFF: '11000',
      
      REINVEST_BOT: config.AdminAddress,
      BASE_TOKEN_ADDR: config.Tokens.CAKE,
      VAULT_CONFIG_ADDR: config.Vaults[vaultIndex].config,
      WORKER_CONFIG_ADDR: config.SharedConfig.WorkerConfig,
      VAULT_ADDR: config.Vaults[vaultIndex].address,
      MASTER_CHEF_ADDR: config.Exchanges.Pancakeswap.MasterChef,
      PANCAKESWAP_ROUTER_ADDR: config.Exchanges.Pancakeswap.RouterV2,
      ADD_STRAT_ADDR: config.SharedStrategies.StrategyAddBaseTokenOnly,
      LIQ_STRAT_ADDR: config.SharedStrategies.StrategyLiquidate,
      // TIMELOCK: '0x2D5408f2287BF9F9B05404794459a846651D0a59',
      // EXACT_ETA: '1622199600',
      STRATS: [
        config.SharedStrategies.StrategyPartialCloseLiquidate,
        config.SharedStrategies.StrategyPartialCloseMinimizeTrading,
        config.SharedStrategies.StrategyWithdrawMinimizeTrading,
        config.Vaults[vaultIndex].StrategyAddTwoSidesOptimal
      ]
    },
    {
      WORKER_NAME: 'USDT-CAKE Worker',
      POOL_ID: 57,
      REINVEST_BOUNTY_BPS: '200',
      WORK_FACTOR: '7000',
      KILL_FACTOR: '8000',
      MAX_PRICE_DIFF: '11000',
      
      REINVEST_BOT: config.AdminAddress,
      BASE_TOKEN_ADDR: config.Tokens.CAKE,
      VAULT_CONFIG_ADDR: config.Vaults[vaultIndex].config,
      WORKER_CONFIG_ADDR: config.SharedConfig.WorkerConfig,
      VAULT_ADDR: config.Vaults[vaultIndex].address,
      MASTER_CHEF_ADDR: config.Exchanges.Pancakeswap.MasterChef,
      PANCAKESWAP_ROUTER_ADDR: config.Exchanges.Pancakeswap.RouterV2,
      ADD_STRAT_ADDR: config.SharedStrategies.StrategyAddBaseTokenOnly,
      LIQ_STRAT_ADDR: config.SharedStrategies.StrategyLiquidate,
      // TIMELOCK: '0x2D5408f2287BF9F9B05404794459a846651D0a59',
      // EXACT_ETA: '1622199600',
      STRATS: [
        config.SharedStrategies.StrategyPartialCloseLiquidate,
        config.SharedStrategies.StrategyPartialCloseMinimizeTrading,
        config.SharedStrategies.StrategyWithdrawMinimizeTrading,
        config.Vaults[vaultIndex].StrategyAddTwoSidesOptimal
      ]
    },
    {
      WORKER_NAME: 'BUSD-CAKE Worker',
      POOL_ID: 49,
      REINVEST_BOUNTY_BPS: '200',
      WORK_FACTOR: '7000',
      KILL_FACTOR: '8000',
      MAX_PRICE_DIFF: '11000',
      
      REINVEST_BOT: config.AdminAddress,
      BASE_TOKEN_ADDR: config.Tokens.CAKE,
      VAULT_CONFIG_ADDR: config.Vaults[vaultIndex].config,
      WORKER_CONFIG_ADDR: config.SharedConfig.WorkerConfig,
      VAULT_ADDR: config.Vaults[vaultIndex].address,
      MASTER_CHEF_ADDR: config.Exchanges.Pancakeswap.MasterChef,
      PANCAKESWAP_ROUTER_ADDR: config.Exchanges.Pancakeswap.RouterV2,
      ADD_STRAT_ADDR: config.SharedStrategies.StrategyAddBaseTokenOnly,
      LIQ_STRAT_ADDR: config.SharedStrategies.StrategyLiquidate,
      // TIMELOCK: '0x2D5408f2287BF9F9B05404794459a846651D0a59',
      // EXACT_ETA: '1622199600',
      STRATS: [
        config.SharedStrategies.StrategyPartialCloseLiquidate,
        config.SharedStrategies.StrategyPartialCloseMinimizeTrading,
        config.SharedStrategies.StrategyWithdrawMinimizeTrading,
        config.Vaults[vaultIndex].StrategyAddTwoSidesOptimal
      ]
    }
  ]




  for (let i = 0; i < WORKERS.length; i++) {
    console.log("===================================================================================")
    console.log(`>> Deploying an upgradable PancakeswapV2Worker contract for ${WORKERS[i].WORKER_NAME}`);
    const PancakeswapV2Worker = (await ethers.getContractFactory(
      'PancakeswapV2Worker',
      (await ethers.getSigners())[0]
    )) as PancakeswapV2Worker__factory;

    console.log("WORKER_NAME", WORKERS[i].WORKER_NAME)
    console.log("VAULT_ADDR", WORKERS[i].VAULT_ADDR)
    console.log("BASE_TOKEN_ADDR", WORKERS[i].BASE_TOKEN_ADDR)
    console.log("MASTER_CHEF_ADDR", WORKERS[i].MASTER_CHEF_ADDR)
    console.log("PANCAKESWAP_ROUTER_ADDR", WORKERS[i].PANCAKESWAP_ROUTER_ADDR)
    console.log("POOL_ID", WORKERS[i].POOL_ID)
    console.log("ADD_STRAT_ADDR", WORKERS[i].ADD_STRAT_ADDR)
    console.log("LIQ_STRAT_ADDR", WORKERS[i].LIQ_STRAT_ADDR)
    console.log("REINVEST_BOUNTY_BPS", WORKERS[i].REINVEST_BOUNTY_BPS)
    const pancakeswapV2Worker = await upgrades.deployProxy(
      PancakeswapV2Worker, [
      WORKERS[i].VAULT_ADDR, WORKERS[i].BASE_TOKEN_ADDR, WORKERS[i].MASTER_CHEF_ADDR,
      WORKERS[i].PANCAKESWAP_ROUTER_ADDR, WORKERS[i].POOL_ID, WORKERS[i].ADD_STRAT_ADDR,
      WORKERS[i].LIQ_STRAT_ADDR, WORKERS[i].REINVEST_BOUNTY_BPS
    ], { unsafeAllow: ['delegatecall'] }) as PancakeswapV2Worker;

    await pancakeswapV2Worker.deployed();
    console.log(`>> Deployed at ${pancakeswapV2Worker.address}`);
    let worker = {
      name: WORKERS[i].WORKER_NAME,
      address: pancakeswapV2Worker.address,
      config: WORKERS[i].WORKER_CONFIG_ADDR,
      pId: WORKERS[i].POOL_ID,
    }
    config.Vaults[vaultIndex].workers.push(worker as never)
    
    console.log(">> Write workers to config");
    FileService.write(network.name, config);
    console.log("✅ Done");

    console.log(`>> Adding REINVEST_BOT`);
    await pancakeswapV2Worker.setReinvestorOk([WORKERS[i].REINVEST_BOT], true);
    console.log("✅ Done");

    console.log(`>> Adding Strategies`);
    await pancakeswapV2Worker.setStrategyOk(WORKERS[i].STRATS, true);
    console.log("✅ Done");

    console.log(`>> Whitelisting a worker on strats`);
    const addStrat = PancakeswapV2AddBaseTokenOnly__factory.connect(WORKERS[i].ADD_STRAT_ADDR, (await ethers.getSigners())[0])
    await addStrat.setWorkersOk([pancakeswapV2Worker.address], true)
    console.log(`>> addStrat ✅ Done`);
    const liqStrat = PancakeswapV2Liquidate__factory.connect(WORKERS[i].LIQ_STRAT_ADDR, (await ethers.getSigners())[0])
    await liqStrat.setWorkersOk([pancakeswapV2Worker.address], true)
    console.log(`>> liqStrat ✅ Done`);
    for (let j = 0; j < WORKERS[i].STRATS.length; j++) {
      const strat = PancakeswapV2AddBaseTokenOnly__factory.connect(WORKERS[i].STRATS[j], (await ethers.getSigners())[0])
      await strat.setWorkersOk([pancakeswapV2Worker.address], true)
      console.log(`>> ✅ Done `, j);
    }
    console.log("✅ Done");

    const workerconfig = WorkerConfig__factory.connect(WORKERS[i].WORKER_CONFIG_ADDR, (await ethers.getSigners())[0]);

    console.log(">> WorkerConfig: Setting WorkerConfig via Timelock");
    const setConfigsTx = await workerconfig.setConfigs([pancakeswapV2Worker.address], [{ acceptDebt: true, workFactor: WORKERS[i].WORK_FACTOR, killFactor: WORKERS[i].KILL_FACTOR, maxPriceDiff: WORKERS[i].MAX_PRICE_DIFF }]);
    console.log(`queue setConfigs at: ${setConfigsTx.hash}`)
    console.log("✅ Done");

    console.log(">> WorkerConfig: Linking VaultConfig with WorkerConfig");
    const vaultconfig = BasicVaultConfig__factory.connect(WORKERS[i].VAULT_CONFIG_ADDR, (await ethers.getSigners())[0]);
    const setWorkersTx = await vaultconfig.setWorkers([pancakeswapV2Worker.address], [WORKERS[i].WORKER_CONFIG_ADDR]);
    console.log(`queue setWorkers at: ${setWorkersTx.hash}`);
    console.log("✅ Done");

    // const timelock = Timelock__factory.connect(WORKERS[i].TIMELOCK, (await ethers.getSigners())[0]);

    // console.log(">> Timelock: Setting WorkerConfig via Timelock");
    // const setConfigsTx = await timelock.queueTransaction(
    //   WORKERS[i].WORKER_CONFIG_ADDR, '0',
    //   'setConfigs(address[],(bool,uint64,uint64,uint64)[])',
    //   ethers.utils.defaultAbiCoder.encode(
    //     ['address[]','(bool acceptDebt,uint64 workFactor,uint64 killFactor,uint64 maxPriceDiff)[]'],
    //     [
    //       [pancakeswapV2Worker.address], [{acceptDebt: true, workFactor: WORKERS[i].WORK_FACTOR, killFactor: WORKERS[i].KILL_FACTOR, maxPriceDiff: WORKERS[i].MAX_PRICE_DIFF}]
    //     ]
    //   ), WORKERS[i].EXACT_ETA
    // );
    // console.log(`queue setConfigs at: ${setConfigsTx.hash}`)
    // console.log("generate timelock.executeTransaction:")
    // console.log(`await timelock.executeTransaction('${WORKERS[i].WORKER_CONFIG_ADDR}', '0', 'setConfigs(address[],(bool,uint64,uint64,uint64)[])', ethers.utils.defaultAbiCoder.encode(['address[]','(bool acceptDebt,uint64 workFactor,uint64 killFactor,uint64 maxPriceDiff)[]'],[['${pancakeswapV2Worker.address}'], [{acceptDebt: true, workFactor: ${WORKERS[i].WORK_FACTOR}, killFactor: ${WORKERS[i].KILL_FACTOR}, maxPriceDiff: ${WORKERS[i].MAX_PRICE_DIFF}}]]), ${WORKERS[i].EXACT_ETA})`)
    // console.log("✅ Done");

    // console.log(">> Timelock: Linking VaultConfig with WorkerConfig via Timelock");
    // const setWorkersTx = await timelock.queueTransaction(
    //   WORKERS[i].VAULT_CONFIG_ADDR, '0',
    //   'setWorkers(address[],address[])',
    //   ethers.utils.defaultAbiCoder.encode(
    //     ['address[]','address[]'],
    //     [
    //       [pancakeswapV2Worker.address], [WORKERS[i].WORKER_CONFIG_ADDR]
    //     ]
    //   ), WORKERS[i].EXACT_ETA
    // );
    // console.log(`queue setWorkers at: ${setWorkersTx.hash}`)
    // console.log("generate timelock.executeTransaction:")
    // console.log(`await timelock.executeTransaction('${WORKERS[i].VAULT_CONFIG_ADDR}', '0','setWorkers(address[],address[])', ethers.utils.defaultAbiCoder.encode(['address[]','address[]'],[['${pancakeswapV2Worker.address}'], ['${WORKERS[i].WORKER_CONFIG_ADDR}']]), ${WORKERS[i].EXACT_ETA})`)
    // console.log("✅ Done");

  }

};

export default func;
func.tags = ['PancakeswapV2WorkersCAKE'];