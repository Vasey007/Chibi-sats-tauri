const fs = require('fs');
const data = JSON.parse(fs.readFileSync('symbols_utf8.json', 'utf8'));
const fiatSuffixes = ['EUR', 'BRL', 'TRY', 'RUB', 'GBP', 'UAH', 'KZT', 'PLN', 'RON', 'ARS'];
const symbols = data.result.list
    .map(s => s.symbol)
    .filter(symbol => symbol.startsWith('BTC') && fiatSuffixes.some(fiat => symbol.endsWith(fiat)));
console.log(symbols);
