import axios from 'axios';

const API_URLS = {
  testnet: 'https://api.whatsonchain.com/v1/bsv/test',
  mainnet: 'https://api.whatsonchain.com/v1/bsv/main',
};

export const getUTXOs = async (address: string, network: 'testnet' | 'mainnet' = 'testnet') => {
  const apiUrl = API_URLS[network];
  try {
    const response = await axios.get(`${apiUrl}/address/${address}/unspent/all`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching UTXOs: ${error}`);
  }
};

export const broadcastTransaction = async (rawTx: string, network: 'testnet' | 'mainnet' = 'testnet') => {
  const apiUrl = API_URLS[network];
  try {
    const response = await axios.post(`${apiUrl}/tx/raw`, { txhex: rawTx }, { timeout: 10000 });
    return response.data;
  } catch (error) {
    throw new Error(`Error broadcasting transaction: ${error}`);
  }
};

export const getRawTransaction = async (tx_hash: string, network: 'testnet' | 'mainnet' = 'testnet') => {
  const apiUrl = API_URLS[network];
  try {
    const response = await axios.get(`${apiUrl}/tx/${tx_hash}/hex`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching raw transaction: ${error}`);
  }
};
