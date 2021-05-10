import { BigNumber } from "ethers"

export function calculateShares(amount: BigNumber, totalTime: BigNumber, now: number, expiry: BigNumber): BigNumber {
  const timeLeft = expiry.sub(now)
  return amount.mul(timeLeft.pow(2)).div(totalTime.pow(2))
}