import expect from 'expect'
import {existsSync, renameSync, unlinkSync} from 'fs'

import {clone} from '../utils'
import TradeDB from '../trade-db'
import testTrade from './__data__/trade1.json'

const DEFAULT_DB_PATH = './tradedb.json'
const TRADE_ID_REGEX = /^[^-]*-[^-]*-[^-]*$/

const deleteIfExists = filename => {
  if (existsSync(filename)) unlinkSync(filename)
}

describe('trade-db', () => {
  const BACKUP_DB_PATH = './tradedb.json.backup'

  beforeAll(() => {
    if (existsSync(DEFAULT_DB_PATH)) renameSync(DEFAULT_DB_PATH, BACKUP_DB_PATH)
  })

  afterAll(() => {
    if (existsSync(BACKUP_DB_PATH)) renameSync(BACKUP_DB_PATH, DEFAULT_DB_PATH)
  })

  afterEach(() => {
    deleteIfExists(DEFAULT_DB_PATH)
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

  it('creates a new db at non default path and can read from it after', () => {
    const filename = './my_trades_file.json'
    deleteIfExists(filename) // ensure it doesn't exist

    // new db with one trade
    const tradeDBNew = new TradeDB(filename)
    expect(tradeDBNew.db).toEqual({})
    const savedTrade = tradeDBNew.save(testTrade)

    // check can open the db now and it has the trade
    const tradeDB = new TradeDB(filename)
    expect(tradeDB.db).not.toEqual({})
    const trade = tradeDB.get(savedTrade.id)
    expect(trade).toEqual(savedTrade)

    deleteIfExists(filename) // ensure it doesn't exist
  })
})
