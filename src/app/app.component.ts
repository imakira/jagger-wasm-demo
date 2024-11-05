import {Location, LocationStrategy} from '@angular/common';
import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { CommonModule, NgFor, NgStyle } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { JaggerService } from './jagger.service';
import { LoadingStatus, LoadModelStep, LoadStep, TokenizeResult } from './constants';
import { Form, FormsModule, NgForm } from '@angular/forms';
import {MatTableModule} from '@angular/material/table';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import {  trigger,  state,  style,  animate,  transition } from '@angular/animations';

interface RowIndex {
  sentenceIndex: number;
  rowIndex: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatCardModule, MatSelectModule, MatInputModule, MatFormFieldModule, MatButtonModule, MatIconModule, MatListModule, NgFor, NgStyle, FormsModule, CommonModule, MatTableModule, MatButtonToggle, MatButtonToggleGroup ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [
    trigger("text-show", [
      state('hidden',
        style({
          opacity: "0",
          visibility: "hidden",
        })),
      state('shown',
        style({
          opacity: "1",
          visibility:  "visible"
        })),
      transition('* => shown', [animate('0.5s')]),
    ]),
    trigger("element-show", [
      state('hidden',
        style({
          height: 0,
          visibility: 'hidden',
          display: 'none',
        })),
      state('shown',
        style({
          
        })),
      transition('* => *', [animate('1s')]),
    ]),
  ],
})


export class AppComponent {
  title = 'jagger-wasm-demo';
  text = "";
  LoadingStatus = LoadingStatus;
  baseHref: string;
  modelLoadingSteps: Array<LoadModelStep> = [{
    id: LoadStep.download,
    annot: "Downloading Model",
    progress: "",
    status: LoadingStatus.PROCESSING,
  },
  {
    id: LoadStep.unzip,
    annot: "Decompressing Model",
    progress: "",
    status: LoadingStatus.PENDING,
  },
  {
    id: LoadStep.loading,
    annot: "Loading Model",
    progress: "",
    status: LoadingStatus.PENDING,
  }
  ];

  displayColumns = ['surface', 'pos', 'posDetail1', 'posDetail2', 'conjugationType', 'basicForm', 'pronunciation', 'note'];

  activeRow: RowIndex | undefined;

  tokenizeResult?: TokenizeResult = undefined;

  @ViewChild("inputForm")
  inputForm?: NgForm;

  @ViewChild("outputArea")
  outputArea?: ElementRef;

  constructor(private httpClient: HttpClient, private jagger: JaggerService, private location: Location, private readonly locationStrategy: LocationStrategy) {
      this.baseHref = `${document.location.origin}/${this.locationStrategy.getBaseHref()}`;
  }
  ngOnInit() {
    this.jagger.wasmLoaded.then((_) => {
      console.log("wasm inited");
    });
    this.loadingModel();
    // this.inputForm?.disable();
  }

  async onSubmit(){
    this.tokenizeResult =  await this.jagger.tokenize(this.text)
  }

  isModelLoaded(){
    return this.modelLoadingSteps[this.modelLoadingSteps.length-1].status==LoadingStatus.DONE;
  }

  tokenOnClick(sentenceIndex: number, rowIndex:  number){
    const container =  this.outputArea?.nativeElement.querySelectorAll(".sentence-container")[sentenceIndex]
    const row = container?.querySelectorAll(".tokens .token-row")[rowIndex]
    const header = container?.querySelector(".sentence-tokens");
    const rect = header?.getBoundingClientRect();
    const offset = rect?.bottom-rect.top;
    if(row){
      window.scrollTo({
        top: row.getBoundingClientRect().top+window.scrollY-offset,
        behavior: 'smooth',
      });
    }
    this.activeRow = {sentenceIndex: sentenceIndex, rowIndex: rowIndex};
  }

  rowOnMouseEnter(sentenceIndex: number, rowIndex: number){
    this.activeRow = {sentenceIndex: sentenceIndex, rowIndex: rowIndex};
  }

  rowOnMouseLeave(sentenceIndex:  number, rowIndex: number){
    if(this.activeRow && this.activeRow.sentenceIndex == sentenceIndex && this.activeRow.rowIndex == rowIndex){
      this.activeRow = undefined;
    }
  }

  private async downloadModel() {
    let resolve: (arg1: Blob) => void;
    const promise = new Promise<Blob>((tmp) => {
      resolve = tmp;
    })
    this.httpClient.get(`${this.baseHref}kwdlc.zip`, { reportProgress: true, observe: 'events', responseType: 'blob' })
      .subscribe(event => {
        switch (event.type) {
          case HttpEventType.DownloadProgress:
            this.modelLoadingSteps[LoadStep.download].progress = `${(event.loaded/(1024*1024)).toFixed(1)}/${event.total && (event.total/(1024*1024)).toFixed(1)} MB`;
            break;
          case HttpEventType.Response:
            if (event.body == null) {
              throw new Error("Downloading Model erorr, resp is null");
            }
            resolve(event.body);
            break;
        }
      })
    return promise;
  }

  private async unzipModel(blob: Blob) {
    this.modelLoadingSteps[LoadStep.unzip].status = LoadingStatus.PROCESSING;
    await this.jagger.unzipModel(blob, (progress)=>{
      let finished = [...progress.values()].filter((fileprogress)=>fileprogress.done).length;
      this.modelLoadingSteps[LoadStep.unzip].progress = `${finished}/${progress.size}`
    })
    this.modelLoadingSteps[LoadStep.unzip].status = LoadingStatus.DONE;
  }

  private async loadingJaggerModel(){
    this.modelLoadingSteps[LoadStep.loading].status = LoadingStatus.PROCESSING;
    this.modelLoadingSteps[LoadStep.loading].progress = "Loading"
    await this.jagger.loadModel();
    this.modelLoadingSteps[LoadStep.loading].status = LoadingStatus.DONE;
  }

  private async loadingModel() {
    await this.jagger.wasmLoaded;
    let blob: Blob = await this.downloadModel();
    this.modelLoadingSteps[LoadStep.download].status = LoadingStatus.DONE;
    await this.unzipModel(blob);
    await this.loadingJaggerModel();
  }
}
