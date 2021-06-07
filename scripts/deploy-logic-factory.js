// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.

  // We get the contract to deploy
  const Hodl = await hre.ethers.getContractFactory("HodlERC20");
  const hodlLogic = await Hodl.deploy({gasPrice: 30000000000});

  await hodlLogic.deployed();

  console.log("Hodl logic contract deployed at:", hodlLogic.address);

  const HodlFactory = await hre.ethers.getContractFactory("HodlFactory");
  const factory = await HodlFactory.deploy(hodlLogic.address, {gasPrice: 30000000000});

  await factory.deployed();

  console.log("Factory contract deployed at:", factory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
