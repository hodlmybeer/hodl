# Hodl

<p align="center">
<img src="./imgs/beers.png" width="100" height="100">
</p>

HODLing has been the best strategy in crypto. **Hodl** is here to help you do that with some extra incentive!

## Intro

This is the contract repo for **Hodl**, which enables anyone to create hodling pools. There are 2 contracts in the core folder:

- `HodlERC20`: Implementation contract to "Hodl" an ERC20.
- `HodlFactory`: Factory contract to clone `HodlERC20` with EIP1167.

## What does HodlERC20 do?

When a user deposit ERC20 into a HODL pool, the tokens will be lockup in the contract till the end of a pre-defined **expiry**. If a users want to remove his fund before expiry, he will be penalized by `penalty` proportional to his deposit, and the slashed amount will go back in to the **reward pool** that will be shared by everyone else holding the "share".

### Shares and hTokens

Everytime you join the pool, you got a `hodl` Token + some shares, the hodl token is a **non-transferable** ERC20, this is to prevent anyone from creating a secondary market to trade this token, which will eventually make this not a hodl strategy anymore.

The shares you get from deposit will decrease (linear / exponential according to a decrease parameter `n`.) as time goes by, this is to prevent last minute depositor sharing all the rewards. This also means that the earlier you deposit, the more shares of the pool you can get.

### Fees

A `fee` is charged from penalty when a user quit early. The creator of the HodlERC20 contract can specify a `feeRecipient` address that can later collect those fees. This can later be set to a governance contract that distribute the reward to all token stakers.

All quitter's penalty go to a common pool, which anyone with the pool share can redeem their proportion anytime.
When a user quit, he / she is also forced to redeemed some pool shares (proportional to the amount they're withdrawing). This is to prevent people from leaving the pool early but still earning rewards.

## How to Run locally

### install

```
npm i 
```

### test

```bash
# unit test
npx hardhat test
# coverage test
npx hardhat coverage 
```

### Run slither analysis

Slither is a static code analysis tool that help detect bad smart contract patterns.

#### Install [Slither](https://github.com/crytic/slither)
```
pip3 install slither-analyzer
```
Or find more detail [here](https://github.com/crytic/slither#how-to-install) in their documentation.

#### Run Analysis

```
slither .
```
