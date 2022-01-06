import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { DebtToken, DebtToken__factory, FairLaunch, FairLaunch__factory, Timelock, Timelock__factory, Vault, Vault__factory, WNativeRelayer, WNativeRelayer__factory } from '../../typechain';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
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

  const vaultIndex = 3;
  const NAME = "Interest Bearing WBNB";
  const ALLOC_POINT_FOR_DEPOSIT = 200;
  const ALLOC_POINT_FOR_OPEN_POSITION = 300;
  const BASE_TOKEN_ADDR = config.Tokens.WBNB;

  const FAIR_LAUNCH_ADDR = config.FairLaunch.address;
  const CONFIG_ADDR = config.Vaults[vaultIndex].config;
  const SYMBOL = config.Vaults[vaultIndex].symbol;
  const WNATIVE_RELAYER_ADDR = config.SharedConfig.WNativeRelayer;
  const TIMELOCK = config.Timelock;
  // const EXACT_ETA = '1622199600';



  console.log(`>> Deploying debt${SYMBOL}`)
  const DebtToken = (await ethers.getContractFactory(
    "DebtToken",
    (await ethers.getSigners())[0]
  )) as DebtToken__factory;
  const debtToken = await upgrades.deployProxy(DebtToken, [
    `debt${SYMBOL}_V2`, `debt${SYMBOL}_V2`, TIMELOCK], 
    { unsafeAllow: ['delegatecall'] }) as DebtToken;
  await debtToken.deployed();
  console.log(`>> Deployed at ${debtToken.address}`);

  console.log(`>> Deploying an upgradable Vault contract for ${NAME}`);
  const Vault = (await ethers.getContractFactory(
    'Vault',
    (await ethers.getSigners())[0]
  )) as Vault__factory;
  const vault = await upgrades.deployProxy(
    Vault,[CONFIG_ADDR, BASE_TOKEN_ADDR, NAME, SYMBOL, 18, debtToken.address], 
    { unsafeAllow: ['delegatecall'] }
  ) as Vault;
  await vault.deployed();
  console.log(`>> Deployed at ${vault.address}`);

  console.log(">> Set okHolders on DebtToken to be be Vault")
  await debtToken.setOkHolders([vault.address, FAIR_LAUNCH_ADDR], true)
  console.log("✅ Done");

  console.log(">> Transferring ownership of debtToken to Vault");
  await debtToken.transferOwnership(vault.address);
  console.log("✅ Done");

  // const timelock = Timelock__factory.connect(
  //   TIMELOCK, (await ethers.getSigners())[0]
  // ) as Timelock

  // console.log(">> Queue Transaction to add a debtToken pool through Timelock");
  // await timelock.queueTransaction(SHIELD_ADDR, '0', 'addPool(uint256,address,bool)', ethers.utils.defaultAbiCoder.encode(['uint256','address','bool'], [ALLOC_POINT_FOR_OPEN_POSITION, debtToken.address, true]), EXACT_ETA);
  // console.log("✅ Done");

  // console.log(">> Generate timelock executeTransaction")
  // console.log(`await timelock.executeTransaction('${SHIELD_ADDR}', '0', 'addPool(uint256,address,bool)', ethers.utils.defaultAbiCoder.encode(['uint256','address','bool'], [${ALLOC_POINT_FOR_OPEN_POSITION}, '${debtToken.address}', true]), ${EXACT_ETA})`);
  // console.log("✅ Done");

  const fairlaunch = FairLaunch__factory.connect(
    FAIR_LAUNCH_ADDR, (await ethers.getSigners())[0]
  ) as FairLaunch

  console.log(">> Add a debtToken to fair launch pool");
  await fairlaunch.addPool(`debt${SYMBOL}`, ALLOC_POINT_FOR_OPEN_POSITION, debtToken.address, true);
  console.log("✅ Done");

  console.log(">> Sleep for 10000msec waiting for fairLaunch to update the pool");
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log("✅ Done");

  const fairLaunchDebtPid = (await fairlaunch.poolLength()).sub(1);
  console.log(">> link pool with vault pid: ", fairLaunchDebtPid);
  await vault.setFairLaunchPoolId(fairLaunchDebtPid, { gasLimit: '2000000' });
  let fairLaunchDebtPidConfig = {
    id: fairLaunchDebtPid.toNumber(),
    stakingToken: `debt${SYMBOL}`,
    address: debtToken.address,
  }
  config.FairLaunch.pools.push(fairLaunchDebtPidConfig as never)
  console.log("✅ Done");
  
  // console.log(`>> Queue Transaction to add a ${SYMBOL} pool through Timelock`);
  // await timelock.queueTransaction(SHIELD_ADDR, '0', 'addPool(uint256,address,bool)', ethers.utils.defaultAbiCoder.encode(['uint256','address','bool'], [ALLOC_POINT_FOR_DEPOSIT, vault.address, true]), EXACT_ETA);
  // console.log("✅ Done");

  // console.log(">> Generate timelock executeTransaction")
  // console.log(`await timelock.executeTransaction('${SHIELD_ADDR}', '0', 'addPool(uint256,address,bool)', ethers.utils.defaultAbiCoder.encode(['uint256','address','bool'], [${ALLOC_POINT_FOR_DEPOSIT}, '${vault.address}', true]), ${EXACT_ETA})`);
  // console.log("✅ Done");

  console.log(`>> Add a ${SYMBOL} to fair launch pool`);
  await fairlaunch.addPool(SYMBOL, ALLOC_POINT_FOR_DEPOSIT, vault.address, true);

  console.log(">> Sleep for 10000msec waiting for fairLaunch to update the pool");
  await new Promise(resolve => setTimeout(resolve, 10000));
  const fairLaunchPid = (await fairlaunch.poolLength()).sub(1);
  console.log(">> link pool with vault pid: ", fairLaunchPid);
  let fairLaunchPidConfig = {
    id: fairLaunchPid.toNumber(),
    stakingToken: SYMBOL,
    address: vault.address,
  }
  config.FairLaunch.pools.push(fairLaunchPidConfig as never)
  console.log("✅ Done");

  const wNativeRelayer = WNativeRelayer__factory.connect(
    WNATIVE_RELAYER_ADDR, (await ethers.getSigners())[0]
  ) as WNativeRelayer;

  console.log(">> Whitelisting Vault on WNativeRelayer Contract");
  await wNativeRelayer.setCallerOk([vault.address], true);
  console.log("✅ Done");

  console.log(">> Write VaultConfig address to config");
  for(let i = 0; i < config.Vaults.length; i++ ) {
    if (config.Vaults[i].symbol === SYMBOL) {
      config.Vaults[i].name = NAME
      config.Vaults[i].symbol = SYMBOL
      config.Vaults[i].address = vault.address
      config.Vaults[i].baseToken = BASE_TOKEN_ADDR,
      config.Vaults[i].debtToken = debtToken.address
      FileService.write(network.name, config);
    }
  }
  console.log("✅ Done");
};

export default func;
func.tags = ['VaultWBNB'];