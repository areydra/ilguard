import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    heliusApiKey: process.env.HELIUS_API_KEY || '',
  },
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY || '',
  },
  pyth: {
    endpoint: process.env.PYTH_ENDPOINT || 'https://hermes.pyth.network',
  },
  jito: {
    blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL || '',
    tipAccount: process.env.JITO_TIP_ACCOUNT || '',
  },
  app: {
    port: parseInt(process.env.PORT || '3000'),
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};

export default config;
