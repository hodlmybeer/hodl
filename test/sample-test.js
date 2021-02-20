const { expect } = require("chai");

describe("Hodl", function() {
  it("Should return the new greeting once it's changed", async function() {
    const Hodl = await ethers.getContractFactory("Hodl");
    const greeter = await Greeter.deploy();
    
    // await greeter.deployed();
    // expect(await greeter.greet()).to.equal("Hello, world!");

    // await greeter.setGreeting("Hola, mundo!");
    // expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
