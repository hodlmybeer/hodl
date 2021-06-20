import { run, ethers } from "hardhat";

async function main() {
  await run("compile");

  // We get the contract to deploy
  const Hodl = await ethers.getContractFactory("HodlERC20");
  const hodlLogic = await Hodl.deploy({gasPrice: 6000000000}); // 6 gwei

  await hodlLogic.deployed();

  console.log("🥙 Hodl logic contract deployed at:", hodlLogic.address);

  const HodlFactory = await ethers.getContractFactory("HodlFactory");
  const factory = await HodlFactory.deploy(hodlLogic.address, {gasPrice: 6000000000});

  await factory.deployed();

  console.log("🍩 Factory contract deployed at:", factory.address);

  // verify contracts at the end, so we make sure etherscan is aware of their existence

  await run("verify:verify", {
    address: hodlLogic.address, 
    network: ethers.provider.network
  })

  await run("verify:verify", {
    address: factory.address, 
    network: ethers.provider.network,
    constructorArguments: [hodlLogic.address]
  })  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
