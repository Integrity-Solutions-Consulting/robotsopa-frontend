import { Component,DestroyRef,inject,signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { HistorialPage } from './page';
interface Audit {id:string;user:string;action:string;at:string;account?:string;accountName?:string;result:string;}
@Component({imports:[DatePipe,HistorialPage],template:`
  <div class="page-heading"><div><p class="eyebrow">ACTIVIDAD REAL</p><h1>Historial</h1><p>Quién hizo qué, con qué cuenta y cuándo.</p></div><button class="secondary" (click)="load()">Actualizar</button></div>
  <section class="card"><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Acción</th><th>Fecha y hora</th><th>Cuenta SRI</th><th>Resultado</th></tr></thead><tbody>
    @for(a of events();track a.id){<tr [attr.data-account]="a.account"><td>{{a.user}}</td><td>{{a.action}}</td><td>{{a.at|date:'dd/MM/yyyy HH:mm:ss':'-0500'}}</td><td>{{a.accountName||a.account||'Panel'}}</td><td>{{a.result}}</td></tr>}@empty{<tr><td colspan="5">Todavía no hay acciones registradas para esta vista.</td></tr>}
  </tbody></table></div><div class="pagination"><button class="secondary" [disabled]="page<=1" (click)="page=page-1;load()">Anterior</button><span>Página {{page}} · {{total()}} acciones</span><button class="secondary" [disabled]="page*50>=total()" (click)="page=page+1;load()">Siguiente</button></div></section>
  <section class="card"><details><summary>Detalle de ejecuciones y reintentos</summary><sri-ejecuciones /></details></section>`})
export class AuditPage{api=inject(Api);events=signal<Audit[]>([]);total=signal(0);page=1;constructor(){void this.load();const timer=setInterval(()=>void this.load(),5000);inject(DestroyRef).onDestroy(()=>clearInterval(timer));}async load(){await this.api.action(async()=>{const result=await this.api.get<{items:Audit[];total:number}>('audit?page='+this.page);this.events.set(result.items);this.total.set(result.total);});}}
