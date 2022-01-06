import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { FileService } from "../utils";
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig;

  await deploy('TripleSlopeModel', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  await deploy('LowInterestTripleSlopeModel', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  await deploy('HighInterestTripleSlopeModel', {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  console.log(">> Write TripleSlopeModel address to config");
  config.SharedConfig.TripleSlopeModel = (await deployments.get('TripleSlopeModel')).address;
  config.SharedConfig.LowInterestTripleSlopeModel = (await deployments.get('LowInterestTripleSlopeModel')).address;
  config.SharedConfig.HighInterestTripleSlopeModel = (await deployments.get('HighInterestTripleSlopeModel')).address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['TripleSlopeModel'];