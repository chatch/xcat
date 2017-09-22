import expect from 'expect'
import sdk from 'stellar-sdk'
import Stellar from '../stellar'

describe('stellar', () => {
  it('creates a new instance for public network', () => {
    const st = new Stellar(sdk, 'public')
    expect(st.server.serverURL.toString()).toEqual(
      'https://horizon.stellar.org/'
    )
    expect(st.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.PUBLIC
    )
  })

  it('creates a new instance for test network', () => {
    const st = new Stellar(sdk, 'testnet')
    expect(st.server.serverURL.toString()).toEqual(
      'https://horizon-testnet.stellar.org/'
    )
    expect(st.sdk.Network.current()._networkPassphrase).toEqual(
      sdk.Networks.TESTNET
    )
  })
})
