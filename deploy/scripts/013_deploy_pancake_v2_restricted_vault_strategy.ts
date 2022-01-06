import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import {
  PancakeswapV2AddTwoSidesOptimal,
  PancakeswapV2AddTwoSidesOptimal__factory } from '../../typechain';

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
  const NEW_PARAMS = [{
    VAULT_ADDR: config.Vaults[0].address,
    ROUTER: config.Exchanges.Pancakeswap.RouterV2,
    WHITELIST_WORKER: []
  }]
  
  // const NEW_PARAMS = [{
  //   VAULT_ADDR: '0x08FC9Ba2cAc74742177e0afC3dC8Aed6961c24e7',
  //   ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  //   WHITELIST_WORKER: []
  // }]



  for(let i = 3; i < config.Vaults.length; i++ ) {
    // for(let i = 2; i < 3; i++ ) {
    console.log(">> Deploying an upgradable Restricted StrategyAddTwoSidesOptimalV2 contract");
    const StrategyRestrictedAddTwoSidesOptimal = (await ethers.getContractFactory(
      'PancakeswapV2AddTwoSidesOptimal',
      (await ethers.getSigners())[0]
    )) as PancakeswapV2AddTwoSidesOptimal__factory;
    const strategyRestrictedAddTwoSidesOptimal = await upgrades.deployProxy(
      StrategyRestrictedAddTwoSidesOptimal,
      [config.Exchanges.Pancakeswap.RouterV2, config.Vaults[i].address], 
      { unsafeAllow: ['delegatecall'] }
    ) as PancakeswapV2AddTwoSidesOptimal;
    await strategyRestrictedAddTwoSidesOptimal.deployed();
    console.log(`>> Deployed at ${strategyRestrictedAddTwoSidesOptimal.address}`);
    
    // if(NEW_PARAMS[i].WHITELIST_WORKER.length > 0) {
    //   console.log(">> Whitelisting Workers")
    //   const tx = await strategyRestrictedAddTwoSidesOptimal.setWorkersOk(NEW_PARAMS[i].WHITELIST_WORKER, true)
    //   console.log(">> Done at: ", tx.hash)
    // }
      config.Vaults[i].StrategyAddTwoSidesOptimal = strategyRestrictedAddTwoSidesOptimal.address
      FileService.write(network.name, config);
  }
};

export default func;
func.tags = ['RestrictedVaultStrategiesV2'];