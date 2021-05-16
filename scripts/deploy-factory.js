const hre = require('hardhat')

async function main() {

  // change this to the implementation address
  const implAddress = '0xe8744164774D685F54108DD295735f658bae6491'
  console.log(`Deploying Factory with implementation: ${implAddress}`)

  const HodlFactory = await hre.ethers.getContractFactory("HodlFactory");
  const factory = await HodlFactory.deploy(implAddress);

  await factory.deployed();

  console.log("Factory contract deployed at:", factory.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
