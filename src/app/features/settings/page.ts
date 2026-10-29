import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule,ReactiveFormsModule,FormBuilder,Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Api,Account } from '../../core/api';
interface Session {status:string;verified:boolean;message:string;agentOnline:boolean;present:boolean;operation?:{browserOpened:boolean};}
interface Settings {defaultAccount:string|null;downloadSubfolder:string|null;}
@Component({imports:[FormsModule,ReactiveFormsModule],template:`
  <div class="page-heading"><div><p class="eyebrow">TU ESPACIO LOCAL</p><h1>Configuración</h1><p>Cuentas, acceso al SRI y preferencias.</p></div></div>
  @if(api.role()==='admin'){<div class="two-col"><section class="card"><h2>Agregar cuenta SRI</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <label>Alias descriptivo<input formControlName="alias" autocomplete="off" /></label>
      <label>RUC del emisor<input formControlName="taxId" maxlength="13" /></label>
      <label>Contraseña SRI<input type="password" formControlName="password" autocomplete="new-password" maxlength="1024" /></label>
      <p>La contraseña se guarda cifrada y el bot la utiliza únicamente en el portal oficial. El SRI puede solicitar CAPTCHA o verificación adicional.</p>
      <button [disabled]="form.invalid||api.busy()">Guardar cuenta</button>
    </form></section>
    <section class="card"><h2>Cuenta y acceso</h2>
      <label>Cuenta SRI<select aria-label="Cuenta SRI" [ngModel]="selected" (ngModelChange)="choose($event)"><option value="">Seleccione una cuenta</option>@for(a of accounts();track a.id){<option [value]="a.id">{{a.name}}{{a.isTest?' · PRUEBA LOCAL':''}}</option>}</select></label>
      @if(account();as a){
        <p>RUC: {{a.taxId||a.id}}</p><p>Estado: <strong data-testid="account-state">{{stateLabel()}}</strong></p><p>{{session()?.message||'El bot utilizará la contraseña cifrada para ingresar. Sin contraseña guardada podrá completar el acceso manualmente.'}}</p>
        <p>{{credential()?.configured?'Contraseña cifrada configurada':'Sin contraseña guardada'}}</p>
        <label>Nueva contraseña SRI<input type="password" [(ngModel)]="replacement" [disabled]="api.busy()||connecting()" autocomplete="new-password" maxlength="1024" /></label>
        <div class="actions"><button class="secondary" [disabled]="!replacement.trim()||api.busy()||connecting()" (click)="saveCredential()">Guardar nueva contraseña</button><button class="danger" [disabled]="!credential()?.configured||api.busy()||connecting()" (click)="deleteCredential()">Eliminar contraseña guardada</button></div>
        @if(connecting()){<p>Cancele la conexión antes de cambiar o eliminar la contraseña guardada.</p>}
        <div class="actions"><button [disabled]="api.busy()||a.isTest||connecting()" (click)="connect()">Conectar al SRI</button>
          <button class="danger" [disabled]="!connecting()||api.busy()" (click)="command('Cancel')">Cancelar conexión</button>
          <button class="secondary" [disabled]="!session()?.present&&!session()?.operation" (click)="logoutSri()">Cerrar sesión del SRI</button></div>
        @if(session()?.operation?.browserOpened){<p>El navegador del bot está abierto. Si el SRI solicita CAPTCHA o código, complételo allí; el acceso se detecta automáticamente.</p><button class="secondary" [disabled]="api.busy()" (click)="command('Verify')">Listo, comprobar acceso</button><button class="secondary" (click)="command('Show')">Mostrar ventana SRI</button>}
        @if(!session()?.agentOnline){<a [href]="agentLaunch" class="button secondary">Abrir aplicación local</a>}
        <hr /><label>Alias de la cuenta<input [value]="aliases()[selected]??editName" (input)="editAlias($event)" [disabled]="api.busy()" /></label><button class="secondary" [disabled]="api.busy()" (click)="rename()">Guardar cambios de cuenta</button>
        <div class="actions"><button class="secondary" (click)="setDefault()">Usar como predeterminada</button><button class="danger" (click)="remove()">Eliminar cuenta</button></div>
      }@else{<p>Seleccione o registre una cuenta.</p>}
    </section></div>}
    @if(api.role()==='admin'){
    <section class="card"><h2>Usuarios del panel</h2>
      <p>Los usuarios registrados necesitan una contraseña individual para ingresar. Solo un administrador puede gestionarlos.</p>
      <div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Acceso</th></tr></thead><tbody>@for(u of users();track u.username){<tr><td>{{u.username}}</td><td>{{u.role}}</td><td>{{u.active?'Activo':'Sin contraseña'}}</td></tr>}</tbody></table></div>
      <form (ngSubmit)="saveUser()" class="form-grid">
        <label>Usuario<input name="panelUsername" [(ngModel)]="panelUsername" required maxlength="80" autocomplete="off" /></label>
        <label>Rol<select name="panelRole" [(ngModel)]="panelRole"><option value="asistente">Asistente</option><option value="admin">Admin</option></select></label>
        <label>Contraseña individual<input name="panelPassword" [(ngModel)]="panelPassword" type="password" required minlength="12" maxlength="1024" autocomplete="new-password" /></label>
        <button [disabled]="api.busy()||panelUsername.trim().length<2||panelPassword.length<12">Guardar usuario y contraseña</button>
      </form><p>Para activar un usuario existente, escriba su nombre y rol tal como aparece en la lista.</p>
    </section>}
    @if(api.role()==='admin'){
    <section class="card"><h2>Asignar RUC a asistentes</h2>
      <label>Asistente<select [(ngModel)]="assignmentUser" (ngModelChange)="loadAssignments()"><option value="">Seleccione</option>@for(u of users();track u.username){@if(u.role==='asistente'){<option [value]="u.username">{{u.username}}</option>}}</select></label>
      @if(assignmentUser){@for(a of accounts();track a.id){<label class="inline"><input type="checkbox" [checked]="assignments().includes(a.id)" (change)="assign(a.id,$event)" />{{a.name}} · {{a.taxId||a.id}}</label>}}
    </section>}
    <section class="card"><h2>Preferencias</h2><div class="form-grid">
      <label>Apariencia<select [value]="theme" (change)="changeTheme($event)"><option value="light">Claro</option><option value="dark">Oscuro</option><option value="auto">Automático según sistema</option></select></label>
      <label>Cuenta predeterminada<select aria-label="Cuenta predeterminada" [(ngModel)]="settings.defaultAccount"><option [ngValue]="null">Sin predeterminada</option>@for(a of accounts();track a.id){<option [value]="a.id">{{a.name}}</option>}</select></label>
      <label>Destino de descargas<input [value]="destination()" readonly /></label>
      <label>Subcarpeta para nuevas descargas (opcional)<input [(ngModel)]="settings.downloadSubfolder" /></label>
    </div><div class="actions"><button class="secondary" (click)="saveSettings()">Guardar preferencias</button><button class="secondary" (click)="api.logout()">Cerrar sesión del panel</button></div></section>`})
