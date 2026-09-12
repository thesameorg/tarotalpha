/**
 * Spot pairs the terminal offers, in market-cap order with BTC and ETH first. Every symbol was checked against
 * Binance exchangeInfo (status TRADING) and every icon is a local file; how the list and the icons were assembled
 * and how to add a coin: docs/assets.md.
 */
export interface Coin {
  symbol: string;
  base: string;
  name: string;
  icon: string;
}

const coin = (base: string, name: string): Coin => ({
  symbol: `${base}USDT`,
  base,
  name,
  icon: `/coins/${base.toLowerCase()}.svg`,
});

export const COINS: readonly Coin[] = [
  coin("BTC", "Bitcoin"),
  coin("ETH", "Ethereum"),
  coin("BNB", "BNB"),
  coin("XRP", "XRP"),
  coin("SOL", "Solana"),
  coin("TRX", "TRON"),
  coin("ZEC", "Zcash"),
  coin("DOGE", "Dogecoin"),
  coin("LINK", "Chainlink"),
  coin("ADA", "Cardano"),
  coin("XLM", "Stellar"),
  coin("BCH", "Bitcoin Cash"),
  coin("LTC", "Litecoin"),
  coin("GRAM", "Gram"),
  coin("UNI", "Uniswap"),
  coin("AVAX", "Avalanche"),
  coin("HBAR", "Hedera"),
  coin("NEAR", "NEAR Protocol"),
  coin("SUI", "Sui"),
  coin("SHIB", "Shiba Inu"),
  coin("TAO", "Bittensor"),
  coin("ASTER", "Aster"),
  coin("AAVE", "Aave"),
  coin("DOT", "Polkadot"),
  coin("WLFI", "World Liberty Financial"),
  coin("ONDO", "Ondo"),
  coin("PUMP", "Pump.fun"),
  coin("MORPHO", "Morpho"),
  coin("ICP", "Internet Computer"),
  coin("WLD", "Worldcoin"),
  coin("ENA", "Ethena"),
  coin("PEPE", "Pepe"),
  coin("SKY", "Sky"),
  coin("ETC", "Ethereum Classic"),
  coin("POL", "Polygon"),
  coin("ARB", "Arbitrum"),
  coin("QNT", "Quant"),
  coin("ATOM", "Cosmos"),
  coin("ALGO", "Algorand"),
  coin("JST", "JUST"),
  coin("NEXO", "NEXO"),
  coin("JUP", "Jupiter"),
  coin("RENDER", "Render"),
  coin("DASH", "Dash"),
  coin("CAKE", "PancakeSwap"),
  coin("VET", "VeChain"),
  coin("FIL", "Filecoin"),
  coin("ETHFI", "Ether.fi"),
  coin("INJ", "Injective"),
  coin("TRUMP", "Official Trump"),
];
