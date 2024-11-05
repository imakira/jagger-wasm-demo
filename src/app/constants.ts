import { SplitedSentence } from "./utils";

export enum JAGGER_MESSAGE {
  JAGGER_INITED,
  UNZIP,
  UNZIP_PROGRESS,
  UNZIP_DONE,
  LOAD_MODEL,
  LOAD_MODEL_DONE,
  REQUEST,
  RESPONSE,
}

export enum REQUEST {
  TOKENIZE_LINE
}

export interface TokenizeLineReq {
  line: string;
}

export interface TokenizeLineResp {
  result: Array<RawToken>;
}


export interface RawToken {
  surface: string;
  feature: string;
}

export interface TokenFeatureSet {
  pos: string;
  posDetail1: string;
  posDetail2: string;
  conjugationType: string;
  basicForm: string;
  pronunciation: string | undefined;
  note?: string | undefined;
}
export interface Token extends TokenFeatureSet {
  surface: string;
  wordPosition: number;
}

export interface TokenizedSentence extends SplitedSentence {
  tokens: Token[];
}

export interface TokenizeResult {
  rawText: string;
  sentences: TokenizedSentence[];
}

export interface UnzipData{
  blob: Blob
}

export interface FileProgress{
  progess?: number;
  total?: number;
  done?: boolean;
}
export type UnzipProgress = Map<string, FileProgress>;

export enum LoadingStatus {
  PENDING, PROCESSING, DONE
}
export enum LoadStep {
  download, unzip, loading,
}
export interface LoadModelStep {
  id: LoadStep;
  progress?: string;
  annot: string;
  status: LoadingStatus;
}

