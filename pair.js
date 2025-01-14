const {isArray} = require('lodash')

const addressRouter = '0x9E9b3CBBA901031f646B04e9fC9a2E3448B40335'
class Pair {
  constructor({address0, reserve0, address1, reserve1, pairAddress = '0x', series = [], parallel = []}) {
    this.address0 = address0
    this.reserve0 = reserve0 // A
    this.address1 = address1
    this.reserve1 = reserve1 // B
    this.series = series
    this.parallel = parallel
    this.pairAddress = pairAddress
  }

  static fromSeriesPairs({pair0, pair1}) {
    const [A, B, C, D] = [pair0.reserve0, pair0.reserve1, pair1.reserve0, pair1.reserve1]
    const params = {
      address0: pair0.address0,
      reserve0: (C * A) / (C + B), // A Total
      address1: pair1.address1,
      reserve1: (B * D) / (C + B), // B Total
      series: [pair0, pair1]
    }
    return new Pair(params)
  }

  static fromParallelPairs(pairs) {
    const totalReserve0 = pairs.reduce((total, item) => total + item.reserve0, 0)
    const pairOkla = pairs.filter(item => item.reserve0 / totalReserve0 > 1 / 100000)
    const totalReserve0Filtered = pairOkla.reduce((total, item) => total + item.reserve0, 0)

    const params = {
      address0: pairOkla[0].address0,
      reserve0: pairOkla.reduce((total, item) => total + item.reserve0, 0),
      address1: pairOkla[pairOkla.length - 1].address1,
      reserve1: pairOkla.reduce((total, item) => total + item.reserve1, 0),
      parallel: pairOkla.map(item => ({
        pair: item,
        percent: item.reserve0 / totalReserve0Filtered
      }))
    }
    return new Pair(params)
  }

  getRouter(amountIn) {
    if (this.parallel.length > 0)
      return this.parallel.map(item => {
        return {
          pair: item.pair.getRouter(Math.floor(amountIn * item.percent)),
          percent: item.percent
        }
      })
    if (this.series.length > 0) {
      const amountIn1 = this.series[0].caculateAmountOut(amountIn)
      return [this.series[0].getRouter(amountIn), this.series[1].getRouter(amountIn1)]
    }
    return {
      amountIn,
      amountOut: this.caculateAmountOut(amountIn),
      token0: this.address0,
      provider: this.pairAddress
    }
  }

  getData(amountIn, sender) {
    const dataRouter = this.getRouter(amountIn).reverse()

    const dataFormat = []

    for (let route of dataRouter) {
      if (isArray(route.pair[0])) {
        for (let pair of route.pair[0]) {
          dataFormat.push({
            ...pair.pair,
            from: sender,
            to: addressRouter
          })
        }
      }
    }

    for (let route of dataRouter[dataRouter.length - 1].pair) {
      dataFormat.push({
        ...route.pair,
        from: sender,
        to: sender
      })
    }

    for (let route of dataRouter.reverse()) {
      if (isArray(route.pair[1])) {
        for (let pair of route.pair[1]) {
          dataFormat.push({...pair.pair, from: addressRouter, to: sender})
        }
      }
    }

    const addaad = dataFormat.map(item => {
      const {amountIn, amountOut, token0, provider, from, to} = item
      return [BigInt(amountIn), BigInt(amountOut), provider, token0, from, to]
    })

    return {
      dataUI:dataRouter,
      dataSwap: addaad,
    }
  }

  caculateAmountOut(amountIn) {
    const amountInWithFee = amountIn * 0.9975
    return Math.floor((this.reserve1 * amountInWithFee) / (this.reserve0 + amountInWithFee))
  }
}

module.exports = {
  Pair
}
