import { Component, inject, signal, viewChild, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api,Query,Execution } from '../../core/api';
import { QueryForm } from '../../shared/download-form';
@Component({selector:'sri-consulta',imports:[QueryForm,DatePipe],template:`
  <div class="page-heading"><div><h1>Comprobantes emitidos</h1><p>Configure la operación y siga su progreso.</p></div></div>
  <section class="card"><app-query-form (submitted)="execute($event)"><button type="button" class="secondary" (click)="save()">Guardar configuración</button></app-query-form></section>
  <section class="bot-state" aria-label="Conexión del bot"><span>Worker: {{workerOnline()===null?'comprobando':workerOnline()?'conectado':'sin conexión'}}</span></section>
  @if(current();as e){
    <section class="card operation-progress" aria-label="Progreso de la operación" aria-live="polite" [attr.data-stage]="e.stage" [attr.aria-busy]="processing(e)">
      <div class="actions"><span class="badge" [attr.data-status]="e.status">{{phase(e)}}</span>@if(processing(e)){<span class="spinner" aria-hidden="true"></span>}</div>
      <p>{{e.message||'Esperando al Worker.'}}</p><p>{{e.processed}} procesados · {{e.found}} encontrados · {{e.errors}} pendientes</p>
      @if(processing(e)){<p class="muted">El Worker procesa la operacion en el servidor; puede cerrar esta pagina.</p>}
      @if(e.status==='RequiresHumanAction'){<p role="alert" class="error">La operación se detuvo. {{e.message}}</p><p>Revise el mensaje antes de reanudar. La intervencion remota para CAPTCHA o MFA aun no esta disponible.</p><button class="secondary" (click)="resume(e.id)">Reanudar operación</button>}
      @if(['Failed','CompletedWithWarnings','Cancelled'].includes(e.status)){<button class="secondary" (click)="retry(e.id)">Reintentar trabajo</button>}
      @if(['Pending','Running','RequiresHumanAction'].includes(e.status)){<button class="danger" (click)="cancel(e.id)">Cancelar ejecución</button>}
      @for(report of e.reports||[];track report.path){<p><a [href]="reportLink(e,report)">Descargar Excel {{report.year}}-{{report.month.toString().padStart(2,'0')}}</a></p>}
      @for(issue of e.issues||[];track $index){<p class="error">{{issue}}</p>}
      @if(e.events?.length){<details><summary>Ver pasos de la operación</summary><ol class="operation-events">@for(event of e.events;track $index){<li><time>{{event.at|date:'HH:mm:ss':'-0500'}}</time> {{event.message}}</li>}</ol></details>}
    </section>
  }`})
