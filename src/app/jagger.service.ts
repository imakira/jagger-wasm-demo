import { Injectable } from '@angular/core';
import { JAGGER_MESSAGE, RawToken, REQUEST, Token, TokenizeResult, UnzipProgress } from './constants';
import { parseFeature, splitText } from "./utils";

class SimpleMessageWrapper {
  private buffer: Map<any, Array<any>>;
  private listeners: Map<any, (args: any) => void>;

  constructor() {
    this.buffer = new Map();
    this.listeners = new Map();
  }

  sendMessage(id: any, data: any) {
    if (this.listeners.has(id)) {
      (this.listeners.get(id)!)(data)
    } else {
      if (!this.buffer.has(id)) {
        this.buffer.set(id, []);
      }
      this.buffer.get(id)!.push(data);
    }
  }

  setListener(id: any, callback: (data: any) => void) {
    if (this.buffer.has(id)) {
      for (let message of this.buffer.get(id)!) {
        callback(message);
        this.buffer.set(id, []);
      }
    }
    this.listeners.set(id, callback);
  }

  removeListener(id: any) {
    this.listeners.delete(id);
  }
}

class SimpleWorkerWrapper {
  private messageId = 0;
  private messageWrapper = new SimpleMessageWrapper();
  private pendingRequest: Map<number, (data: any) => void> = new Map();

  constructor(private worker: Worker) {
    this.messageWrapper.setListener(JAGGER_MESSAGE.RESPONSE, (resp: any) => {
      if (this.pendingRequest.has(resp.messageId)) {
        this.pendingRequest.get(resp.messageId)!(resp.data);
        this.pendingRequest.delete(resp.messageId);
      }
    });
    worker.onmessage = ({ data }) => {
      this.messageWrapper.sendMessage(data.id, data.data);
    };
  }

  async request<T>(op: REQUEST, data: any): Promise<T> {
    let messageId = this.messageId++;
    let tmp = new Promise<T>((resolve) => {
      this.pendingRequest.set(messageId, resolve);
    })
    this.worker.postMessage({
      id: JAGGER_MESSAGE.REQUEST,
      requestId: op,
      messageId: messageId++, data: data
    });
    return await tmp;
  }

  subscribe(id: any, callback: (arg: any) => void) {
    this.messageWrapper.setListener(id, callback);
  }

  unsubscribe(id: any) {
    this.messageWrapper.removeListener(id);
  }

  sendMessage(id: any, data: any = undefined) {
    this.worker.postMessage({ id: id, data: data });
  }
}

@Injectable({
  providedIn: 'root'
})
export class JaggerService {
  // private worker: Worker;
  public wasmLoaded: Promise<void>;
  private workerWrapper: SimpleWorkerWrapper;

  constructor() {
    const worker = new Worker(new URL('./app.worker', import.meta.url), { type: 'module' });
    this.workerWrapper = new SimpleWorkerWrapper(worker);
    this.wasmLoaded = new Promise((resolve) => {
      this.workerWrapper.subscribe(JAGGER_MESSAGE.JAGGER_INITED, () => {
        resolve();
      })
    });
  }

  async unzipModel(blob: Blob, progress: (arg: UnzipProgress) => void) {
    await new Promise<void>((resolve) => {
      this.workerWrapper.subscribe(JAGGER_MESSAGE.UNZIP_PROGRESS, progress);
      this.workerWrapper.subscribe(JAGGER_MESSAGE.UNZIP_DONE, () => {
        resolve();
        this.workerWrapper.unsubscribe(JAGGER_MESSAGE.UNZIP_DONE);
      });
      this.workerWrapper.sendMessage(JAGGER_MESSAGE.UNZIP, { blob: blob });
    })
  }

  async loadModel() {
    return new Promise<void>((resolve) => {
      this.workerWrapper.subscribe(JAGGER_MESSAGE.LOAD_MODEL_DONE, () => {
        resolve();
        this.workerWrapper.
          unsubscribe(JAGGER_MESSAGE.LOAD_MODEL_DONE);
      });
      this.workerWrapper.sendMessage(JAGGER_MESSAGE.LOAD_MODEL);
    })
  }

  async rawTokenizeSentence(line: string): Promise<RawToken[]> {
    return await this.workerWrapper.request(REQUEST.TOKENIZE_LINE, { line: line });
  }

  async tokenizeSentence(line: string): Promise<Token[]> {
    const rawTokens: RawToken[] = await this.rawTokenizeSentence(line);
    const tokens: Token[] = new Array(rawTokens.length);
    let wordPosition = 0;
    for (let i = 0; i < rawTokens.length; i++) {
      let surface = rawTokens[i].surface;
      tokens[i] = {
        surface: surface,
        wordPosition: wordPosition,
        ...parseFeature(rawTokens[i].feature),
      };
      wordPosition += surface.length;
    }
    return tokens;
  }

  async tokenize(text: string) {
    const tmp = splitText(text);
    return {
      rawText: text,
      sentences: await Promise.all(tmp.sentences.map(async (sentence) => {
        return { ...sentence, tokens: await this.tokenizeSentence(sentence.text) };
      }))
    }
  }
}
