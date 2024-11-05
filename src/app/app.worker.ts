/// <reference lib="webworker" />

import { FileProgress, JAGGER_MESSAGE, REQUEST, TokenizeLineReq, UnzipData, UnzipProgress } from "./constants";
import { configure, BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter, } from "@zip.js/zip.js";
let module = require("jagger/jagger-binding.js");

function streamWrapper(fsStream: any) {
  return new WritableStream({
    write(chunk) {
      let FS = (globalThis as any).FS;
      FS.write(fsStream, chunk, 0, chunk.length);
    },
    close() {
      let FS = (globalThis as any).FS;
      FS.close(fsStream);
    },
    abort() {
      throw new Error(`stream ${fsStream} isAborted`)
    },
  });
}

async function unzip(blob: Blob, dest: string, onprogress: ((arg: UnzipProgress) => void) | undefined = undefined) {
  const zipFileReader = new BlobReader(blob);
  const zipReader = new ZipReader(zipFileReader);
  let entries = await zipReader.getEntries();
  let FS = (globalThis as any).FS;
  let fileNames = entries.filter((entry) => !entry.directory).map((entry) => entry.filename);
  let progressStatus: UnzipProgress = new Map<string, FileProgress>;
  if (onprogress) {
    for (let filename of fileNames) {
      progressStatus.set(filename, {});
    }
  }
  if (dest != "") {
    let res = FS.analyzePath(dest);
    if (!res.exists) {
      FS.mkdir(dest);
    }
  }
  for (let entry of entries) {
    if (entry.directory) {
      FS.mkdir(dest + entry.filename);
    } else {
      let stream = FS.open(dest + entry.filename, "w+");
      if (entry.getData) {
        await entry.getData(streamWrapper(stream), {
          onstart(total) {
            if (onprogress) {
              progressStatus.get(entry.filename)!.total = total;
              onprogress(progressStatus)
              return undefined;
            }
          }, onprogress(progress, total) {
            if (onprogress) {
              progressStatus.get(entry.filename)!.progess = progress;
              progressStatus.get(entry.filename)!.total = total;
              onprogress(progressStatus);
              return undefined;
            }
          }, onend(_) {
            progressStatus.get(entry.filename)!.done = true;
            if (onprogress) {
              onprogress(progressStatus);
            }
            return undefined;
          }
        });
      } else {
        throw new Error(`entry ${entry} have not avaiable data`);
      }
    }
  }
  await zipReader.close();
}

class JaggerWorker {
  private module: any | undefined;
  private jagger: any | undefined;
  constructor() {
    module().then((mod: any) => {
      postMessage({ id: JAGGER_MESSAGE.JAGGER_INITED });
      (globalThis as any).FS = mod.FS;
      this.module = mod;
      this.jagger = new this.module.Jagger();
    })
    addEventListener('message', ({ data }) => {
      switch (data.id) {
        case JAGGER_MESSAGE.UNZIP:
          this.handleUnzip(data.data);
          break;
        case JAGGER_MESSAGE.LOAD_MODEL:
          this.handleLoadModel();
          break;
        case JAGGER_MESSAGE.REQUEST:
          switch(data.requestId){
            case REQUEST.TOKENIZE_LINE:
              this.handleTokenizeLine(data.messageId, data.data);
              break;
          }
          break;
      }
    });
  }
  private handleUnzip(data: UnzipData) {
    let promise = unzip(data.blob, "demo/", (progress: UnzipProgress) => {
      postMessage({ id: JAGGER_MESSAGE.UNZIP_PROGRESS, data: progress });
    });
    promise.then(() => {
      postMessage({ id: JAGGER_MESSAGE.UNZIP_DONE });
    })
  }
  private handleLoadModel(){
    this.jagger.load_model("/demo/kwdlc/patterns");
    postMessage({id: JAGGER_MESSAGE.LOAD_MODEL_DONE});
  }
  private handleTokenizeLine(messageId:number, data: TokenizeLineReq){
    let tmp = this.jagger.tokenize(data.line);
    let result = Array(tmp.size());
    for(let i = 0; i < tmp.size(); i++){
      result[i] = ({surface: tmp.get(i).surface(), feature: tmp.get(i).feature()});
    }
    postMessage({
      id: JAGGER_MESSAGE.RESPONSE,
      data: {
        data: result,
        messageId: messageId,
      }});
  }
}

new JaggerWorker();
