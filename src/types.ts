import BigNumber from "bignumber.js";
import { Address, Transaction } from "ton";
import { DaoRoles, MetadataArgs, ProposalMetadata, ProposalResult } from "ton-vote-contracts-sdk";


export type ProposalResults = {[key: string]: any}

export interface Vote {
  address: string;
  vote: string | string[];
  votingPower: string;
  timestamp: number;
  hash: string;
}

export type VotingPower = { [key: string]: string };

export type RawVote = { timestamp: number; vote: string; hash: string };
export type RawVotes = { [key: string]: RawVote };

export type EndpointsArgs = {
  clientV2Endpoint?: string;
  clientV4Endpoint?: string;
  apiKey?: string;
};


interface daoMetadata extends MetadataArgs{
  dns?: string
}
export interface Dao {
  daoAddress: string;
  daoId?: number;
  daoMetadata: daoMetadata;
  daoRoles: DaoRoles;
  daoProposals: string[];
}

export interface DaoProposal {
  startDate: number;
  endDate: number;
  title: string;
  description: string;
  ownerAvatar: string;
  ownerAddress: string;
  contractAddress: string;
  id: string;
}

export enum ProposalStatus {
  CLOSED = "ENDED",
  NOT_STARTED = "NOT_STARTED",
  ACTIVE = "ACTIVE",
}

export interface SelectOption {
  text: string;
  value: string;
}

export interface Proposal {
  votingPower?: VotingPower;
  votes: Vote[];
  proposalResult: ProposalResults;
  maxLt?: string;
  transactions?: Transaction[];
  metadata?: ProposalMetadata;
  daoAddress?: string;
  hardcoded?: boolean;
  url?: string;
  sumCoins?: { [key: string]: BigNumber | string };
  sumVotes?: {[key: string]: number};
}

export type InputType =
  | "text"
  | "url"
  | "textarea"
  | "date"
  | "upload"
  | "editor"
  | "checkbox"
  | "address"
  | "image"
  | "radio"
  | "select"
  | "list"
  | 'custom'

export type ListInputOption = {
  key: string;
  value: string | number;
};
export interface InputArgs {
  label: string;
  type: InputType;
  name: string;
  defaultValueClick?: string;
  rows?: number;
  min?: number;
  max?: number;
  tooltip?: string;
  required?: boolean;
  listOptions?: ListInputOption[];
  limit?: number;
  placeholder?: string;
  isMarkdown?: boolean;
  disabled?: boolean;
  default?: string | number;
}



export interface Endpoints {
  clientV2Endpoint?: string;
  clientV4Endpoint?: string;
  apiKey?: string;
}



export type TooltipPlacement =
  | "bottom"
  | "left"
  | "right"
  | "top"
  | "bottom-end"
  | "bottom-start"
  | "left-end"
  | "left-start"
  | "right-end"
  | "right-start"
  | "top-end"
  | "top-start";



export interface FormArgs {
  title: string;
  subTitle?: string;
  inputs: InputArgs[];
}