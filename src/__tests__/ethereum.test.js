import expect from 'expect'
import Ethereum from '../ethereum'
import HTLC from '../contracts/HashedTimelock.json'

const RPC_ADDR = 'http://localhost:8545'
const NETWORK = 'ropsten'

describe('ethereum', () => {
  it('creates a new instance', () => {
    const eth = new Ethereum(RPC_ADDR, NETWORK, HTLC)
    expect(eth.web3Eth.currentProvider.host).toEqual(RPC_ADDR)
    expect(eth.htlc.options.jsonInterface).toEqual(HTLC.abi)
    expect(eth.htlc.options.address.toLowerCase()).toEqual(
      HTLC.deployed.ropsten.toLowerCase()
    )
  })

  it('throws if no deployed contract address found for given network', () => {
    const expectedError =
      'No contract deployment address found for HashedTimelock on network [privatenet].'
    expect(() => new Ethereum(RPC_ADDR, 'privatenet', HTLC)).toThrowError(
      expectedError
    )
  })
})
