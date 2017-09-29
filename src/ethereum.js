import Web3Eth from 'web3-eth'
import Web3Utils from 'web3-utils'
import has from 'lodash/has'

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
   * @param rpcAddr Address of Ethereum client RPC
   * @param network Ethereum network to connect to (eg. 'ropsten', 'mainnet')
   * @param htlcContract Object containing HashedTimelock contract details:
   *          abi: contract interface
   *          deployed: { ropsten: '0xabc...', 'mainnet: 0x123...', etc.
   */
  constructor(rpcAddr, network, htlcContract) {
    if (!has(htlcContract.deployed, network))
      throw new Error(
        `No contract deployment address found for HashedTimelock on ` +
          `network [${network}].`
      )

    const htlcAddr = htlcContract.deployed[network]

    if (!Web3Utils.isAddress(htlcAddr))
      throw new Error(
        `HashedTimelock deployment address [${htlcAddr}] ` +
          `is not a valid contract address`
      )

    this.web3Eth = new Web3Eth(rpcAddr)
    this.htlc = new this.web3Eth.Contract(htlcContract.abi, htlcAddr)
  }

  /**
   * Set up a new hashed timelock contract.
   */
  createHashedTimelockContract(hashX, sellerAddr, buyerAddr, amount, locktime) {
    const ethHashX = hashX.startsWith('0x') ? hashX : '0x' + hashX
    // return this.htlc.methods
    //   .newContract(buyerAddr, ethHashX, locktime)
    //   .send({
    //     from: sellerAddr,
    //     value: ethToWei(amount),
    //   })
    //   .on('error', error => onErrorCallback(error))
    //   .on('transactionHash', txHash =>
    //     console.info(`tx hash[newContract]: ${txHash}`)
    //   )
    //   .on('receipt', receipt => onSuccessCallback(txRetVal(receipt)))
    return this.htlc.methods
      .newContract(buyerAddr, ethHashX, locktime)
      .send({
        from: sellerAddr,
        value: ethToWei(amount),
      })
      .on('transactionHash', txHash =>
        console.info(`tx hash[newContract]: ${txHash}`)
      )
  }

  /**
   * Buyer withdraws the funds revealing the preimage for hash(x)
   */
  buyerWithdraw(
    contractId,
    preimage,
    buyerAddr,
    onSuccessCallback,
    onErrorCallback
  ) {
    this.htlc.methods
      .withdraw(contractId, preimage)
      .send({
        from: buyerAddr,
      })
      .on('error', error => onErrorCallback(error))
      .on('transactionHash', txHash =>
        console.info(`tx hash[withdraw]: ${txHash}`)
      )
      .on('receipt', receipt => onSuccessCallback(receipt))
  }

  /**
   * Seller claims refund assuming the transfer did not complete.
   * Seller can not call this before the timelock has expired.
   */
  sellerRefund(contractId, sellerAddr, onSuccessCallback, onErrorCallback) {
    this.htlc.methods
      .refund(contractId)
      .send({from: sellerAddr})
      .on('error', error => onErrorCallback(error))
      .on('transactionHash', txHash =>
        console.info(`tx hash[refund]: ${txHash}`)
      )
      .on('receipt', receipt => onSuccessCallback(receipt))
  }

  getContract(contractId) {
    return this.htlc.methods
      .getContract(contractId)
      .call()
      .then(c => contractArrToObj(c))
  }
}

export default Ethereum
