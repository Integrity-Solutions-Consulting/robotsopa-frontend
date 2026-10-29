import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Api, Account, Execution, Voucher } from '../../core/api';

interface Session {
  status: string; verified: boolean; present: boolean; agentOnline: boolean; message: string;
  lastConnection?: string; lastQuery?: string;
  operation?: { id: string; status: string; browserOpened: boolean; updated: string; expires?: string; cancelRequested: boolean };
}
interface SystemInfo { outputHostPath: string; sri: string; }
@Component({
  imports: [FormsModule, DatePipe, RouterLink],
  template: `
    <div class="page-heading"><div><p class="eyebrow">ACCESO AUTORIZADO · COMPROBANTES EMITIDOS</p>
      <h1>Prueba de conexión SRI</h1><p>Autenticación manual en el portal oficial y consulta controlada desde este panel.</p></div>
      <button class="secondary" (click)="refresh()">Actualizar estado</button></div>
    @if (connectionError()) { <p class="error" role="alert">{{ connectionError() }}</p> }
    <div class="two-col">
    <section class="card"><h2>1. Seleccionar cuenta</h2>
      <label>Cuenta autorizada<select [(ngModel)]="account" (ngModelChange)="select()">
        <option value="">Seleccione una cuenta</option>
        @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} · {{ a.isTest ? 'PRUEBA LOCAL' : a.id }}</option> }
      </select></label>
      <p><a routerLink="/configuracion">Registrar o administrar cuentas</a></p>
      @if (session(); as s) {
        <p>Estado: <strong data-testid="session-status">{{ s.status }}</strong></p><p>{{ s.message }}</p>
        <p>Agente Windows: {{ s.agentOnline ? 'Conectado' : 'No disponible' }}</p>
        @if (!s.agentOnline) {
          <p><a [href]="agentLaunch">Iniciar agente Windows</a></p>
          <p class="muted">Autorice la apertura de la aplicación local si el navegador lo solicita. El estado cambiará solo cuando la API reciba su conexión.</p>
        }
        <p>Navegador: {{ s.operation?.browserOpened && s.agentOnline ? 'Apertura confirmada' : 'Sin ventana confirmada' }}</p>
        <p>Última conexión verificada: {{ (s.lastConnection | date:'dd/MM/yyyy HH:mm':'-0500') || 'Pendiente' }}</p>
        <p>Última consulta: {{ (s.lastQuery | date:'dd/MM/yyyy HH:mm':'-0500') || 'Pendiente' }}</p>
        <div class="actions">
          <button [disabled]="api.busy() || !s.agentOnline || interactive() || selectedTest()" (click)="authenticate()">Iniciar sesión SRI</button>
          <button class="secondary" [disabled]="api.busy() || !s.agentOnline || !s.operation?.browserOpened" (click)="command('Verify')">Verificar conexión</button>
          <button class="secondary" [disabled]="api.busy() || !s.agentOnline || !s.operation?.browserOpened" (click)="command('Reload')">Reintentar carga del portal</button>
          <button class="danger" [disabled]="api.busy() || !interactive()" (click)="command('Cancel')">Cancelar autenticación</button>
          <button class="secondary" [disabled]="api.busy() || (!s.present && !s.operation)" (click)="logout()">Revocar sesión local</button>
          <button class="secondary" [disabled]="api.busy() || !s.verified || !s.agentOnline || !remoteLogout()" (click)="command('RemoteLogout')">Cerrar sesión en el portal SRI</button>
          @if (!remoteLogout()) { <p>Cierre remoto no disponible: control de salida pendiente de verificar. Puede revocar la sesión local.</p> }
        </div>
      } @else { <p>Seleccione una cuenta para consultar su estado.</p> }
      <p class="muted">La contraseña, CAPTCHA y MFA se completan exclusivamente en la ventana del portal oficial. Después abra Comprobantes emitidos, sin buscar, y pulse Verificar conexión aquí.</p>
    </section>
    <section class="card"><h2>2. Configurar consulta</h2>
      <label>Fecha de prueba<input type="date" [(ngModel)]="date" [max]="today" (ngModelChange)="authorized=false" /></label>
      <label>Tipo de comprobante<select [(ngModel)]="type" (ngModelChange)="authorized=false">
        @for (t of types; track t) { <option>{{ t }}</option> }
      </select></label>
      <label>Límite de documentos<input type="number" min="1" max="10" step="1" [(ngModel)]="limit" (ngModelChange)="authorized=false" /></label>
      <p>Formatos: PDF y XML disponibles. Una fecha, un tipo y hasta {{ limit }} facturas/comprobantes.</p>
      <p>Destino: <code>{{ system()?.outputHostPath || 'Pendiente de consultar almacenamiento' }}</code> / cuenta / año / mes / tipo.</p>
      <p>Worker: {{ workerOnline() ? 'Conectado' : 'No disponible' }} · Almacenamiento: {{ system() ? 'Acceso comprobado por API' : 'Pendiente' }}</p>
      <p data-testid="portal-readiness">Integración SRI: {{ system()?.sri === 'SessionValidationRequired' ? 'Controles inspeccionados; descarga real pendiente hasta ejecutar y verificar resultados.' : 'Pendiente: selectores reales aún no verificados. Consulta SRI no disponible.' }}</p>
      <label class="inline"><input type="checkbox" [(ngModel)]="authorized" />Autorizo consultar esta cuenta, fecha, tipo y límite en el SRI.</label>
      <button [disabled]="!canExecute() || api.busy()" (click)="execute()">Ejecutar prueba autorizada</button>
      <p class="muted">Abrir esta página no inicia consultas. Las pruebas locales no acreditan acceso al SRI.</p>
    </section></div>
    @if (current(); as e) {
      <section class="card"><h2>3. Progreso y resultados</h2>
        <p>Cuenta {{ e.query.account }} · {{ e.query.from }} · {{ e.query.types.join(', ') }}</p>
        <p>Estado: <strong data-testid="execution-status">{{ e.status }}</strong> · Etapa: {{ e.stage || e.status }}</p>
        <p>{{ e.processed }} procesados · {{ e.found }} encontrados · {{ e.downloaded || 0 }} descargados · {{ e.errors }} pendientes</p>
        <p>{{ e.message }}</p><p>Checkpoint: {{ e.checkpoint || 'Pendiente' }}</p>
        @for (issue of e.issues || []; track $index) { <p class="error">{{ issue }}</p> }
        <div class="actions">
          @if (['Pending','Running','RequiresHumanAction'].includes(e.status)) { <button class="danger" (click)="jobAction('cancel')">Cancelar prueba</button> }
          @if (e.status === 'RequiresHumanAction') { <button class="secondary" [disabled]="!session()?.verified" (click)="jobAction('resume')">Reanudar consulta autorizada</button> }
          @if (['Failed','Cancelled','CompletedWithWarnings'].includes(e.status)) { <button class="secondary" [disabled]="!session()?.verified" (click)="jobAction('retry')">Reintentar consulta autorizada</button> }
          <a routerLink="/historial">Historial completo</a>
        </div>
      </section>
    }
    <section class="card"><h2>Documentos de la selección</h2>
      <p>Se muestran archivos realmente registrados para la cuenta, fecha y tipo actuales.</p>
      <div class="table-wrap"><table><thead><tr><th>Número</th><th>Fecha</th><th>Receptor</th><th>Total</th><th>Validación</th><th>Archivos</th></tr></thead><tbody>
        @for (d of documents(); track d.id) { <tr><td>{{ d.number }}</td><td>{{ d.issued }}</td><td>{{ d.recipient }}</td><td>{{ d.total }}</td><td>{{ d.status }}<small>{{ d.warning }}</small></td><td>
          @if (d.xmlPath) { <a [href]="api.url('documents/'+d.id+'/xml')">XML</a> }
          @if (d.pdfPath) { <a [href]="api.url('documents/'+d.id+'/pdf')">PDF</a> }
        </td></tr> } @empty { <tr><td colspan="6">Sin documentos registrados para esta selección.</td></tr> }
      </tbody></table></div>
      <div class="actions"><button class="secondary" [disabled]="!account || !documents().length || api.busy()" (click)="report()">Generar Excel mensual</button>
        @if (reportUrl()) { <a [href]="reportUrl()">Descargar Excel verificado disponible</a> }
        <a routerLink="/documentos">Administrar archivos</a><a routerLink="/reportes">Reportes por mes y rango</a></div>
    </section>
    <section class="card"><details><summary>Inspección técnica del portal · pendiente hasta verificación real</summary>
      <p>Complete manualmente la navegación hasta los filtros de emitidos y pulse Verificar conexión. El inventario omite texto, valores, cookies y campos de contraseña. Configurar controles no autoriza consultas.</p>
      <button class="secondary" (click)="loadProfile()">Cargar perfil e inventario</button>
      <label>Perfil de selectores observado (JSON, sin datos personales)<textarea rows="14" [(ngModel)]="profile" spellcheck="false"></textarea></label>
      <button class="secondary" [disabled]="!profile || api.busy()" (click)="saveProfile()">Guardar borrador de selectores</button>
      <p>Guardar desactiva la verificación del perfil. Verificar conexión comprueba sesión, RUC y controles configurados; descargas y paginación siguen pendientes de la prueba real.</p>
      <pre>{{ controls() }}</pre>
    </details></section>
  `,
})
export class ConexionSriPage {
  api = inject(Api);
  agentLaunch = inject(DomSanitizer).bypassSecurityTrustUrl('sri-automation-agent://start');
  accounts = signal<Account[]>([]); session = signal<Session | null>(null);
  system = signal<SystemInfo | null>(null); current = signal<Execution | null>(null);
  documents = signal<Voucher[]>([]); controls = signal(''); connectionError = signal(''); reportUrl = signal('');
  account = ''; date = '2026-10-12'; type = 'Facturas'; limit = 10; authorized = false; profile = '';
  types = ['Facturas','Retenciones','Notas-Credito','Notas-Debito','Liquidaciones','Guias-Remision'];
  today = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Guayaquil'}).format(new Date());
  private refreshing = false;
  workerOnline = signal(false); remoteLogout = signal(false);
  constructor() {
    void this.refresh();
    const timer = setInterval(() => void this.refresh(), 2000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  selectedTest() { return this.accounts().find(a=>a.id===this.account)?.isTest === true; }
  interactive() { return ['Ready','OpeningBrowser','WaitingForLogin','RequiresHumanAction','InspectingPortal'].includes(this.session()?.operation?.status || ''); }
  canExecute() { return this.account && this.date && this.date <= this.today && Number.isInteger(this.limit) && this.limit>=1 && this.limit<=10 && this.authorized && this.workerOnline() && this.session()?.verified && this.system()?.sri === 'SessionValidationRequired' && !['Pending','Running'].includes(this.current()?.status || ''); }
  select() { this.session.set(null); this.current.set(null); this.documents.set([]); this.reportUrl.set(''); this.authorized=false; void this.refresh(); }
  async refresh() {
    if (this.refreshing) return; this.refreshing = true;
    const selected = this.account; const date = this.date; const type = this.type;
    try {
      const [accounts, system, worker, capabilities] = await Promise.all([this.api.get<Account[]>('accounts'), this.api.get<SystemInfo>('system'),this.api.get<{online:boolean}>('worker/status'),this.api.get<{remoteLogout:boolean}>('portal/capabilities')]);
      this.accounts.set(accounts); this.system.set(system);
      this.workerOnline.set(worker.online); this.remoteLogout.set(capabilities.remoteLogout);
      if (selected) {
        const [session, jobs, docs] = await Promise.all([this.api.get<Session>('accounts/'+encodeURIComponent(selected)+'/session'),this.api.get<Execution[]>('executions'),this.api.get<{items:Voucher[]}>('documents?'+new URLSearchParams({account:selected,from:date,to:date,type}))]);
        if (selected===this.account && date===this.date && type===this.type) {
          this.session.set(session); this.documents.set(docs.items);
          const job = jobs.find(e=>e.query.account===selected && e.query.mode==='Sri'); this.current.set(job || null);
          this.reportUrl.set('');
          if (docs.items.length) {
            const url='reports/'+encodeURIComponent(selected)+'/'+date.slice(0,4)+'/'+Number(date.slice(5,7));
            // El enlace se habilita solo tras generar desde este panel; no se infiere por estado de ejecución.
            if (this.generatedFor === selected+'/'+date.slice(0,7)) this.reportUrl.set(this.api.url(url));
          }
        }
      }
      this.connectionError.set('');
    } catch { this.connectionError.set('No se pudo actualizar el estado real. Compruebe la API; la información anterior puede estar desactualizada.'); this.session.set(null); }
    finally { this.refreshing = false; }
  }
  private generatedFor='';
  async authenticate() { await this.api.action(()=>this.api.post('accounts/'+encodeURIComponent(this.account)+'/authentication',{})); await this.refresh(); }
  async command(command:string) { await this.api.action(()=>this.api.post('accounts/'+encodeURIComponent(this.account)+'/authentication/'+command,{})); await this.refresh(); }
  async logout() { await this.api.action(()=>this.api.post('accounts/'+encodeURIComponent(this.account)+'/logout',{})); await this.refresh(); }
  async execute() {
    if (!this.canExecute()) return;
    const e = await this.api.action(()=>this.api.post<Execution>('connection-tests',{account:this.account,from:this.date,to:this.date,types:[this.type],mode:'Sri',pdf:true,xml:true,maxDocuments:this.limit}));
    if (e) { this.current.set(e); this.authorized=false; } await this.refresh();
  }
  async jobAction(action:string) { const e=this.current(); if (!e) return; await this.api.action(()=>this.api.post('executions/'+e.id+'/'+action,{})); await this.refresh(); }
  async report() {
    const result=await this.api.action(()=>this.api.post<{paths:string[]}>('reports',{account:this.account,year:Number(this.date.slice(0,4)),month:Number(this.date.slice(5,7))}));
    if (result?.paths.length) { this.generatedFor=this.account+'/'+this.date.slice(0,7); await this.refresh(); }
  }
  async loadProfile() { await this.api.action(async()=>{ this.profile=JSON.stringify(await this.api.get('portal/profile'),null,2); this.controls.set(JSON.stringify(await this.api.get('portal/controls'),null,2)); }); }
  async saveProfile() { await this.api.action(async()=>this.api.put('portal/profile',JSON.parse(this.profile)), 'Borrador guardado. Verificación real pendiente.'); await this.refresh(); }
}
