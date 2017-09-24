import expect from 'expect'
import {unlink} from 'fs'

import {clone} from '../utils'
import TradeDB from '../trade-db'
import testTrade from './data/trade1.json'

const DEFAULT_DB_PATH = './tradedb.json'
const TRADE_ID_REGEX = /^[^-]*-[^-]*-[^-]*$/

describe('trade-db', () => {
  afterEach(() => {
    unlink(DEFAULT_DB_PATH)
  })

  it('creates a new db at default path', () => {
    const tradeDB = new TradeDB()
    expect(tradeDB.dbFile).toEqual(DEFAULT_DB_PATH)
    expect(tradeDB.db).toEqual({})
  })

  it('store and retrieve a new trade', () => {
    const tradeDB = new TradeDB()
    const trade = clone(testTrade)

    expect(trade.id).toBeUndefined()
    const tradeAfter = tradeDB.save(trade)
    expect(tradeAfter.id).toEqual(expect.stringMatching(TRADE_ID_REGEX))

    const tradeGet = tradeDB.get(tradeAfter.id)
    expect(tradeGet).toEqual(tradeAfter)
  })
})
