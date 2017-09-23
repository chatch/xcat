import program from 'commander'

// commands below are implemented in seperate file. eg. new -> cli-new.js
program
  .description('Stellar tool for doing cross chain atomic trades')
  .command('new <trade.json>', 'Initiate a new trade given a trade.json file')
  .alias('n')
  .command('import <trade.json>', 'Import a trade from a trade.json file')
  .alias('i')
  .command('status <tradeId>', 'Import a trade from a trade.json file')
  .alias('s')
  .parse(process.argv)
