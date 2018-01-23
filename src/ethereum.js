import Promise from 'bluebird'
import Web3 from 'web3'
import Web3Utils from 'web3/lib/utils/utils'
import truffleContract from 'truffle-contract'
import has from 'lodash/has'

const txContractId = txReceipt => txReceipt.logs[0].args.contractId

const ethToWei = eth => Web3Utils.toWei(eth, 'ether')

const contractArrToObj = c => {
  return {
    sender: c[0],
    receiver: c[1],
    amount: c[2],
    hashlock: c[3],
    timelock: c[4],
    withdrawn: c[5],
    refunded: c[6],
    preimage: c[7],
  }
}

const validateSetup = (web3, htlcContractObj, htlcContractAddr) => {
  if (!Web3Utils.isAddress(htlcContractAddr))
    throw new Error(
      `HashedTimelock deployment address [${htlcContractAddr}] ` +
        `is not a valid contract address`
    )

  const htlcBytecode = web3.eth.getCode(htlcContractAddr)
  if (htlcBytecode === '0x0')
    throw new Error(
      `No code deployed at HashedTimelock deployment address ` +
        `[${htlcContractAddr}] `
    )

  if (htlcBytecode !== htlcContractObj.deployedBytecode)
    throw new Error(
      `Wrong code deployed at HashedTimelock deployment address. The ` +
        `deployed contract should match the bytecode in the ethereum-htlc ` +
        `module abi file. ` +
        `[${htlcContractAddr}]\n\nExpected:[\n` +
        `[${htlcContractObj.deployedBytecode}]\n\nGot:[\n${htlcBytecode}]\n`
    )
}

class Ethereum {
  /**
   * Setup web3 and a handle to the HashedTimelock contract
   *
   * @param rpcAddr Address of Ethereum client RPC
   * @param htlcContractObj Truffle contract generated object containing
   *          details of the contract including the abi.
   * @param htlcContractAddr Address of the deployed HTLC contract
   */
  constructor(rpcAddr, htlcContractObj, htlcContractAddr) {
    this.web3 = new Web3(new Web3.providers.HttpProvider(rpcAddr))

    validateSetup(this.web3, htlcContractObj, htlcContractAddr)

    // htlc contract handle (truffle-contract)
    const HTLC = truffleContract(htlcContractObj)
    HTLC.setProvider(this.web3.currentProvider)
    this.htlc = HTLC.at(htlcContractAddr)

    // htlc contract handle (web3) - for events/logs only
    const HTLCWeb3 = this.web3.eth.contract(htlcContractObj.abi)
    this.htlcWeb3 = HTLCWeb3.at(htlcContractAddr)

    // TODO: promisify web3 async handles and move async code out of contructor (for metamask consumption)
    // this.web3.eth.getCodeAsync = Promise.promisify(this.web3.eth.getCode)
  }

  /**
   * Set up a new hashed timelock contract.
   *
   * @return Promise with contractId of the new HTLC
   */
  createHashedTimelockContract(hashX, sellerAddr, buyerAddr, amount, locktime) {
    const ethHashX = hashX.startsWith('0x') ? hashX : '0x' + hashX
    const amountWei = ethToWei(amount)
    return this.htlc
      .newContract(buyerAddr, ethHashX, locktime, {
        from: sellerAddr,
        value: amountWei,
        gas: 200000,
      })
      .then(txContractId)
  }

  /**
   * Buyer withdraws the funds revealing the preimage for hash(x)
   *
   * @return Promise with tx receipt
   */
  buyerWithdraw(contractId, preimage, buyerAddr) {
    return this.htlc.withdraw(contractId, preimage, {from: buyerAddr})
  }

  /**
   * Seller claims refund assuming the transfer did not complete.
   * Seller can not call this before the timelock has expired.
   *
   * @return Promise with tx receipt
   */
  sellerRefund(contractId, sellerAddr) {
    return this.htlc.refund(contractId, {from: sellerAddr})
  }

  /**
   * Fetch HTLC contract details
   *
   * @return Promise with contract details - see contractArrToObj for prop names
   */
  getContract(contractId) {
    return this.htlc.getContract.call(contractId).then(c => contractArrToObj(c))
  }

  /**
   * Try find a trade contract given contrace details. Looks up LogHTLCNew
   * events to discover a matching contract.
   *
   * @return Promise with contractId of matching contract
   */
  findContract(depositor, withdrawer, amount, hashlock, timelock) {
    const filter = {
      receiver: withdrawer,
      sender: depositor,
      amount: amount,
      hashlock: hashlock,
      timelock: timelock,
    }
    const event = this.htlcWeb3.LogHTLCNew(filter)
    event.get = Promise.promisify(event.get)
    return event
      .get()
      .then(
        res =>
          res.length > 0 && has(res[0], 'args')
            ? res[0].args.contractId
            : undefined
      )
  }
}

export default Ethereum
