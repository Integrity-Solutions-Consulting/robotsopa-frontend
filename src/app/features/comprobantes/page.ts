import { Component, inject, signal, viewChild, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api,Query,Execution } from '../../core/api';
import { QueryForm } from '../../shared/download-form';
@Component({selector:'sri-consulta',imports:[QueryForm,DatePipe],template:`
  <div class="page-heading"><div><h1>Comprobantes emitidos</h1><p>Configure la operación y siga su progreso.</p></div></div>
  <section class="card"><h2>Configurar descarga</h2><app-query-form [blocked]="submitting()" (submitted)="execute($event)"><button type="button" class="secondary" (click)="save()">Guardar configuración</button></app-query-form></section>
  <section class="bot-state" aria-label="Conexión del agente"><span>Agente Windows: {{agentStatus()}}</span></section>
  <p class="muted">Con el agente remoto activo, los PDF y Excel confirmados se entregan en Escritorio / SRI-Automation / RUC / año / mes, en la carpeta del tipo o Reportes. Mantenga abierto el agente en el equipo Windows.</p>
  @if(current();as e){
    <section class="card operation-progress" aria-label="Progreso de la operación" aria-live="polite" [attr.data-stage]="e.stage" [attr.aria-busy]="processing(e)">
      <div class="actions"><h2>Seguimiento de la ejecución</h2><span class="badge" [attr.data-status]="e.status">{{phase(e)}}</span>@if(processing(e)){<span class="spinner" aria-hidden="true"></span>}</div>
      <p>{{e.message||'Esperando el inicio de la operación.'}}</p>
      @if(processing(e) || e.progressPercent != null){<label class="progress-label">{{e.progressPercent == null ? 'Progreso en curso; el total aún no está confirmado' : 'Avance: ' + e.progressPercent + '%'}}
        @if(e.progressPercent == null){<progress aria-label="Progreso indeterminado"></progress>}@else{<progress [value]="e.progressPercent" max="100" aria-label="Progreso de descarga"></progress>}
      </label>}@else{<p class="muted">No se dispone de un porcentaje final confirmado.</p>}
      <div class="progress-stats"><span><strong>{{e.found}}</strong> encontrados</span><span><strong>{{e.downloaded||0}}</strong> descargados</span><span><strong>{{e.pendingDocuments ?? '—'}}</strong> pendientes</span><span><strong>{{e.errors}}</strong> con errores</span><span><strong>{{elapsed(e)}}</strong> transcurrido</span></div>
      @if(processing(e)){<p class="muted">La operación continúa mientras los servicios y el agente necesario estén activos.</p>}
      @if(e.stage==='WaitingForHuman'){<p role="alert">Complete el CAPTCHA o MFA en la ventana oficial del SRI en la computadora donde funciona el agente Windows.</p>}
      @if(e.status==='RequiresHumanAction'){<p role="alert" class="error">La operación se detuvo. Revise el mensaje anterior y reanude cuando el agente esté disponible.</p><button class="secondary" [disabled]="api.busy()" (click)="jobAction(e,'resume')">Reanudar operación</button>}
      @if(['Failed','CompletedWithWarnings','Cancelled'].includes(e.status)){<button class="secondary" [disabled]="api.busy()" (click)="jobAction(e,'retry')">Reintentar trabajo</button>}
      @if(['Pending','Running','RequiresHumanAction'].includes(e.status)){<button class="danger" [disabled]="api.busy()" (click)="cancel(e.id)">Cancelar descarga</button>}
      @if(e.status==='Cancelling'){<button class="danger" disabled>Cancelando...</button><p>Espere a que la ejecución cierre la sesión y libere los recursos.</p>}
      @for(report of e.reports||[];track report.path){<p><a [href]="reportLink(e,report)">Descargar Excel {{report.year}}-{{report.month.toString().padStart(2,'0')}}</a></p>}
      @for(issue of e.issues||[];track $index){<p class="error">{{issue}}</p>}
      @if(e.events?.length){<details><summary>Ver pasos de la operación</summary><ol class="operation-events">@for(event of e.events;track $index){<li><time>{{event.at|date:'HH:mm:ss':'-0500'}}</time> {{event.message}}</li>}</ol></details>}
    </section>
  }`})
