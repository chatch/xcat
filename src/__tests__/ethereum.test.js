import expect from 'expect'
import Promise from 'bluebird'

import Ethereum from '../ethereum'
import {random32} from '../utils'
import HTLC from '../contracts/HashedTimelock'
import {testrpc as htlcAddr} from '../contracts/deployment'

const RPC_ADDR = 'http://localhost:8545'

describe('ethereum', () => {
  describe('constructor', () => {
    it('creates a new instance', () => {
      const eth = new Ethereum(RPC_ADDR, HTLC, htlcAddr)
      expect(eth.htlc.abi).toEqual(HTLC.abi)
      expect(eth.htlc.address.toLowerCase()).toEqual(htlcAddr.toLowerCase())
    })

    it('throws if contract address is not a valid contract address', () => {
      const expectedError =
        'HashedTimelock deployment address [0xabcdef] is not a valid contract address'
      expect(() => new Ethereum(RPC_ADDR, HTLC, '0xabcdef')).toThrowError(
        expectedError
      )
    })
  })

  describe('createHashedTimelockContract', () => {
    it('submits new contract tx and returns contract id', done => {
      const eth = new Ethereum(RPC_ADDR, HTLC, htlcAddr)

      const contractId = random32().toString('hex')
      const txReceipt = {logs: [{args: {contractId: contractId}}]}
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