export class ComprobantesPage {
  api=inject(Api);form=viewChild(QueryForm);current=signal<Execution|null>(null);workerOnline=signal<boolean|null>(null);checkTimeout=signal(false);
  private polling=false;private lastSignature='';private verifyingSince=0;private failures=0;private destroyed=false;
  constructor(){void this.restore();const timer=setInterval(()=>void this.poll(),500);inject(DestroyRef).onDestroy(()=>{this.destroyed=true;clearInterval(timer);});}
  phase(e:Execution){if(e.status==='Completed')return e.reports?.length?'Terminado con éxito':'Proceso finalizado';if(e.status!=='Running')return ({Pending:'En cola',RequiresHumanAction:'Operación detenida',Failed:'Falló la operación',CompletedWithWarnings:'Finalizado con pendientes',Cancelled:'Operación cancelada'} as Record<string,string>)[e.status]||e.status;return ({OpeningBrowser:'Abriendo el SRI',WaitingForLogin:'Esperando su ingreso',AccessRejected:'No se confirmó el acceso',VerifyingLogin:'Comprobando acceso',PreparingQuery:'Preparando consulta',OpeningQuery:'Abriendo consulta SRI',AuthenticatingApplication:'Conectando la aplicación SRI',WaitingForHuman:'Esperando verificación humana',RecognizingControls:'Reconociendo filtros',Querying:'Consultando comprobantes',Downloading:'Descargando archivos',Processing:'Verificando documentos',GeneratingExcel:'Generando Excel'} as Record<string,string>)[e.stage||'']||'Procesando';}
  processing(e:Execution){return ['Pending','Running'].includes(e.status);}
  private accept(e:Execution,announce=true){
    if(this.destroyed)return;this.current.set(e);sessionStorage.setItem('sri-current-execution',e.id);
    if(e.stage==='VerifyingLogin'){if(!this.verifyingSince)this.verifyingSince=Date.now();this.checkTimeout.set(Date.now()-this.verifyingSince>25000);}else{this.verifyingSince=0;this.checkTimeout.set(false);}
    const signature=[e.id,e.status,e.stage,e.message].join('|');
    if(announce&&signature!==this.lastSignature){const kind=e.status==='Completed'?'success':['Failed','RequiresHumanAction','CompletedWithWarnings'].includes(e.status)||e.stage==='AccessRejected'?'error':['OpeningBrowser','VerifyingLogin','PreparingQuery','OpeningQuery','AuthenticatingApplication','RecognizingControls','Querying','Downloading','Processing','GeneratingExcel'].includes(e.stage||'')?'loading':'info';this.api.notify(this.phase(e)+(e.message?' · '+e.message:''),kind);}
    this.lastSignature=signature;
  }
  private async restore(){try{const id=sessionStorage.getItem('sri-current-execution');if(id)this.accept(await this.api.get<Execution>('executions/'+encodeURIComponent(id)),false);else{const jobs=await this.api.get<Execution[]>('executions');const active=jobs.find(e=>['Pending','Running'].includes(e.status)&&e.query.account===this.api.activeAccount());if(active)this.accept(active,false);}}catch{sessionStorage.removeItem('sri-current-execution');}await this.poll();}
  private async poll(){if(this.polling||this.destroyed)return;this.polling=true;try{const worker=await this.api.get<{online:boolean}>('worker/status');this.workerOnline.set(worker.online);const e=this.current();if(e){this.accept(await this.api.get<Execution>('executions/'+e.id));}this.failures=0;}catch{if(++this.failures===2)this.api.notify('No se pudo actualizar el progreso. Compruebe la conexion con la API; no se ha confirmado el resultado.','error');}finally{this.polling=false;}}
  async execute(q:Query){if(q.mode==='Sri'&&!confirm('¿Autoriza consultar el SRI para la cuenta seleccionada, del '+q.from+' al '+q.to+', tipos '+q.types.join(', ')+'?'))return;const e=await this.api.action(()=>this.api.post<Execution>('executions',q));if(e)this.accept(e);}
  save(){const form=this.form();if(form?.form.valid)void this.api.action(()=>this.api.post('configurations',form.value()),'Configuración guardada.');else this.api.notify('Complete el formulario.','error');}
  async cancel(id:string){await this.api.action(()=>this.api.post('executions/'+id+'/cancel',{}),'Cancelación solicitada.');await this.poll();}
  async resume(id:string){if(this.current()?.query.mode==='Sri'&&!confirm('¿Autoriza reanudar la consulta SRI con los filtros de esta operación?'))return;const e=await this.api.action(()=>this.api.post<Execution>('executions/'+id+'/resume',{}));if(e)this.accept(e);}
  async retry(id:string){if(this.current()?.query.mode==='Sri'&&!confirm('¿Autoriza reintentar la consulta SRI con los mismos filtros?'))return;const e=await this.api.action(()=>this.api.post<Execution>('executions/'+id+'/retry',{}));if(e)this.accept(e);}
  reportLink(e:Execution,r:{year:number;month:number}){return this.api.url('reports/'+encodeURIComponent(e.query.account)+'/'+r.year+'/'+r.month);}
}
