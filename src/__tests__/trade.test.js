import expect from 'expect'
import {clone} from '../utils'
import Trade from '../trade'

const trade1 = require('./data/trade1.json')

describe('trade', () => {
  it('creates new Trade that has all properties of the given trade object', () => {
    const trade = new Trade(trade1)
    Object.keys(trade1).forEach(attr =>
      expect(trade[attr]).toEqual(trade[attr])
    )
  })

  it('throws if trade has a bad stellar address', () => {
    const tradeBadAddr = clone(trade1)
    tradeBadAddr.stellar.depositor = 'GDDADDDA'
    expect(() => new Trade(tradeBadAddr)).toThrowErrorMatchingSnapshot()
  })

  it('throws if trade has a bad ethereum address', () => {
    const tradeBadAddr = clone(trade1)
    tradeBadAddr.ethereum.withdrawer = '0xabcdef'
    expect(() => new Trade(tradeBadAddr)).toThrowErrorMatchingSnapshot()
  })
})
