/*
token_address*	string
example: 0x057Ec652A4F150f7FF94f089A38008f49a0DF88e
The address of the contract of the NFT

token_id*	string
example: 15
The token id of the NFT

contract_type*	string
example: ERC721
The type of NFT contract standard

owner_of*	string
example: 0x057Ec652A4F150f7FF94f089A38008f49a0DF88e
The address of the owner of the NFT

block_number*	string
example: 88256
The blocknumber when the amount or owner changed

block_number_minted*	string
example: 88256
The blocknumber when the NFT was minted

token_uri	string
The uri to the metadata of the token

metadata	string
The metadata of the token

synced_at	string
when the metadata was last updated

amount	string
example: 1
The number of this item the user owns (used by ERC1155)

name*	string
example: CryptoKitties
The name of the Token contract

symbol*	string
example: RARI
*/

export interface NFTResult {
  token_address: string;
  token_id: string;
  contract_type: string;
  owner_of?: string;
  block_number?: string;
  block_number_minted?: string;
  token_uri: string;
  metadata: string;
  synced_at: string;
  amount: number;
  name?: string;
  symbol?: string;
  is_valid: number;
  syncing: number;
  frozen: number;
}

export interface NftCollection {
  status: string;
  total: number;
  page: number;
  page_size: number;
  result: NFTResult[];
}

export interface ERC20Result {
  token_address: string;
  name?: string;
  symbol?: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
}
