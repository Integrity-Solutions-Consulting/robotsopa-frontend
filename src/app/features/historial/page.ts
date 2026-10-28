import { Component, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, Execution } from '../../core/api';
@Component({
  selector:'sri-ejecuciones',
  imports: [DatePipe, RouterLink],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">TRAZABILIDAD</p>
        <h1>Historial de ejecuciones</h1>
        <p>Progreso persistente y resultados del Worker.</p>
      </div>
      <button class="secondary" (click)="load()">Actualizar</button>
    </div>
    <section class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cuenta / rango</th>
              <th>Inicio</th>
              <th>Finalización</th>
              <th>Duración</th>
              <th>Estado</th>
              <th>Resultados</th>
              <th>Detalles</th>
            </tr>
          </thead>
          <tbody>
            @for (e of executions(); track e.id) {
              <tr>
                <td>
                  {{ e.query.account }}<small>{{ e.query.from }} → {{ e.query.to }}</small>
                </td>
                <td>{{ e.created | date: 'dd/MM/yyyy HH:mm' : '-0500' }}</td>
                <td>{{ e.finished | date: 'dd/MM/yyyy HH:mm' : '-0500' }}</td>
                <td>{{ duration(e) }}</td>
                <td>
                  <span class="badge">{{ e.status }}</span>
                </td>
                <td>{{ e.processed }} / {{ e.found }} · {{ e.errors }} errores</td>
                <td>
                  <details>
                    <summary>Ver detalles</summary>
                    <p>{{ e.message }}</p>
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
                    <p class="muted">
                      Complete la conexión o verificación humana en Configuración y reanude.
                    </p>
                    <a routerLink="/configuracion">Conectar cuenta SRI</a>
                    <button class="secondary" (click)="resume(e)">Reanudar</button>
                  }
                  @if (
                    e.status === 'Failed' ||
                    e.status === 'Cancelled' ||
                    e.status === 'CompletedWithWarnings'
                  ) {
                    <button class="secondary" (click)="retry(e)">Reintentar trabajo</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">Todavía no hay ejecuciones.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>`,
})
export class HistorialPage {
  api = inject(Api);
  executions = signal<Execution[]>([]);
  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  async load() {
    await this.api.action(async () =>
      this.executions.set(await this.api.get<Execution[]>('executions')),
    );
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
  async resume(e: Execution) {
    await this.api.action(
      () => this.api.post('executions/' + e.id + '/resume', {}),
      'Reanudación solicitada.',
    );
    await this.load();
  }
  async retry(e: Execution) {
    await this.api.action(
      () => this.api.post('executions/' + e.id + '/retry', {}),
      'Nuevo intento en cola; el historial anterior se conserva.',
    );
    await this.load();
  }
}
