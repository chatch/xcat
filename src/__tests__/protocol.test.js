import expect from 'expect'

import Trade from '../trade'
import Config from '../config'
import Protocol from '../protocol'

import config1 from './__data__/config1'
import trade1 from './__data__/trade1'

describe('protocol', () => {
  const config = new Config(config1)
  const trade = new Trade(trade1)

  it('creates new protocol instance', () => {
    const protocol = new Protocol(config, trade)
    expect(protocol.config).toEqual(config)
    expect(protocol.trade).toEqual(trade)
    expect(protocol.eth).toBeDefined()
    expect(protocol.stellar).toBeDefined()
  })
})
