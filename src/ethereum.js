import Web3Eth from 'web3-eth'
import Web3Utils from 'web3-utils'
import has from 'lodash/has'
import truffleContract from 'truffle-contract'

const txRetVal = txReceipt => txReceipt.receipt.logs[0].data
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
  }
}

class Ethereum {
  /**
   * Setup web3 and a handle to the HashedTimelock contract
   *
   * @param rpcAddr Address of Ethereum client RPC
   * @param network Ethereum network to connect to (eg. 'ropsten', 'mainnet')
   * @param htlcContractObj Truffle contract generated object containing
   *          details of the contract including the abi. Additionally it should
   *          contain deployed addresses for each 'network' as:
   *            deployed: { ropsten: '0xabc...', 'mainnet: 0x123...', etc.
   */
  constructor(rpcAddr, network, htlcContractObj) {
    if (!has(htlcContractObj.deployed, network))
      throw new Error(
        `No contract deployment address found for HashedTimelock on ` +
          `network [${network}].`
      )

    const htlcAddr = htlcContractObj.deployed[network]
    if (!Web3Utils.isAddress(htlcAddr))
      throw new Error(
        `HashedTimelock deployment address [${htlcAddr}] ` +
          `is not a valid contract address`
      )

    this.web3Eth = new Web3Eth(rpcAddr)

    const HTLC = truffleContract(htlcContractObj)
    HTLC.setProvider(this.web3Eth.currentProvider)
    this.htlc = HTLC.at(htlcAddr)
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
      })
      .then(txReceipt => txRetVal(txReceipt)) // contractId)
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
}

export default Ethereum
