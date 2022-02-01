import { ERC20Result, NFTResult } from "./tokens";

import { AuthRequestData } from "./auth";

export enum SignalingEventType {
  WebRTCNegotiation = "WebRTCNegotiation",
  JoinChatEvent = "JoinChatEvent",
  SelfTokensEvent = "SelfTokensEvent",
  OtherParticipantTokensEvent = "OtherParticipantTokensEvent",
  WalletNotProvided = "WalletNotProvided",
}

export interface WebRTCNegotiationEvent {
  type: SignalingEventType.WebRTCNegotiation;
  encodedIv: string;
  encodedIceNegotiation: string;
  /*
  chatId: string;
  description: RTCSessionDescription | null;
  candidate: RTCIceCandidate | null;
  */
}

export function isWebRTCNegotiationEvent(signalingEvent: any): signalingEvent is WebRTCNegotiationEvent {
  return (
    typeof signalingEvent === "object" &&
    "type" in signalingEvent &&
    signalingEvent.type === SignalingEventType.WebRTCNegotiation
  );
}

export interface JoinChatEvent {
  type: SignalingEventType.JoinChatEvent;
  chatId: string;
  participants: string[];
  authRequest: { message: string; signature: string; authRequestData: AuthRequestData }[];
}
export function isJoinChatEvent(signalingEvent: any): signalingEvent is JoinChatEvent {
  return (
    typeof signalingEvent === "object" &&
    "type" in signalingEvent &&
    signalingEvent.type === SignalingEventType.JoinChatEvent
  );
}

export interface SelfTokensEvent {
  type: SignalingEventType.SelfTokensEvent;
  allNFT: NFTResult[];
  allERC20: ERC20Result[];
  walletENS: string;
}

export function isSelfTokensEvent(signalingEvent: any): signalingEvent is SelfTokensEvent {
  return (
    typeof signalingEvent === "object" &&
    "type" in signalingEvent &&
    signalingEvent.type === SignalingEventType.SelfTokensEvent
  );
}

export interface OtherParticipantTokensEvent {
  type: SignalingEventType.OtherParticipantTokensEvent;
  walletAddress: string;
  walletENS: string;
  allNFT: NFTResult[];
  allERC20: ERC20Result[];
  matchedNFTs: string[];
}

export function isOtherParticipantTokensEvent(signalingEvent: any): signalingEvent is OtherParticipantTokensEvent {
  return (
    typeof signalingEvent === "object" &&
    "type" in signalingEvent &&
    signalingEvent.type === SignalingEventType.OtherParticipantTokensEvent
  );
}

export interface WalletNotProvidedEvent {
  type: SignalingEventType.WalletNotProvided;
}
export function isWalletNotProvidedEvent(signalingEvent: any): signalingEvent is WalletNotProvidedEvent {
  return (
    typeof signalingEvent === "object" &&
    "type" in signalingEvent &&
    signalingEvent.type === SignalingEventType.WalletNotProvided
  );
}

export function isSignalingEvent(signalingEvent: any): signalingEvent is SignalingEvent {
  return typeof signalingEvent === "object" && "type" in signalingEvent;
}

export type SignalingEvent =
  | WebRTCNegotiationEvent
  | JoinChatEvent
  | SelfTokensEvent
  | OtherParticipantTokensEvent
  | WalletNotProvidedEvent;

export enum SignalingRequestType {
  WebRTCNegotiation = "WebRTCNegotiation",
  EnterPool = "EnterPool",
  LeavePool = "LeavePool",
  UpdateMatchCriteria = "UpdateMatchCriteria",
}

export interface WebRTCNegotiationRequest {
  type: SignalingRequestType.WebRTCNegotiation;
  walletAddress: string;
  encodedIv: string;
  encodedIceNegotiation: string;
  /*
  chatId: string;
  description: RTCSessionDescription | null;
  candidate: RTCIceCandidate | null;
  */
}

export interface EnterPoolRequest {
  type: SignalingRequestType.EnterPool;
  excludeList: string[];
  matchTokens: boolean;
}

export interface MatchCriteria {
  excludeList: string[];
  matchTokens: boolean;
}

export interface UpdateMatchCriteria {
  type: SignalingRequestType.UpdateMatchCriteria;
  matchCriteria: MatchCriteria;
}

export interface LeavePoolRequest {
  type: SignalingRequestType.LeavePool;
}

export function isSignalingRequest(signalingRequest: any): signalingRequest is SignalingRequest {
  return typeof signalingRequest === "object" && "type" in signalingRequest;
}

export type SignalingRequest = WebRTCNegotiationRequest | EnterPoolRequest | LeavePoolRequest | UpdateMatchCriteria;
