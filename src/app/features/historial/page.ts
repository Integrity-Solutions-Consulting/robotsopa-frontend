import { Component, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Execution, Account } from '../../core/api';
@Component({
  selector:'sri-ejecuciones',
  imports: [DatePipe, UpperCasePipe, FormsModule],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">TRAZABILIDAD</p>
        <h1>Historial de ejecuciones</h1>
        <p>Progreso y resultados de las descargas.</p>
      </div>
      <button class="secondary" (click)="load()">Actualizar</button>
    </div>
    <section class="card">
      <label>Filtrar por estado <select [(ngModel)]="filter"><option value="">Todos</option><option value="Pending">Pendiente</option><option value="Running">Ejecutando</option><option value="Cancelling">Cancelando</option><option value="Completed">Completado</option><option value="Cancelled">Cancelado</option><option value="Failed">Fallido</option><option value="RequiresHumanAction">Requiere intervención humana</option><option value="CompletedWithWarnings">Completado con pendientes</option></select></label>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cuenta / rango</th>
              <th>Usuario</th>
              <th>Inicio</th>
              <th>Finalización</th>
              <th>Duración</th>
              <th>Estado</th>
              <th>Resultados</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>
            @for (e of filtered(); track e.id) {
              <tr>
                <td>
                  {{ accountName(e.query.account) }}<small>{{ e.query.mode === 'Sri' ? 'Descarga SRI' : 'Actualización de reportes' }} · {{ e.query.from }} → {{ e.query.to }}</small>
                </td>
                <td>{{ e.requestedBy || 'Sistema' }}</td>
                <td>{{ e.created | date: 'dd/MM/yyyy HH:mm' : '-0500' }}</td>
                <td>{{ e.finished | date: 'dd/MM/yyyy HH:mm' : '-0500' }}</td>
                <td>{{ duration(e) }}</td>
                <td>
                  <span class="badge">{{ status(e.status) }}</span>
                  <small>{{ e.message }}</small>
                  @if (queryTotal(e) > 0) {
                    <label>Consultas SRI: {{ queryDone(e) }} / {{ queryTotal(e) }}
                      <progress [value]="queryDone(e)" [max]="queryTotal(e)"></progress>
                    </label>
                  }
                </td>
                <td>{{ e.processed }} / {{ e.found }} · {{ e.reviews ?? 0 }} en revisión · {{ e.errors }} errores</td>
                <td>
                  <details>
                    <summary>Ver detalles</summary>
                    <p>{{ e.message }}</p>
                    @if (e.deliveryTotal) { <p>Entregas confirmadas: {{ e.deliveryCompleted || 0 }} / {{ e.deliveryTotal }}</p> }
                    @if (e.deliveryError) { <p class="error">{{ e.deliveryError }}</p> }
                    @if (e.status === 'WaitingForDelivery') { <p>Entrega historica pendiente de revision. No se ha confirmado la entrega; los archivos permanecen en el servidor.</p> }
                    <small>{{ e.id }} · {{ e.checkpoint }}</small>
                    @for (q of e.queries || []; track $index) {
                      <p>
                        {{ q.date }} · {{ q.type }} · {{ q.found }} encontrados ·
                        {{ q.downloaded }} descargados · {{ q.status }}
                      </p>
                    }
                    @for (issue of e.issues || []; track $index) {
                      <p class="error">{{ issue }}</p>
                    }
                  </details>
                  @if (
                    e.status === 'Running' ||
                    e.status === 'Pending' ||
                    e.status === 'RequiresHumanAction'
                  ) {
                    <button class="secondary" (click)="cancel(e)">Cancelar</button>
                  }
                  @if (e.status === 'RequiresHumanAction') {
                    <p class="muted">Si el SRI solicita CAPTCHA o MFA, complételo en el equipo Windows donde funciona el agente.</p>
                    <button class="secondary" [disabled]="api.busy()" (click)="jobAction(e, 'resume')">Reanudar</button>
                  }
                  @if (['Failed', 'Cancelled', 'CompletedWithWarnings'].includes(e.status)) { <button class="secondary" [disabled]="api.busy()" (click)="jobAction(e, 'retry')">Reintentar</button> }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="empty">No hay ejecuciones para el filtro seleccionado.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section class="card"><h2>Entregas recientes al escritorio</h2><p class="muted">Se muestran las últimas 100 entregas de su usuario, por archivo. Una entrega no confirma por sí sola el resultado de una ejecución.</p>
      @if(deliveryUnavailable()){<p>No se pudo consultar el estado de las entregas.</p>}
      @for(d of deliveries();track $index){<p>{{accountName(d.accountId)}} · {{d.kind | uppercase}} · {{d.status === 'Delivered' ? 'Entrega confirmada' : 'Pendiente de entrega'}} · {{(d.deliveredAt || d.createdAt) | date:'dd/MM/yyyy HH:mm':'-0500'}} @if(d.lastError){<span class="error">- No se pudo entregar; el agente volverá a intentarlo.</span>}</p>} @empty { @if(!deliveryUnavailable()){<p>No hay entregas recientes.</p>} }
    </section>`,
})
export class HistorialPage {
  api = inject(Api);
  executions = signal<Execution[]>([]);
  accounts = signal<Account[]>([]);
  deliveries = signal<{accountId:string;kind:string;status:string;lastError:string|null;createdAt:string;deliveredAt:string|null}[]>([]);
  deliveryUnavailable = signal(false);
  filter = '';
  filtered() { return this.executions().filter(e => !this.filter || e.status === this.filter); }
  accountName(id: string) { return this.accounts().find(a => a.id === id)?.name || id; }
  status(value: string) { return ({Pending:'Pendiente',Running:'Ejecutando',Cancelling:'Cancelando...',Completed:'Completado',Cancelled:'Cancelado',Failed:'Fallido',RequiresHumanAction:'Requiere intervención humana',CompletedWithWarnings:'Completado con pendientes'} as Record<string,string>)[value] || value; }
  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  async load() {
    try { const [executions, accounts] = await Promise.all([this.api.get<Execution[]>('executions'), this.api.get<Account[]>('accounts')]); this.executions.set(executions); this.accounts.set(accounts); }
    catch { this.api.notify('No se pudo actualizar el historial.', 'error'); }
    try { this.deliveries.set(await this.api.get<{accountId:string;kind:string;status:string;lastError:string|null;createdAt:string;deliveredAt:string|null}[]>('delivery-queue')); this.deliveryUnavailable.set(false); } catch { this.deliveryUnavailable.set(true); }
  }
  queryTotal(e: Execution): number {
    if (e.query.mode !== 'Sri') return 0;
    const days = Math.floor((Date.parse(e.query.to + 'T00:00:00Z') - Date.parse(e.query.from + 'T00:00:00Z')) / 86400000) + 1;
    return Number.isFinite(days) && days > 0 ? days * e.query.types.length : 0;
  }
  queryDone(e: Execution): number {
    const completed = (e.queries ?? []).filter(q => ['Consultado', 'SinDocumentos', 'ConErrores'].includes(q.status));
    return Math.min(this.queryTotal(e), new Set(completed.map(q => q.date + '|' + q.type)).size);
  }
  async jobAction(e: Execution, action: 'resume'|'retry') {
    if (e.query.mode === 'Sri' && !confirm('¿Autoriza ' + (action === 'resume' ? 'reanudar' : 'reintentar') + ' la consulta SRI con los mismos filtros?')) return;
    await this.api.action(() => this.api.post('executions/' + encodeURIComponent(e.id) + '/' + action, {}));
    await this.load();
  }
  async cancel(e: Execution) {
    await this.api.action(
      () => this.api.post('executions/' + e.id + '/cancel', {}),
      'Cancelación solicitada.',
    );
    await this.load();
  }
  duration(e: Execution) {
    return e.started
      ? Math.max(
          0,
          Math.round(
            (new Date(e.finished ?? new Date()).getTime() - new Date(e.started).getTime()) / 1000,
          ),
        ) + ' s'
      : '—';
  }
}
