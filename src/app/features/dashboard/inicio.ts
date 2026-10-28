import { Component,DestroyRef,inject,signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api,Account,Execution,Schedule } from '../../core/api';
@Component({imports:[FormsModule,DatePipe,RouterLink],template:`
  <div class="page-heading"><div><p class="eyebrow">TU ARCHIVO ELECTRÓNICO</p><h1>Inicio</h1><p>Tu cuenta SRI y sus últimas operaciones.</p></div><a routerLink="/comprobantes" class="button">Descargar comprobantes</a></div>
  <section class="card"><label>Cuenta SRI activa<select [ngModel]="api.activeAccount()" (ngModelChange)="api.activeAccount.set($event);load()"><option value="">Seleccione una cuenta</option>@for(a of accounts();track a.id){<option [value]="a.id">{{a.name}}</option>}</select></label>
    <p>Conexión: <strong>{{ connection() }}</strong></p><a routerLink="/configuracion">Administrar y conectar cuenta</a></section>
  @if(error()){<p class="error" role="alert">{{error()}}</p>}
  <div class="metrics"><article class="card"><span>Documentos del SRI descargados</span><strong>{{count()}}</strong></article><article class="card"><span>Última ejecución</span><strong class="metric-text">{{last()?.status||'Sin ejecuciones'}}</strong><small>{{last()?.created|date:'dd/MM/yyyy HH:mm':'-0500'}}</small></article><article class="card"><span>Próxima ejecución</span><strong class="metric-text">{{(next()|date:'dd/MM/yyyy HH:mm':'-0500')||'Sin programación'}}</strong></article></div>
  <section class="card"><h2>Acceso al SRI</h2><p>Configure el perfil con RUC y contraseña cifrada. El bot iniciará el acceso autorizado y completará la conexión de la aplicación de comprobantes. CAPTCHA o MFA requieren su intervención. Puede minimizar Angular durante el procesamiento; Mostrar ventana SRI recupera el navegador del bot.</p><p>La descarga fiscal continúa pendiente de validación real. Los archivos importados y las pruebas locales se distinguen de las descargas reales.</p></section>`})
export class InicioPage {
  api=inject(Api);accounts=signal<Account[]>([]);connection=signal('Seleccione una cuenta');count=signal(0);last=signal<Execution|null>(null);next=signal<string|null>(null);error=signal('');
  constructor(){void this.load();const timer=setInterval(()=>void this.load(),5000);inject(DestroyRef).onDestroy(()=>clearInterval(timer));}
  async load(){try{this.accounts.set(await this.api.get<Account[]>('accounts'));const id=this.api.activeAccount();if(!id){this.connection.set('Sin cuenta seleccionada');this.count.set(0);this.last.set(null);this.next.set(null);return;}
    const [session,docs,jobs,schedules]=await Promise.all([this.api.get<{verified:boolean;status:string}>('accounts/'+id+'/session'),this.api.get<{total:number}>('documents?'+new URLSearchParams({account:id,source:'Sri',pageSize:'1'})),this.api.get<Execution[]>('executions'),this.api.get<Schedule[]>('schedules')]);
    this.connection.set(session.verified?'Autenticada':({Expired:'Sesión expirada',Failed:'Error de conexión',Ready:'Conectando',OpeningBrowser:'Conectando',InspectingPortal:'Conectando',RequiresHumanAction:'Requiere verificación',WaitingForLogin:'Requiere verificación'} as Record<string,string>)[session.status]||'Sin conexión');
    this.count.set(docs.total);this.last.set(jobs.find(e=>e.query.account===id)||null);this.next.set(schedules.filter(s=>s.enabled&&s.query.account===id).map(s=>s.next).sort()[0]||null);this.error.set('');
  }catch{this.connection.set('No se pudo comprobar');this.error.set('No se pudo actualizar la información. Compruebe la conexión local.');}}
}
