import { F10 } from "@angular/cdk/keycodes";
import { Token, TokenFeatureSet } from "./constants";

export interface SplitedSentence {
  text: string;
  sentencePosition: number;
}
export interface SplitTextResult {
  rawText: string;
  sentences: SplitedSentence[];
}

export function parseFeature(feature: string): TokenFeatureSet {
  let features = feature.split(",");
  return  {
    pos: features[0],
    posDetail1: features[1],
    posDetail2: features[2],
    conjugationType: features[3],
    basicForm: features[4], 
    pronunciation: features[5],
    note: features[6],
  };
}

export function splitText(rawText: string): SplitTextResult{
  let text = rawText;
  const result: SplitedSentence[] = [];
  const regex = /[、。，『 』「 」\n]/g;
  let puncPos = 0;
  let start = 0;
  
  while(true){
    puncPos=text.search(regex);
    if(puncPos == -1){
      puncPos = text.length;
    }
    let sentenceStart = 0;
    while(sentenceStart<puncPos && text[sentenceStart].match(/[ \u3000]/)){
      sentenceStart++;
    }
    if(puncPos>sentenceStart){
      result.push({text: text.substring(sentenceStart, puncPos), sentencePosition: start});
    }
    if(puncPos==text.length){
      break;
    }
    text = text.substring(puncPos+1);
    start+=(puncPos)
  }
  return {rawText: rawText ,sentences: result};
}