export class SettingsPage {
  api=inject(Api);fb=inject(FormBuilder);aliases=signal<Record<string,string>>({});accounts=signal<Account[]>([]);session=signal<Session|null>(null);selected=this.api.activeAccount();editName='';theme=localStorage.getItem('sri-theme')||'auto';destination=signal('');settings:Settings={defaultAccount:null,downloadSubfolder:null};
  assignmentUser='';assignments=signal<string[]>([]);
  async loadAssignments(){this.assignments.set(this.assignmentUser?await this.api.get<string[]>('assignments/'+encodeURIComponent(this.assignmentUser)):[]);}
  async assign(account:string,event:Event){await this.api.action(()=>this.api.post('assignments',{username:this.assignmentUser,account,assigned:(event.target as HTMLInputElement).checked}),'Asignación actualizada.');await this.loadAssignments();}
  users=signal<{username:string;role:string;active:boolean}[]>([]);panelUsername='';panelRole='asistente';panelPassword='';
  async loadUsers(){if(this.api.role()==='admin')this.users.set(await this.api.get<{username:string;role:string;active:boolean}[]>('users'));}
  async saveUser(){const result=await this.api.action(()=>this.api.post('users',{username:this.panelUsername,role:this.panelRole,password:this.panelPassword}),'Usuario guardado.');this.panelPassword='';if(result){this.panelUsername='';await this.loadUsers();}}
  agentLaunch=inject(DomSanitizer).bypassSecurityTrustUrl('sri-automation-agent://start');
  credential=signal<{configured:boolean;updatedAt?:string}|null>(null);replacement='';
  form=this.fb.nonNullable.group({alias:['',[Validators.required,Validators.maxLength(150)]],taxId:['',[Validators.required,Validators.pattern(/^\d{13}$/)]],password:['',[Validators.required,Validators.maxLength(1024)]]});
  constructor(){void this.load();void this.loadUsers();const timer=setInterval(()=>void this.refresh(),2500);inject(DestroyRef).onDestroy(()=>{clearInterval(timer);this.replacement='';this.form.controls.password.reset();});}
  account(){return this.accounts().find(a=>a.id===this.selected);}
  connecting(){return !!this.session()?.operation?.browserOpened||['Ready','OpeningBrowser','InspectingPortal','WaitingForLogin','RequiresHumanAction'].includes(this.session()?.status||'');}
  stateLabel(){const s=this.session();if(s?.verified)return 'Acceso verificado para esta operación';return ({Ready:'Abriendo portal',OpeningBrowser:'Abriendo portal',InspectingPortal:'Comprobando acceso',RequiresHumanAction:'Esperando acceso',WaitingForLogin:'Esperando que inicie sesión',Expired:'Acceso finalizado',Failed:'Error de conexión',PortalUnavailable:'Portal no disponible',PendingValidation:'Acceso pendiente de validar',VerificationFailed:'No se confirmó el acceso',QueryFailed:'Fallo al abrir la consulta',Cancelled:'Acceso cerrado'} as Record<string,string>)[s?.status||'']||(this.account()?'Cuenta registrada':'Sin cuenta');}
  changeTheme(event:Event){this.theme=(event.target as HTMLSelectElement).value;this.api.setTheme(this.theme);}
  async choose(id:string){this.selected=id;this.api.activeAccount.set(id);this.session.set(null);this.credential.set(null);this.replacement='';this.editName=this.account()?.name||'';await this.refresh();}
  async load(){await this.api.action(async()=>{this.accounts.set(await this.api.get<Account[]>('accounts'));this.settings=await this.api.get<Settings>('settings');this.destination.set((await this.api.get<{outputHostPath:string}>('system')).outputHostPath);if(!this.selected)this.selected=this.settings.defaultAccount||'';});await this.choose(this.selected);}
  async refresh(){if(this.api.role()!=='admin'||!this.selected)return;const id=this.selected;try{const [s,c]=await Promise.all([this.api.get<Session>('accounts/'+encodeURIComponent(id)+'/session'),this.api.get<{configured:boolean;updatedAt?:string}>('accounts/'+encodeURIComponent(id)+'/credentials')]);if(id===this.selected){this.session.set(s);this.credential.set(c);}}catch{this.session.set(null);}}
  async save(){if(this.form.invalid)return;const result=await this.api.action(()=>this.api.post<Account>('accounts/register',this.form.getRawValue()),'Perfil y contraseña cifrada guardados.');this.form.controls.password.reset();if(result){this.form.reset();this.selected=result.id;await this.load();}}
  async saveCredential(){await this.api.action(()=>this.api.put('accounts/'+this.selected+'/credentials',{password:this.replacement}),'Contraseña cifrada actualizada.');this.replacement='';await this.refresh();}
  async deleteCredential(){if(!confirm('¿Eliminar la contraseña guardada? Los documentos y la cuenta se conservan.'))return;await this.api.action(()=>this.api.delete('accounts/'+this.selected+'/credentials'),'Contraseña guardada eliminada.');this.replacement='';await this.refresh();}
  async connect(){await this.api.action(()=>this.api.post('accounts/'+this.selected+'/connect',{}),'Conexión autorizada iniciada.');await this.refresh();}
  async command(command:string){await this.api.action(()=>this.api.post('accounts/'+this.selected+'/authentication/'+command,{}));await this.refresh();}
  async logoutSri(){await this.api.action(()=>this.api.post('accounts/'+this.selected+'/logout',{}),'Acceso local revocado.');await this.refresh();}
  editAlias(event:Event){this.aliases.update(v=>({...v,[this.selected]:(event.target as HTMLInputElement).value}));}
  async rename(){const id=this.selected;const result=await this.api.action(()=>this.api.put('accounts/'+id,{name:this.aliases()[id]??this.editName}),'Cuenta actualizada.');await this.load();if(result)this.aliases.update(v=>{const n={...v};delete n[id];return n;});}
  async setDefault(){this.settings.defaultAccount=this.selected;await this.saveSettings();}
  async saveSettings(){const result=await this.api.action(()=>this.api.put<Settings>('settings',this.settings),'Preferencias guardadas.');if(result){this.settings=result;await this.load();}}
  async remove(){if(!confirm('¿Eliminar la cuenta? Los documentos e historial se conservan.'))return;const result=await this.api.action(()=>this.api.delete('accounts/'+this.selected),'Cuenta eliminada.');if(result){this.selected='';this.api.activeAccount.set('');await this.load();}}
}
