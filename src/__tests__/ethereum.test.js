import expect from 'expect'
import Promise from 'bluebird'

import Ethereum from '../ethereum'
import {random32} from '../utils'
import HTLC from '../contracts/HashedTimelock.json'

const RPC_ADDR = 'http://localhost:8545'
const NETWORK = 'ropsten'

describe('ethereum', () => {
  describe('constructor', () => {
    it('creates a new instance', () => {
      const eth = new Ethereum(RPC_ADDR, NETWORK, HTLC)
      expect(eth.web3Eth.currentProvider.host).toEqual(RPC_ADDR)
      expect(eth.htlc.abi).toEqual(HTLC.abi)
      expect(eth.htlc.address.toLowerCase()).toEqual(
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

  describe('createHashedTimelockContract', () => {
    it('submits new contract tx and returns contract id', done => {
      const eth = new Ethereum(RPC_ADDR, NETWORK, HTLC)

      const contractId = random32().toString('hex')
      const txReceipt = {receipt: {logs: [{data: contractId}]}}
      eth.htlc.newContract = jest.fn(() => Promise.resolve(txReceipt))

      const hashX = random32().toString('hex')
      const amount = 0.01
      eth
        .createHashedTimelockContract(hashX, 0x0, 0x0, amount, 0)
        .then(newContractId => {
          expect(newContractId).toEqual(contractId)
          done()
        })
    })
  })
})
