import { BigNumber } from "ethers"

export function calculateShares(amount: BigNumber, totalTime: BigNumber, now: number, expiry: BigNumber, n: number): BigNumber {
  const timeLeft = expiry.sub(now)
  return amount.mul(timeLeft.pow(n)).div(totalTime.pow(n))
}