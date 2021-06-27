import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { HodlERC20, MockERC20 } from "../typechain";
import { BigNumber, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("HodlERC20 Tests", function () {
  const provider = waffle.provider;
  const totalDuration = 86400 * 3; // 3 days period
  let expiry: BigNumber;
  let hodl: HodlERC20;
  let token: MockERC20;
  let bonusToken: MockERC20;
  let randomToken: MockERC20;

  let totalTime: BigNumber;
  let accounts: SignerWithAddress[] = [];

  let feeRecipient: SignerWithAddress;
  let depositor1: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let depositor3: SignerWithAddress;
  let depositor4: SignerWithAddress;
  let random: SignerWithAddress;
  let donor: SignerWithAddress;

  const penalty = 50; // 5%
  const lockingWindow = 86400 * 1; // 1 day locking
  const name = "hodl WETH";
  const symbol = "hWETH";
  const fee = 50; //5% of penalty
  const n = 1; // linear decay

  this.beforeAll("Set accounts", async () => {
    const blockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(blockNumber);
    expiry = BigNumber.from(parseInt(currentBlock.timestamp.toString()) + totalDuration);

    accounts = await ethers.getSigners();
    const [_depositor1, _depositor2, _depositor3, _depositor4, _feeRecipient, _random, _donor] = accounts;

    depositor1 = _depositor1;
    depositor2 = _depositor2;
    depositor3 = _depositor3;
    depositor4 = _depositor4;
    random = _random;
    feeRecipient = _feeRecipient;
    donor = _donor;
  });

  this.beforeAll("Deploy HodlERC20", async () => {
    accounts = await ethers.getSigners();
    const HodlERC20 = await ethers.getContractFactory("HodlERC20");
    const contract = await HodlERC20.deploy();
    hodl = contract as unknown as HodlERC20;
  });

  this.beforeAll("Deploy Mock tokens", async () => {
    const ERC20 = await ethers.getContractFactory("MockERC20");
    const erc20 = await ERC20.deploy();
    const bonusErc20 = await ERC20.deploy();
    const randomErc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    bonusToken = bonusErc20 as MockERC20;
    randomToken = randomErc20 as MockERC20;

    await token.init("WETH", "WETH", 18);
    await bonusToken.init("BONUS", "BONUS", 18);
    await randomToken.init("COMP", "COMP", 18);

    // every depositor got 10 weth
    const mintAmount = utils.parseUnits("10", "ether");
    await token.mint(depositor1.address, mintAmount);
    await token.mint(depositor2.address, mintAmount);
    await token.mint(depositor3.address, mintAmount);
    await token.mint(depositor4.address, mintAmount);
    await bonusToken.mint(donor.address, mintAmount);
  });

  describe("creation", () => {
    describe("#init", () => {
      it("Should revert when init with invalid penalty", async function () {
        await expect(
          hodl.init(
            token.address,
            1001,
            lockingWindow,
            expiry,
            fee,
            n,
            feeRecipient.address,
            name,
            symbol,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_PENALTY");
      });
      it("Should revert when init with invalid fee", async function () {
        await expect(
          hodl.init(
            token.address,
            penalty,
            lockingWindow,
            expiry,
            1001,
            n,
            feeRecipient.address,
            name,
            symbol,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_FEE");
      });

      it("Should revert when init with invalid expiry", async function () {
        const wrongExpiry = expiry.sub(86400 * 30);
        await expect(
          hodl.init(
            token.address,
            penalty,
            lockingWindow,
            wrongExpiry,
            fee,
            n,
            feeRecipient.address,
            name,
            symbol,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_EXPIRY");
      });

      it("Should revert when init with locking window too long", async function () {
        const wrongLockingWindow = 86400 * 31;
        await expect(
          hodl.init(
            token.address,
            penalty,
            wrongLockingWindow,
            expiry,
            fee,
            n,
            feeRecipient.address,
            name,
            symbol,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_EXPIRY");
      });

      it("Should revert if bonus token is the same as main token", async function () {
        await expect(
          hodl.init(
            token.address,
            penalty,
            lockingWindow,
            expiry,
            fee,
            n,
            feeRecipient.address,
            name,
            symbol,
            token.address
          )
        ).to.be.revertedWith("INVALID_BONUS_TOKEN");
      });

      it("Should revert if fee recipient is address(0)", async function () {
        await expect(
          hodl.init(
            token.address,
            penalty,
            lockingWindow,
            expiry,
            fee,
            n,
            ethers.constants.AddressZero,
            name,
            symbol,
            ethers.constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_RECIPIENT");
      });

      it("Should init the contract", async function () {
        await hodl.init(
          token.address,
          penalty,
          lockingWindow,
          expiry,
          fee,
          n,
          feeRecipient.address,
          name,
          symbol,
          bonusToken.address
        );

        const reward = await hodl.totalReward();
        const totalSupply = await hodl.totalSupply();
        const _expiry = await hodl.expiry();
        const _decimals = await hodl.decimals();
        const _name = await hodl.name();
        const _symbol = await hodl.symbol();
        const _bonusReward = await hodl.totalBonusReward();

        totalTime = await hodl.totalTime();

        expect(reward.isZero()).to.be.true;
        expect(totalSupply.isZero()).to.be.true;
        expect(_expiry.eq(expiry)).to.be.true;
        expect(_decimals).to.equal(18);
        expect(_name).to.eq(name);
        expect(_symbol).to.eq(symbol);
        expect(_bonusReward.isZero()).to.be.true;
      });

      it("Should revert when trying to re-init", async function () {
        await expect(
          hodl.init(token.address, 0, 0, 0, 0, 0, feeRecipient.address, name, symbol, ethers.constants.AddressZero)
        ).to.be.revertedWith("Initializable: contract is already initialized");
      });
    });
  });

  describe("pre-expiry", () => {
    const depositAmount = utils.parseUnits("1");
    describe("#transfer", () => {
      it("Should revert when transfer is called", async function () {
        await expect(hodl.connect(depositor1).transfer(depositor2.address, 10000)).to.be.revertedWith("!TRANSFER");
      });
    });
    describe("#deposit", () => {
      it("Should deposit and get correct shares from depositor1 & depositor2", async function () {
        // deposit 1 WETH from depositor1
        await token.connect(depositor1).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor1).deposit(depositAmount, depositor1.address);

        const hWethBalance1 = await hodl.balanceOf(depositor1.address);
        expect(hWethBalance1).to.eq(depositAmount);

        const d1Shares = await hodl.shares(depositor1.address);
        const d1ShareToGet = await hodl.calculateShares(depositAmount);
        expect(d1Shares).to.eq(d1ShareToGet);
        expect(d1Shares.lt(depositAmount)).to.be.true;

        // deposit 1 WETH from depositor2
        await token.connect(depositor2).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor2).deposit(depositAmount, depositor2.address);

        const hWethBalance2 = await hodl.balanceOf(depositor2.address);
        expect(hWethBalance2).to.eq(depositAmount);

        const d2Shares = await hodl.shares(depositor2.address);
        expect(d1Shares.gt(d2Shares)).to.be.true;

        // deposit 1 WETH from depositor3
        await token.connect(depositor3).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor3).deposit(depositAmount, depositor3.address);
        const hWethBalance3 = await hodl.balanceOf(depositor3.address);
        expect(hWethBalance2).to.eq(hWethBalance3);

        // deposit 1 WETH from depositor4
        await token.connect(depositor4).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor4).deposit(depositAmount, depositor4.address);
        const hWethBalance4 = await hodl.balanceOf(depositor4.address);
        expect(hWethBalance2).to.eq(hWethBalance4);

        // mint hToken for random address (from depositor4)
        await hodl.connect(depositor4).deposit(depositAmount, random.address);
        const randomBalance = await hodl.balanceOf(depositor4.address);
        expect(randomBalance).to.eq(hWethBalance4);
      });
    });
    describe("#quit", () => {
      it("Should be able to quit", async function () {
        const tokenBalanceBefore = await token.balanceOf(depositor1.address);

        const d1Balance = await hodl.balanceOf(depositor1.address);
        const feeRecipientBalanceBefore = await token.balanceOf(feeRecipient.address);

        await hodl.connect(depositor1).quit(d1Balance);

        // share balance should be 0
        const d1BalanceAfter = await hodl.balanceOf(depositor1.address);
        expect(d1BalanceAfter.eq(0), "D1 balance after exit should be 0").to.be.true;

        // shares should be zero because D1 was forced to redeem.
        const d1SharesAfter = await hodl.shares(depositor1.address);
        expect(d1SharesAfter.eq(0), "D1 shares after exit should be 0").to.be.true;

        // check depositor 1 got correct amount back
        const d1Penalty = depositAmount.mul(penalty).div(1000);

        const tokenBalanceAfter = await token.balanceOf(depositor1.address);
        expect(tokenBalanceAfter.sub(tokenBalanceBefore).eq(depositAmount.sub(d1Penalty)), "penalty amount").to.be.true;

        // check total fee
        const feeCollected = d1Penalty.mul(fee).div(1000);
        const feeRecipientBalanceAfter = await token.balanceOf(feeRecipient.address);

        expect(feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore).eq(feeCollected)).to.be.true;

        // check total fee
        const _totalRewards = d1Penalty.sub(feeCollected);
        const totalReward = await hodl.totalReward();
        expect(totalReward.eq(_totalRewards)).to.be.true;
      });
      it("Should not be able to quit with amount exceeding the real amount", async function () {
        const d1Balance = await hodl.balanceOf(depositor1.address);
        const exceedingBalance = d1Balance.add(1.0);
        await expect(hodl.connect(depositor1).quit(exceedingBalance)).to.be.revertedWith(
          "ERC20: burn amount exceeds balance"
        );
      });
      it("Should be able to quit when user have no shares", async function () {
        const d3Shares = await hodl.shares(depositor3.address);
        await hodl.connect(depositor3).redeem(d3Shares);

        const tokenBalanceBefore = await token.balanceOf(depositor3.address);

        const d3balance = await hodl.balanceOf(depositor3.address);
        await hodl.connect(depositor3).quit(d3balance);

        // share balance should be 0
        const d3BaseBalanceAfter = await hodl.balanceOf(depositor3.address);
        expect(d3BaseBalanceAfter.eq(0), "D3 balance after exit should be 0").to.be.true;

        // check depositor 1 got current amount back
        const d3Penalty = depositAmount.mul(penalty).div(1000);

        const tokenBalanceAfter = await token.balanceOf(depositor3.address);
        expect(tokenBalanceAfter.sub(tokenBalanceBefore).eq(depositAmount.sub(d3Penalty)), "penalty amount").to.be.true;
      });
    });
    describe("#withdraw", () => {
      it("Should not be able to withdraw", async function () {
        await expect(hodl.connect(depositor2).withdraw(10000)).to.be.revertedWith("!EXPIRED");
      });
    });
    describe("#redeem", () => {
      it("Should be able to redeem", async function () {
        const balanceBefore = await token.balanceOf(depositor2.address);
        const d2Shares = await hodl.shares(depositor2.address);
        const totalRewards = await hodl.totalReward();
        const redeemShares = d2Shares.div(2);

        const totalShares = await hodl.totalShares();

        const amountToGet = totalRewards.mul(redeemShares).div(totalShares);
        await hodl.connect(depositor2).redeem(redeemShares);
        const balanceAfter = await token.balanceOf(depositor2.address);
        expect(balanceAfter.sub(balanceBefore).eq(amountToGet)).to.be.true;

        const totalSharesAfter = await hodl.totalShares();
        expect(totalShares.sub(totalSharesAfter).eq(redeemShares)).to.be.true;
      });
    });
    describe("#withdrawAllPostExpiry", () => {
      it("Should not be able to call withdrawAllPostExpiry", async function () {
        await expect(hodl.connect(depositor2).withdrawAllPostExpiry()).to.be.revertedWith("!EXPIRED");
      });
    });
    describe("#donations", () => {
      it("Should be able to donate any value of base token", async function () {
        const beforeDonation = await hodl.totalReward();
        const bonusRewardBeforeDonation = await hodl.totalBonusReward();
        const amountToDonate = utils.parseUnits("0.5");
        await hodl.connect(depositor2).donate(amountToDonate, token.address);
        const afterDonation = await hodl.totalReward();
        const bonusRewardAfterDonation = await hodl.totalBonusReward();
        expect(afterDonation.sub(beforeDonation).eq(amountToDonate)).to.be.true;
        expect(bonusRewardBeforeDonation.isZero()).to.be.true;
        expect(bonusRewardAfterDonation.isZero()).to.be.true;
      });
      it("Should be able to donate any value of bonus token", async function () {
        const beforeDonation = await hodl.totalReward();
        const bonusRewardBeforeDonation = await hodl.totalBonusReward();
        const amountToDonate = utils.parseUnits("0.5");
        await bonusToken.connect(donor).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(donor).donate(amountToDonate, bonusToken.address);
        const afterDonation = await hodl.totalReward();
        const bonusRewardAfterDonation = await hodl.totalBonusReward();
        expect(bonusRewardAfterDonation.sub(bonusRewardBeforeDonation).eq(amountToDonate)).to.be.true;
        expect(beforeDonation.eq(afterDonation)).to.be.true;
      });
      it("Should be able to redeem bonus token", async function () {
        const bonusBalanceBefore = await bonusToken.balanceOf(depositor4.address);
        const d4Shares = await hodl.shares(depositor4.address);
        const totalBonusReward = await hodl.totalBonusReward();
        const redeemShares = d4Shares.div(2);

        const totalShares = await hodl.totalShares();

        const amountToGet = totalBonusReward.mul(redeemShares).div(totalShares);
        await hodl.connect(depositor4).redeem(redeemShares);
        const bonusBalanceAfter = await bonusToken.balanceOf(depositor4.address);
        expect(bonusBalanceAfter.sub(bonusBalanceBefore).eq(amountToGet)).to.be.true;
        expect(bonusBalanceAfter.gt(0.0)).to.be.true;
      });
    });
    describe("#donations", () => {
      it("should revert if trying to sweep bonus token", async () => {
        await expect(hodl.sweep(bonusToken.address, 0)).to.be.revertedWith("INVALID_TOKEN_TO_SWEEP");
      });
      it("should revert if trying to sweep main token", async () => {
        await expect(hodl.sweep(token.address, 0)).to.be.revertedWith("INVALID_TOKEN_TO_SWEEP");
      });
      it("should be able to sweep token out of the contract", async function () {
        const tokenAmount = 2000000;
        await randomToken.mint(hodl.address, tokenAmount);

        const feeRecipientBalanceBefore = await randomToken.balanceOf(feeRecipient.address);
        const hodlContractBalanceBefore = await randomToken.balanceOf(hodl.address);

        await hodl.sweep(randomToken.address, tokenAmount);

        const feeRecipientBalanceAfter = await randomToken.balanceOf(feeRecipient.address);
        const hodlContractBalanceAfter = await randomToken.balanceOf(hodl.address);

        expect(
          hodlContractBalanceBefore
            .sub(hodlContractBalanceAfter)
            .eq(feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore))
        ).to.be.true;
        expect(hodlContractBalanceBefore.sub(hodlContractBalanceAfter).eq(tokenAmount)).to.be.true;
      });
    });
  });

  describe("lock period", () => {
    before("increase block time", async () => {
      const time = expiry.toNumber() - lockingWindow + 1;
      await provider.send("evm_setNextBlockTimestamp", [time]); // add totalDuration
      await provider.send("evm_mine", []);
    });

    it("should revert when trying to deposit", async function () {
      const depositAmount = utils.parseUnits("1");
      await expect(hodl.connect(depositor2).deposit(depositAmount, depositor2.address)).to.be.revertedWith("LOCKED");
    });
  });

  describe("post expiry", () => {
    before("set block time to expiry", async () => {
      await provider.send("evm_setNextBlockTimestamp", [expiry.toNumber()]); // add totalDuration
      await provider.send("evm_mine", []);
    });
    const depositAmount = utils.parseUnits("1");
    describe("#deposit", () => {
      it("Should not be able to deposit", async function () {
        await expect(hodl.connect(depositor1).deposit(depositAmount, depositor1.address)).to.be.revertedWith("LOCKED");
      });
    });
    describe("#quit", () => {
      it("Should reverts when trying to call quit", async function () {
        await expect(hodl.connect(depositor1).quit(depositAmount)).to.be.revertedWith("EXPIRED");
      });
    });
    describe("#withdraw", () => {
      it("Should be able to withdraw full amount", async function () {
        const balance1Before = await hodl.balanceOf(depositor1.address);
        await hodl.connect(depositor1).withdraw(balance1Before);
        const balance1After = await hodl.balanceOf(depositor1.address);
        expect(balance1After.isZero()).to.be.true;
      });
      it("Should be able to withdraw with minted hTokens", async function () {
        const hTokenAmount = await hodl.balanceOf(random.address);
        const wethBalanceBefore = await token.balanceOf(random.address);
        await hodl.connect(random).withdraw(hTokenAmount);
        const wethBalanceAfter = await token.balanceOf(random.address);
        const hTokenBalanceAfter = await hodl.balanceOf(random.address);
        expect(wethBalanceAfter.sub(wethBalanceBefore).gt(0)).to.be.true;
        expect(hTokenBalanceAfter.isZero()).to.be.true;
      });
    });
    describe("#redeem", () => {
      it("Should be able to redeem", async function () {});
    });
    describe("#withdrawAllPostExpiry", () => {
      it("Should withdraw everything", async function () {
        const tokenBalanceBefore = await token.balanceOf(depositor2.address);
        const rewardBalanceBefore = await bonusToken.balanceOf(depositor2.address);
        const shares = await hodl.shares(depositor2.address);

        const expectedReward = await hodl.rewardFromShares(shares);
        const expectedBonus = await hodl.bonusFromShares(shares);
        const balance = await hodl.balanceOf(depositor2.address);
        await hodl.connect(depositor2).withdrawAllPostExpiry();
        const tokenBalanceAfter = await token.balanceOf(depositor2.address);
        const rewardBalanceAfter = await bonusToken.balanceOf(depositor2.address);
        expect(tokenBalanceAfter.sub(tokenBalanceBefore).eq(expectedReward.add(balance))).to.be.true;
        expect(rewardBalanceAfter.sub(rewardBalanceBefore).eq(expectedBonus)).to.be.true;
      });
    });
  });
});
