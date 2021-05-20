import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { HodlERC20, MockERC20 } from '../typechain';
import { BigNumber, utils } from 'ethers';
// import { calculateShares } from './utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('HodlERC20 Tests', function () {
  const provider = waffle.provider;
  const totalDuration = 86400 * 3; // 3 days period
  const expiry = BigNumber.from(parseInt((Date.now() / 1000).toString()) + totalDuration);
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
    describe('#transfer', () => {
      it('Should revert when transfer is called', async function () {
        await expect(
          hodl.connect(depositor1).transfer(depositor2.address, 10000)
        ).to.be.revertedWith('!TRANSFER');
      });
    });
    describe('#deposit', () => {
      it('Should deposit and get correct shares from depositor1 & depositor2', async function () {
        // deposit 1 WETH from depositor1
        await token.connect(depositor1).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor1).deposit(depositAmount);
        
        const hWethBalance1 = await hodl.balanceOf(depositor1.address);
        expect(hWethBalance1).to.eq(depositAmount);

        const d1Shares = await hodl.shares(depositor1.address);
        const d1ShareToGet = await hodl.calculateShares(depositAmount);
        expect(d1Shares).to.eq(d1ShareToGet);
        expect(d1Shares.lt(depositAmount)).to.be.true;

        // deposit 1 WETH from depositor2
        await token.connect(depositor2).approve(hodl.address, ethers.constants.MaxUint256);
        await hodl.connect(depositor2).deposit(depositAmount);

        const hWethBalance2 = await hodl.balanceOf(depositor2.address);
        expect(hWethBalance2).to.eq(depositAmount);

        const d2Shares = await hodl.shares(depositor2.address);
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
        const d1SharesAfter = await hodl.shares(depositor1.address);
        expect(d1SharesAfter.eq(0), 'D1 shares after exit should be 0').to.be.true;

        // check depositor 1 got corrent amount back
        const d1Penalty = depositAmount.mul(penalty).div(1000);

        const tokenBalanceAfter = await token.balanceOf(depositor1.address);
        expect(
          tokenBalanceAfter.sub(tokenBalanceBefore).eq(depositAmount.sub(d1Penalty)),
          'penalty amount'
        ).to.be.true;

        // check total fee
        const feeCollected = d1Penalty.mul(fee).div(1000);
        const totalFee = await hodl.totalFee();
        expect(totalFee.eq(feeCollected)).to.be.true;

        // check total fee
        const _totalRewards = d1Penalty.sub(feeCollected);
        const totalReward = await hodl.totalReward();
        expect(totalReward.eq(_totalRewards)).to.be.true;
      });
      it('Should be able to quit when user have no shares', async function () {
        const d3Shares = await hodl.shares(depositor3.address);
        await hodl.connect(depositor3).redeem(d3Shares);

        const tokenBalanceBefore = await token.balanceOf(depositor3.address);

        const d3balance = await hodl.balanceOf(depositor3.address);
        await hodl.connect(depositor3).quit(d3balance);

        // share balance should be 0
        const d3BalanceAfter = await hodl.balanceOf(depositor3.address);
        expect(d3BalanceAfter.eq(0), 'D3 balance after exit should be 0').to.be.true;

        // check depositor 1 got corrent amount back
        const d3Penalty = depositAmount.mul(penalty).div(1000);

        const tokenBalanceAfter = await token.balanceOf(depositor3.address);
        expect(
          tokenBalanceAfter.sub(tokenBalanceBefore).eq(depositAmount.sub(d3Penalty)),
          'penalty amount'
        ).to.be.true;
      });
    });
    describe('#withdraw', () => {
      it('Should not be able to withdraw', async function () {
        await expect(hodl.connect(depositor2).withdraw(10000)).to.be.revertedWith('!EXPIRED');
      });
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {
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
    describe('#withdrawAllPostExpiry', () => {
      it('Should not be able to call withdrawAllPostExpiry', async function () {
        await expect(hodl.connect(depositor2).withdrawAllPostExpiry()).to.be.revertedWith(
          '!EXPIRED'
        );
      });
    });
    describe('#describe', () => {
      it('Should be able to donate any value', async function () {
        const beforeDonation = await hodl.totalReward()
        const amountToDoante = utils.parseUnits('0.5');
        await hodl.connect(depositor2).donate(amountToDoante)
        const afterDonation = await hodl.totalReward()
        expect(afterDonation.sub(beforeDonation).eq(amountToDoante)).to.be.true
      });
    })
  });

  describe('lock period', () => {
    before('increase blocktime', async () => {
      const time = expiry.toNumber() - lockingWindow + 1;
      await provider.send('evm_setNextBlockTimestamp', [time]); // add totalDuration
      await provider.send('evm_mine', []);
    });

    it('should reverts when trying to deposit', async function () {
      const depositAmount = utils.parseUnits('1');
      await expect(hodl.connect(depositor2).deposit(depositAmount)).to.be.revertedWith('LOCKED');
    });
  });

  describe('post expiry', () => {
    before('set blocktime to expiry', async () => {
      await provider.send('evm_setNextBlockTimestamp', [expiry.toNumber()]); // add totalDuration
      await provider.send('evm_mine', []);
    });
    const depositAmount = utils.parseUnits('1');
    describe('#deposit', () => {
      it('Should not be able to deposit', async function () {
        await expect(hodl.connect(depositor1).deposit(depositAmount)).to.be.revertedWith('LOCKED');
      });
    });
    describe('#quit', () => {
      it('Should reverts when trying to call quit', async function () {
        await expect(hodl.connect(depositor1).quit(depositAmount)).to.be.revertedWith('EXPIRED');
      });
    });
    describe('#withdraw', () => {
      it('Should be able to withdraw full amount', async function () {
        const balance1Before = await hodl.balanceOf(depositor1.address)
        await hodl.connect(depositor1).withdraw(balance1Before);
        const balance1After = await hodl.balanceOf(depositor1.address)
        expect(balance1After.isZero()).to.be.true
        // console.log(`balance1Before`, balance1Before.toString())
      });
    });
    describe('#withdrawFee', () => { 
      it('Should revert from non-recipient', async function () {
        await expect(hodl.connect(depositor2).withdrawFee()).to.be.revertedWith('!AUTHORIZED');
      })
      it('Should be able to withdraw full amount', async function () {
        const feeRecipientBalanceBefore = await token.balanceOf(feeRecipient.address)
        const totalFee = await hodl.totalFee()
        await hodl.connect(feeRecipient).withdrawFee();
        const totalFeeAfter = await hodl.totalFee()
        expect(totalFeeAfter.isZero()).to.be.true
        const feeRecipientBalanceAfter = await token.balanceOf(feeRecipient.address)
        expect(feeRecipientBalanceAfter.sub(feeRecipientBalanceBefore).eq(totalFee)).to.be.true
        
      });
    });
    describe('#redeem', () => {
      it('Should be able to redeem', async function () {});
    });
    describe('#withdrawAllPostExpiry', () => {
      it('Should withdraw everything', async function () {
        const balanceBefore = await token.balanceOf(depositor2.address)
        const shares = await hodl.shares(depositor2.address)
        const reward = await hodl.rewardFromShares(shares)
        const balance = await hodl.balanceOf(depositor2.address)
        await hodl.connect(depositor2).withdrawAllPostExpiry()
        const balanceAfter = await token.balanceOf(depositor2.address)
        expect(balanceAfter.sub(balanceBefore).eq(reward.add(balance))).to.be.true
      });
    });
  });
});
