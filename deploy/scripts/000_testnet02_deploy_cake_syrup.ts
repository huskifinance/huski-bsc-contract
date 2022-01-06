import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import TestnetConfig from '../results/testnet.json'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;

  if (network.name !== 'testnet') {
    console.log('This deployment script should be run against testnet only')
    return
  }
  const config = TestnetConfig

  const { deployer } = await getNamedAccounts();

  await deploy('CakeToken', {
    from: deployer,
    args: [
    ],
    log: true,
    deterministicDeployment: false,
  });

  const cake = await deployments.get('CakeToken');

  await deploy('SyrupBar', {
    from: deployer,
    args: [
      cake.address
    ],
    log: true,
    deterministicDeployment: false,
  })
};

export default func;
func.tags = ['Testnet'];