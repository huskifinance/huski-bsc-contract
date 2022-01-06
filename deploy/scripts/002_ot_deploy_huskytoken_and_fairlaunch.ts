import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { HuskyToken__factory, FairLaunch__factory } from '../../typechain';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'
import { FileService } from "../utils";

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
 // will BONUS_END_BLOCK-START_BLOCK = 322000
  const HUSKY_REWARD_PER_BLOCK = ethers.utils.parseEther('10.9');
  const BONUS_MULTIPLIER = 1;
  const BONUS_END_BLOCK = '2';
  const BONUS_LOCK_BPS = '0';
  const START_BLOCK = '1';
  const HUSKY_START_RELEASE = '1';
  const HUSKY_END_RELEASE = '2';



  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig;

  await deploy('HuskyToken', {
    from: deployer,
    args: [
      HUSKY_START_RELEASE,
      HUSKY_END_RELEASE,
    ],
    log: true,
    deterministicDeployment: false,
  });

  const huskyToken = HuskyToken__factory.connect(
    (await deployments.get('HuskyToken')).address, (await ethers.getSigners())[0]);

  await deploy('FairLaunch', {
    from: deployer,
    args: [
      huskyToken.address,
      deployer,
      HUSKY_REWARD_PER_BLOCK,
      START_BLOCK, BONUS_LOCK_BPS, BONUS_END_BLOCK
    ],
    log: true,
    deterministicDeployment: false,
  })
  const fairLaunch = FairLaunch__factory.connect(
    (await deployments.get('FairLaunch')).address, (await ethers.getSigners())[0])

  console.log(">> Transferring ownership of HuskyToken from deployer to FairLaunch");
  await huskyToken.transferOwnership(fairLaunch.address, { gasLimit: '500000' });
  console.log("✅ Done");

  console.log(`>> Set Fair Launch bonus to BONUS_MULTIPLIER: "${BONUS_MULTIPLIER}", BONUS_END_BLOCK: "${BONUS_END_BLOCK}", LOCK_BPS: ${BONUS_LOCK_BPS}`)
  await fairLaunch.setBonus(BONUS_MULTIPLIER, BONUS_END_BLOCK, BONUS_LOCK_BPS, { gasLimit: '500000' })
  console.log("✅ Done");

  console.log(">> Write huskyToken and fairLaunch address to config");
  config.Tokens.HUSKY = huskyToken.address;
  config.FairLaunch.address = fairLaunch.address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['FairLaunch'];
