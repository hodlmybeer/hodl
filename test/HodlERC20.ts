import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { HodlERC20, MockERC20 } from '../typechain';
import { BigNumber, utils } from 'ethers';
import { calculateShares } from './utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HodlERC20 Tests', function () {
  const provider = waffle.provider;
  const expiry = BigNumber.from(parseInt((Date.now() / 1000).toString()) + 86400 * 3); // 3 days period
  let hodl: HodlERC20;
  let token: MockERC20;
  let totalTime: BigNumber;
  let accounts: SignerWithAddress[] = [];

  let feeRecipient: SignerWithAddress;
  let depositor1: SignerWithAddress;
  let depositor2: SignerWithAddress;
  let depositor3: SignerWithAddress;
  // let depositor4: SignerWithAddress;

  const penalty = 50; // 5%
  const lockingWindow = 86400 * 1; // 1 day locking
  const name = 'hodl WETH';
  const symbol = 'hWETH';
  const fee = 50; //5% of penalty
  const n = 1; // linear decay

  this.beforeAll('Set accounts', async () => {
    accounts = await ethers.getSigners();
    const [_depositor1, _depositor2, _depositor3, _feeRecipient] = accounts;

    depositor1 = _depositor1;
    depositor2 = _depositor2;
    depositor3 = _depositor3;
    feeRecipient = _feeRecipient;
  });

  this.beforeAll('Deploy HodlERC20', async () => {
    accounts = await ethers.getSigners();
    const HodlERC20 = await ethers.getContractFactory('HodlERC20');
    const contract = await HodlERC20.deploy();
    hodl = contract as HodlERC20;
  });

  this.beforeAll('Deploy Mock tokens', async () => {
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    await token.init('WETH', 'WETH', 18);

    // mint 100 WETH to account 0, 1 , 2, 3
    // every depositor got 10 weth
    const mintAmount = utils.parseUnits('10', 'ether');
    await token.mint(depositor1.address, mintAmount);
    await token.mint(depositor2.address, mintAmount);
    await token.mint(depositor3.address, mintAmount);
  });

  describe('creation', () => {
    describe('#init', () => {
      it('Should revert when init with invalid penalty', async function () {
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
            symbol
          )
        ).to.be.revertedWith('INVALID_PENALTY');
      });

      it('Should revert when init with invalid expiry', async function () {
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
            symbol
          )
        ).to.be.revertedWith('INVALID_EXPIRY');
      });

      it('Should revert when init with locking window too long', async function () {
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
            symbol
          )
        ).to.be.revertedWith('INVALID_EXPIRY');
      });

      it('Should init the contract', async function () {
        await hodl.init(
          token.address,
          penalty,
          lockingWindow,
          expiry,
          fee,
          n,
          feeRecipient.address,
          name,
          symbol
        );

        const _totalFee = await hodl.totalFee();
        const reward = await hodl.totalReward();
        const totalSupply = await hodl.totalSupply();
        const _expiry = await hodl.expiry();
        const _decimals = await hodl.decimals();
        const _name = await hodl.name();
        const _symbol = await hodl.symbol();

        totalTime = await hodl.totalTime();

        expect(_totalFee.isZero()).to.be.true;
        expect(reward.isZero()).to.be.true;
        expect(totalSupply.isZero()).to.be.true;
        expect(_expiry.eq(expiry)).to.be.true;
        expect(_decimals).to.equal(18);
        expect(_name).to.eq(name);
        expect(_symbol).to.eq(symbol);
      });

      it('Should revert when trying to re-init', async function () {
        await expect(
          hodl.init(token.address, 0, 0, 0, 0, 0, feeRecipient.address, name, symbol)
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });
  });

  describe('pre-expiry', () => {
    const depositAmount = utils.parseUnits('1');

    describe('#deposit', () => {
      it('Should deposit and get correct shares from depositor1 & depositor2', async function () {
        // deposit 1 WETH from depositor1
        await token.connect(depositor1).approve(hodl.address, ethers.constants.MaxUint256);
        const txRes = await hodl.connect(depositor1).deposit(depositAmount);
        const block = await provider.getBlock(txRes.blockNumber);
        const blockTime = block.timestamp;

        const hWethBalance1 = await hodl.balanceOf(depositor1.address);
        expect(hWethBalance1).to.eq(depositAmount);

        const d1Shares = await hodl.getShares(depositor1.address);
        const d1ShareToGet = calculateShares(depositAmount, totalTime, blockTime, expiry, n);
        expect(d1Shares).to.eq(d1ShareToGet);
        expect(d1Shares.lt(depositAmount)).to.be.true;

        // deposit 1 WETH from depositor2
        await token.connect(depositor2).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor2).deposit(depositAmount);

        const hWethBalance2 = await hodl.balanceOf(depositor2.address);
        expect(hWethBalance2).to.eq(depositAmount);

        const d2Shares = await hodl.getShares(depositor2.address);
        expect(d1Shares.gt(d2Shares)).to.be.true;

        // deposit 1 WETH from depositor3
        await token.connect(depositor3).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor3).deposit(depositAmount);
        const hWethBalance3 = await hodl.balanceOf(depositor3.address);
        expect(hWethBalance2).to.eq(hWethBalance3);
      });
    });
    describe('#quit', () => {
      it('Should be able to quit', async function () {
        const tokenBalanceBefore = await token.balanceOf(depositor1.address);

        const d1Balance = await hodl.balanceOf(depositor1.address);
        await hodl.connect(depositor1).quit(d1Balance);

        // share balance should be 0
        const d1BalanceAfter = await hodl.balanceOf(depositor1.address);
        expect(d1BalanceAfter.eq(0), 'D1 balance after exit should be 0').to.be.true;

        // shares should be zero because D1 was forced to redeem.
        const d1SharesAfter = await hodl.getShares(depositor1.address);
        expect(d1SharesAfter.eq(0), 'D1 shares after exit should be 0').to.be.true;

        // depositor 1 got corrent amount back

        const d1Penalty = depositAmount.mul(penalty).div(1000);
        
        const tokenBalanceAfter = await token.balanceOf(depositor1.address);
        expect(tokenBalanceAfter.sub(tokenBalanceBefore).eq(depositAmount.sub(d1Penalty)), "penalty amount").to.be.true

        // check total fee
        const feeCollected = d1Penalty.mul(fee).div(1000)
        const totalFee = await hodl.totalFee()
        expect(totalFee.eq(feeCollected)).to.be.true

        // check total fee
        const _totalRewards = d1Penalty.sub(feeCollected)
        const totalReward = await hodl.totalReward()
        expect(totalReward.eq(_totalRewards)).to.be.true
      });
    });
    describe('#withdraw', () => {
      it('Should not be able to withdraw', async function () {});
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {});
    });
  });

  describe('post expiry', () => {
    describe('#deposit', () => {
      it('Should not be able to deposit', async function () {});
    });
    describe('#exist', () => {
      it('Should not be able to quit', async function () {});
    });
    describe('#withdraw', () => {
      it('Should be able to withdraw full amount', async function () {});
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {});
    });
  });
});
