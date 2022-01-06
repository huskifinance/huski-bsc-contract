import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { BasicVaultConfig__factory } from '../../typechain';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */
  const { network  } = hre;
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  const FAIR_LAUNCH_ADDR = config.FairLaunch.address;
  const WNATV_ADDR = config.NativeAddress;
  const WNATV_RLY_ADDR = config.SharedConfig.WNativeRelayer;

  const SYMBOL = "ibBTCB";
  const MIN_DEBT_SIZE = ethers.utils.parseEther('100');
  const RESERVE_POOL_BPS = '1600';
  const CLOSE_PRIZE_BPS = '4';
  const KILL_PRIZE_BPS = '500';
  const INTEREST_MODEL = config.SharedConfig.LowInterestTripleSlopeModel;


  console.log(">> FAIR_LAUNCH_ADDR Address", FAIR_LAUNCH_ADDR);
  console.log(">> INTEREST_MODEL Address", INTEREST_MODEL);
  console.log(">> WNATV_ADDR Address", WNATV_ADDR);
  console.log(">> WNATV_RLY_ADDR Address", WNATV_RLY_ADDR);

  console.log(">> Deploying an upgradable BasicVaultConfig contract");
  const BasicVaultConfig = (await ethers.getContractFactory(
    'BasicVaultConfig',
    (await ethers.getSigners())[0]
  )) as BasicVaultConfig__factory;
  const basicVaultConfig = await upgrades.deployProxy(
    BasicVaultConfig,
    [MIN_DEBT_SIZE, RESERVE_POOL_BPS, CLOSE_PRIZE_BPS, KILL_PRIZE_BPS,
    INTEREST_MODEL, WNATV_ADDR, WNATV_RLY_ADDR, FAIR_LAUNCH_ADDR], 
    { unsafeAllow: ['delegatecall'] }
  );
  await basicVaultConfig.deployed();
  console.log(`>> Deployed at ${basicVaultConfig.address}`);

  console.log(">> Write VaultConfig address to config");
  let vaultConfig = {
    name: "",
    symbol: SYMBOL,
    address: "",
    debtToken: "",
    config: basicVaultConfig.address,
    tripleSlopeModel: INTEREST_MODEL,
    StrategyAddTwoSidesOptimal: "",
    workers: [],
  }
  const length = config.Vaults.push(vaultConfig as never)
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['BasicVaultConfigibBTCB'];