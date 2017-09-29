import program from 'commander'

// commands below are implemented in seperate file. eg. new -> cli-new.js
program
  .description('Stellar tool for doing cross chain atomic trades')
  .command('new <trade.json>', 'Initiate a new trade given a trade.json file')
  .alias('n')
  .command('import <trade.json>', 'Import a trade from a trade.json file')
  .alias('i')
  .command('status <tradeId>', 'Check status of a trade')
  .alias('s')
  .command(
    'verifysig <trade.json> <trade.json.sig>',
    'Verify signature for a trade.json'
  )
  .alias('v')
  .command('refund <tradeId>', 'Claim a refund if timelock has expired')
  .alias('r')
  .parse(process.argv)
