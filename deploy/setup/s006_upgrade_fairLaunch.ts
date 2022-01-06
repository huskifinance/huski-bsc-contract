import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { IWorker__factory, IStrategy__factory, FairLaunch, FairLaunch__factory } from '../../typechain'

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
  const OLD_FAIR_LAUNCH_ADDRESS = '0x598ea302a78d9660B2149b1A061277dFb665B89d';










  console.log(`>> Upgrading fair launch at ${OLD_FAIR_LAUNCH_ADDRESS}`);
  const NewFairLaunch = (await ethers.getContractFactory(
    'FairLaunch',
    (await ethers.getSigners())[0]
  ));
  const newFairLaunch = await upgrades.upgradeProxy(OLD_FAIR_LAUNCH_ADDRESS, NewFairLaunch) as FairLaunch;
  await newFairLaunch.deployed();
  console.log("✅ Done");

  console.log(`Total pool on the new Fair Launch: ${(await newFairLaunch.poolLength()).toString()}`);

};

export default func;
func.tags = ['UpgradeFairLaunch'];