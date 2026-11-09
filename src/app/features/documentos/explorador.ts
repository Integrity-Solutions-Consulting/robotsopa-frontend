import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Account, Api } from '../../core/api';
interface Folder { year:number; month:number; type:string; count:number }
interface Tree { folders:Folder[]; reports:{year:number;month:number}[] }
interface Item { id:string; type:string; number?:string; accessKey:string; issued:string; authorizedAt?:string; authorization?:string; issuerName?:string; issuerTaxId?:string; recipient?:string; identification?:string; subtotal?:number; discount?:number; taxes?:number; total?:number; status:string; warning?:string; pdfRegistered:boolean; xmlRegistered:boolean }
interface ZipJob {id:string;status:string;message?:string;done:number;total:number;issues:string[];warnings:string[]}
@Component({ selector:'sri-explorador', imports:[FormsModule], template:`
<section class="card"><h2>Mis documentos</h2>
<label>RUC<select aria-label="RUC" [ngModel]="account" (ngModelChange)="chooseAccount($event)"><option value="">Seleccione un RUC</option>@for(a of accounts();track a.id){<option [value]="a.id">{{a.taxId || a.id}} · {{a.name}}</option>}</select></label>
@if(account){<div class="actions"><button class="secondary" (click)="year=0;month=0;type='';selected.set(null)">RUC</button>@if(year){<button class="secondary" (click)="month=0;type='';selected.set(null)">{{year}}</button>}@if(month){<button class="secondary" (click)="type='';selected.set(null)">{{monthName(month)}}</button>}@if(type){<span>{{type}}</span>}</div>
<div class="actions"><label>Formatos del ZIP<select [(ngModel)]="zipFormats"><option value="auto">Según registros disponibles</option><option value="pdf">PDF</option><option value="xml">XML</option><option value="both">PDF y XML</option></select></label><button class="secondary" [disabled]="zipBusy() || type==='Reportes'" (click)="prepareZip()">Preparar ZIP de esta carpeta</button></div>
@if(zip();as z){<p>ZIP: {{z.status}} · {{z.done}} / {{z.total}} archivos</p>@if(z.message){<p>{{z.message}}</p>}@if(z.status==='Preparando' && !zipBusy()){<button class="secondary" (click)="refreshZip(z.id)">Consultar estado</button>}@if(z.status==='Listo'){<a [href]="zipUrl(z.id)">Descargar ZIP preparado</a>}@if(z.warnings.length){<p>Disponibilidad histórica no comprobada:</p><ul>@for(warning of z.warnings;track $index){<li>{{warning}}</li>}</ul>}@if(z.issues.length){<p>No se preparó un paquete completo:</p><ul>@for(issue of z.issues;track $index){<li>{{issue}}</li>}</ul>}}
@if(!year){<h3>Años</h3><div class="actions">@for(y of years();track y){<button class="secondary" (click)="year=y">{{y}}</button>}@empty{<p>Sin documentos registrados.</p>}</div>}
@else if(!month){<h3>Meses</h3><div class="actions">@for(m of months();track m){<button class="secondary" (click)="month=m">{{monthName(m)}}</button>}</div>}
@else if(!type){<h3>Tipos</h3><div class="actions">@for(f of folders();track f.type){<button class="secondary" (click)="openType(f.type)">{{f.type}} ({{f.count}})</button>}@if(hasReport()){<button class="secondary" (click)="type='Reportes'">Reportes</button>}</div>}
@else if(type==='Reportes'){<p>Reporte mensual registrado.</p><a [href]="reportUrl()">Descargar Excel</a>}
@else {<div class="filters"><label>Buscar<input [(ngModel)]="search" placeholder="Emisor, receptor, número o clave" /></label><label>Ordenar<select [(ngModel)]="sort"><option value="date">Fecha</option><option value="number">Número</option><option value="total">Total</option></select></label><button (click)="page=1;loadItems()">Aplicar</button></div>
<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Número</th><th>Emisor</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>@for(d of items();track d.id){<tr><td>{{d.issued}}</td><td>{{d.number || 'No disponible'}}</td><td>{{d.issuerName || 'No disponible'}}</td><td>{{d.total ?? 'No disponible'}}</td><td>{{d.status}}</td><td><button class="secondary" (click)="selected.set(d)">Ver detalle</button></td></tr>}@empty{<tr><td colspan="6">Sin resultados.</td></tr>}</tbody></table></div><div class="pagination"><button class="secondary" [disabled]="page<=1" (click)="page=page-1;loadItems()">Anterior</button><span>Página {{page}} · {{total()}} documentos</span><button class="secondary" [disabled]="page*50>=total()" (click)="page=page+1;loadItems()">Siguiente</button></div>
@if(selected();as d){<section><h3>Detalle del comprobante</h3><p>Tipo: {{d.type}} · Número: {{d.number || 'No disponible'}}</p><p>Clave: {{d.accessKey || 'No disponible'}} · Autorización: {{d.authorization || 'No disponible'}}</p><p>Emisión: {{d.issued}} · Autorización: {{d.authorizedAt || 'No disponible'}}</p><p>Emisor: {{d.issuerName || 'No disponible'}} · RUC: {{d.issuerTaxId || 'No disponible'}}</p><p>Receptor: {{d.recipient || 'No disponible'}} · Identificación: {{d.identification || 'No disponible'}}</p><p>Subtotal: {{d.subtotal ?? 'No disponible'}} · Descuento: {{d.discount ?? 'No disponible'}} · Impuestos: {{d.taxes ?? 'No disponible'}} · Total: {{d.total ?? 'No disponible'}}</p><p>Estado: {{d.status}} {{d.warning || ''}}</p><p>PDF: {{d.pdfRegistered ? 'Registrado' : 'No registrado'}} · XML: {{d.xmlRegistered ? 'Registrado' : 'No registrado'}}</p><div class="actions">@if(d.pdfRegistered){<a [href]="fileUrl(d.id,'pdf')">Descargar PDF</a>}@if(d.xmlRegistered){<a [href]="fileUrl(d.id,'xml')">Descargar XML</a>}</div></section>}}
}</section>` })
export class ExploradorComponent {
  api=inject(Api); accounts=signal<Account[]>([]); tree=signal<Tree>({folders:[],reports:[]}); items=signal<Item[]>([]); selected=signal<Item|null>(null); total=signal(0);
  account=''; year=0; month=0; type=''; search=''; sort='date'; page=1; private version=0;
  zip=signal<ZipJob|null>(null); zipBusy=signal(false); zipFormats='auto'; private zipAccount=''; private zipVersion=0;
  names=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  constructor(){void this.api.action(async()=>this.accounts.set(await this.api.get<Account[]>('accounts')));}
  monthName(m:number){return String(m).padStart(2,'0')+' '+this.names[m-1];}
  years(){return [...new Set([...this.tree().folders.map(f=>f.year),...this.tree().reports.map(r=>r.year)])].sort((a,b)=>b-a);}
  months(){return [...new Set([...this.tree().folders.filter(f=>f.year===this.year).map(f=>f.month),...this.tree().reports.filter(r=>r.year===this.year).map(r=>r.month)])].sort((a,b)=>a-b);}
  folders(){return this.tree().folders.filter(f=>f.year===this.year&&f.month===this.month);}
  hasReport(){return this.tree().reports.some(r=>r.year===this.year&&r.month===this.month);}
  async chooseAccount(account:string){this.account=account;this.year=0;this.month=0;this.type='';this.selected.set(null);this.tree.set({folders:[],reports:[]});this.zip.set(null);this.zipBusy.set(false);++this.zipVersion;const v=++this.version;if(account) await this.api.action(async()=>{const data=await this.api.get<Tree>('document-explorer/'+encodeURIComponent(account));if(v===this.version)this.tree.set(data);});}
  openType(type:string){this.type=type;this.page=1;this.search='';this.selected.set(null);void this.loadItems();}
  async loadItems(){const v=++this.version;const params=new URLSearchParams({year:String(this.year),month:String(this.month),type:this.type,search:this.search,sort:this.sort,page:String(this.page)});await this.api.action(async()=>{const data=await this.api.get<{items:Item[];total:number}>('document-explorer/'+encodeURIComponent(this.account)+'/items?'+params);if(v===this.version){this.items.set(data.items);this.total.set(data.total);}});}
  fileUrl(id:string,format:string){return this.api.url('documents/'+encodeURIComponent(id)+'/'+format);}
  reportUrl(){return this.api.url('reports/'+encodeURIComponent(this.account)+'/'+this.year+'/'+this.month);}
  async prepareZip(){
    const account=this.account;const version=++this.zipVersion;this.zipAccount=account;this.zip.set(null);this.zipBusy.set(true);
    const path='document-explorer/'+encodeURIComponent(account)+'/zip';
    try {
      let job=await this.api.post<ZipJob>(path,{year:this.year||null,month:this.month||null,type:this.type||null,formats:this.zipFormats});
      for(let i=0;i<300&&version===this.zipVersion;i++){
        this.zip.set(job);if(job.status!=='Preparando')return;
        await new Promise(resolve=>setTimeout(resolve,2000));
        job=await this.api.get<ZipJob>(path+'/'+encodeURIComponent(job.id));
      }
      if(version===this.zipVersion)this.api.notify('La preparación sigue pendiente. Vuelva a consultar más tarde.','info');
    } catch {if(version===this.zipVersion)this.api.notify('No se pudo preparar o consultar el ZIP.','error');}
    finally {if(version===this.zipVersion)this.zipBusy.set(false);}
  }
  zipUrl(id:string){return this.api.url('document-explorer/'+encodeURIComponent(this.zipAccount)+'/zip/'+encodeURIComponent(id)+'/file');}
  async refreshZip(id:string){const version=this.zipVersion;const account=this.zipAccount;await this.api.action(async()=>{const result=await this.api.get<ZipJob>('document-explorer/'+encodeURIComponent(account)+'/zip/'+encodeURIComponent(id));if(version===this.zipVersion)this.zip.set(result);});}
}
