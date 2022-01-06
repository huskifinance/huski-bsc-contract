import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { BasicVaultConfig__factory } from '../../typechain';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'
import { BigNumber } from 'ethers';

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
  
  const VAULT_CONFIG_ADDR = '0x2BE54c7feA2b0aF959a25B740d701eAa564Aa838';

  const MIN_DEBT_SIZE = ethers.utils.parseEther('100');
  const RESERVE_POOL_BPS = '1600';
  const CLOSE_PRIZE_BPS = '4';
  const KILL_PRIZE_BPS = '500';

  const FAIR_LAUNCH_ADDR = config.FairLaunch.address;
  const WNATV_ADDR = config.NativeAddress;
  const WNATV_RLY_ADDR = config.SharedConfig.WNativeRelayer;
  const INTEREST_MODEL = config.SharedConfig.HighInterestTripleSlopeModel;



  console.log(">> Vault Config Address", VAULT_CONFIG_ADDR);
  console.log(">> Native Address", WNATV_ADDR);
  console.log(">> VWNativeRelayer Address", WNATV_RLY_ADDR);
  console.log(">> VInterestTripleSlopeModel Address", INTEREST_MODEL);
  console.log(">> FairLaunch Address", FAIR_LAUNCH_ADDR);
  console.log(">> Setting params to SimpleVaultConfig contract");
  
  const basicVaultConfig = BasicVaultConfig__factory.connect(VAULT_CONFIG_ADDR, (await ethers.getSigners())[0])
  await basicVaultConfig.setParams(MIN_DEBT_SIZE, RESERVE_POOL_BPS, CLOSE_PRIZE_BPS, KILL_PRIZE_BPS,
    INTEREST_MODEL, WNATV_ADDR, WNATV_RLY_ADDR, FAIR_LAUNCH_ADDR)

  console.log("✅ Done");
};

export default func;
func.tags = ['BasicVaultConfigSetParams'];