export class ComprobantesPage {
  api=inject(Api);form=viewChild(QueryForm);current=signal<Execution|null>(null);agentStatus=signal('comprobando');checkTimeout=signal(false);submitting=signal(false);
  private polling=false;private lastSignature='';private verifyingSince=0;private failures=0;private destroyed=false;
  constructor(){void this.restore();const timer=setInterval(()=>void this.poll(),3000);inject(DestroyRef).onDestroy(()=>{this.destroyed=true;clearInterval(timer);});}
  phase(e:Execution){if(e.status==='Completed')return e.reports?.length?'Terminado con éxito':'Proceso finalizado';if(e.status!=='Running')return ({Pending:'En cola',Cancelling:'Cancelando...',RequiresHumanAction:'Requiere intervención humana',Failed:'Falló la operación',CompletedWithWarnings:'Finalizado con pendientes',Cancelled:'Operación cancelada'} as Record<string,string>)[e.status]||e.status;return ({OpeningBrowser:'Conectando con el SRI',WaitingForLogin:'Autenticando cuenta',AccessRejected:'No se confirmó el acceso',VerifyingLogin:'Comprobando acceso',PreparingQuery:'Preparando consulta',OpeningQuery:'Abriendo consulta SRI',AuthenticatingApplication:'Autenticando cuenta',WaitingForHuman:'Esperando verificación humana',RecognizingControls:'Identificando controles',Querying:'Consultando comprobantes',Downloading:'Descargando documentos',Processing:'Guardando y verificando archivos',GeneratingExcel:'Actualizando Excel'} as Record<string,string>)[e.stage||'']||'Preparando ejecución';}
  processing(e:Execution){return ['Pending','Running','Cancelling'].includes(e.status);}
  elapsed(e:Execution){const seconds=Math.max(0,Math.floor((new Date(e.finished||Date.now()).getTime()-new Date(e.started||e.created).getTime())/1000));return `${Math.floor(seconds/60)} min ${seconds%60} s`;}
  private accept(e:Execution,announce=true){
    if(this.destroyed)return;this.current.set(e);localStorage.setItem('sri-current-execution',e.id);
    if(e.stage==='VerifyingLogin'){if(!this.verifyingSince)this.verifyingSince=Date.now();this.checkTimeout.set(Date.now()-this.verifyingSince>25000);}else{this.verifyingSince=0;this.checkTimeout.set(false);}
    const signature=[e.id,e.status,e.stage,e.message].join('|');
    if(announce&&signature!==this.lastSignature){const kind=e.status==='Completed'?'success':['Failed','RequiresHumanAction','CompletedWithWarnings'].includes(e.status)||e.stage==='AccessRejected'?'error':['OpeningBrowser','VerifyingLogin','PreparingQuery','OpeningQuery','AuthenticatingApplication','RecognizingControls','Querying','Downloading','Processing','GeneratingExcel'].includes(e.stage||'')?'loading':'info';this.api.notify(this.phase(e)+(e.message?' · '+e.message:''),kind);}
    this.lastSignature=signature;
  }
  private async restore(){try{const jobs=await this.api.get<Execution[]>('executions');const id=localStorage.getItem('sri-current-execution');const selected=jobs.find(e=>this.processing(e)&&e.query.account===this.api.activeAccount())||jobs.find(e=>e.id===id);if(selected)this.accept(selected,false);}catch{this.api.notify('No se pudo recuperar el seguimiento. Compruebe la conexión con la API.','error');}await this.poll();}
  private async poll(){if(this.polling||this.destroyed)return;this.polling=true;try{const agents=await this.api.get<{revokedAt:string|null;online?:boolean;executionAvailable?:boolean}[]>('delivery-agents').catch(()=>null);this.agentStatus.set(!agents?'estado no disponible':agents.some(a=>a.online&&!a.revokedAt)?'conectado':agents.some(a=>a.executionAvailable===false&&!a.revokedAt)?'ejecución remota deshabilitada':agents.some(a=>a.online===undefined&&!a.revokedAt)?'estado no disponible':agents.some(a=>!a.revokedAt)?'sin conexión':'sin agente activo');const id=this.current()?.id||localStorage.getItem('sri-current-execution');if(id){this.accept(await this.api.get<Execution>('executions/'+encodeURIComponent(id)));}this.failures=0;}catch{this.agentStatus.set('estado no disponible');if(++this.failures===2)this.api.notify('No se pudo actualizar el progreso. Compruebe la conexión con la API; no se ha confirmado el resultado.','error');}finally{this.polling=false;}}
  async execute(q:Query){if(this.submitting())return;if(q.mode==='Sri'&&!confirm('¿Autoriza consultar el SRI para la cuenta seleccionada, del '+q.from+' al '+q.to+', tipos '+q.types.join(', ')+'?'))return;this.submitting.set(true);try{const fingerprint=JSON.stringify(q);const saved=JSON.parse(sessionStorage.getItem('sri-request-key')||'null') as {fingerprint:string;key:string}|null;const key=saved?.fingerprint===fingerprint?saved.key:crypto.randomUUID();sessionStorage.setItem('sri-request-key',JSON.stringify({fingerprint,key}));const e=await this.api.action(()=>this.api.post<Execution>('executions',q,key));if(e){sessionStorage.removeItem('sri-request-key');this.accept(e);}}finally{this.submitting.set(false);}}
  save(){const form=this.form();if(form?.form.valid)void this.api.action(()=>this.api.post('configurations',form.value()),'Configuración guardada.');else this.api.notify('Complete el formulario.','error');}
  async jobAction(e:Execution, action:'resume'|'retry'){if(e.query.mode==='Sri'&&!confirm('¿Autoriza '+(action==='resume'?'reanudar':'reintentar')+' la consulta SRI con los mismos filtros?'))return;const result=await this.api.action(()=>this.api.post<Execution>('executions/'+encodeURIComponent(e.id)+'/'+action,{}));if(result){this.accept(result);await this.poll();}}
  async cancel(id:string){const e=await this.api.action(()=>this.api.post<Execution>('executions/'+id+'/cancel',{}),'Cancelación solicitada.');if(e)this.accept(e);await this.poll();}
  reportLink(e:Execution,r:{year:number;month:number}){return this.api.url('reports/'+encodeURIComponent(e.query.account)+'/'+r.year+'/'+r.month);}
}
