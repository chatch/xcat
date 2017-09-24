import {existsSync} from 'fs'
import {hri} from 'human-readable-ids'
import has from 'lodash/has'

import Trade from './trade'
import {fileToObj, objToFile} from './utils'

const DEFAULT_DB_PATH = './tradedb.json'

class TradeDB {
  /**
   * Simple JSON file store for trades by id. DB file is created if it doesn't
   * exist.
   *
   * @param dbFile JSON file containing the trades or blank to look for one at
   *                DEFAULT_DB_PATH
   */
  constructor(dbFile = DEFAULT_DB_PATH) {
    this.dbFile = dbFile
    if (!existsSync(this.dbFile)) {
      this.db = {}
      this._flush()
    } else {
      this.db = fileToObj(this.dbFile)
    }
  }

  /**
   * Save given trade to the database. Existing trades are overwritten, new
   * trades are allocated an 'id'.
   * @param trade Trade instance
   * @return trade Trade instance is returned with the 'id' populated.
   * @throws Error if trade does not conform to the trade JSON schema.
   */
  save(trade) {
    if (!Trade.validate(trade))
      throw new Error(`trade does not conform to schema. see schema/trade.json`)

    // generate an id for new trades
    if (!has(trade, 'tradeId')) trade.id = hri.random()

    this.db[trade.id] = trade
    this._flush()

    return trade
  }

  get(tradeId) {
    return this.db[tradeId]
  }

  _flush() {
    objToFile(this.dbFile, this.db)
  }
}

export default TradeDB
