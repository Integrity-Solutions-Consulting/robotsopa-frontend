import { Component, inject, signal, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api, Dashboard } from '../../core/api';
import { DataTable } from '../../shared/data-table';
@Component({
  imports: [DataTable, DatePipe],
  template: ` <div class="page-heading">
      <div>
        <p class="eyebrow">CENTRO DE OPERACIONES</p>
        <h1>Resumen general</h1>
        <p>Consulta el estado de tus documentos y procesos.</p>
      </div>
      <button class="secondary" (click)="load()">Actualizar</button>
    </div>
    @if (data(); as d) {
      <p class="muted">
        {{ d.scope }} · {{ d.sriDocuments || 0 }} comprobantes descargados por el motor SRI ·
        {{ d.importedDocuments || 0 }} importados
      </p>
      <div class="metrics">
        <article class="card">
          <span>Comprobantes</span><strong>{{ d.documents }}</strong>
        </article>
        <article class="card">
          <span>Archivos guardados</span><strong>{{ d.downloaded }}</strong>
        </article>
        <article class="card">
          <span>Ejecuciones completadas</span><strong>{{ d.completed }}</strong>
        </article>
        <article class="card">
          <span>Ejecuciones fallidas</span><strong>{{ d.failed }}</strong>
        </article>
      </div>
      <div class="two-col">
        <section class="card">
          <h2>Estado del sistema</h2>
          <p>
            <span class="badge" [class.good]="d.workerOnline"
              >Worker {{ d.workerOnline ? 'activo' : 'sin conexión' }}</span
            >
          </p>
          <p>
            Próxima ejecución:
            {{ (d.next | date: 'dd/MM/yyyy HH:mm' : '-0500') || 'Sin programaciones' }}
          </p>
          <p>Última ejecución: {{ d.last?.status || 'Sin ejecuciones' }}</p>
        </section>
        <section class="card">
          <h2>Integración con SRI</h2>
          <p>
            La primera consulta requiere validar la navegación y los selectores en una sesión
            autorizada.
          </p>
          <p class="muted">Los reportes sobre documentos importados están disponibles.</p>
        </section>
      </div>
      <section class="card">
        <h2>Actividad reciente</h2>
        <app-data-table [headers]="['Cuenta', 'Inicio', 'Estado', 'Procesados']" [rows]="rows()" />
      </section>
    } @else {
      <section class="card empty">Cargando información del sistema…</section>
    }`,
})
export class DashboardPage {
  api = inject(Api);
  data = signal<Dashboard | null>(null);
  constructor() {
    void this.load();
    const timer = setInterval(() => void this.load(false), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  rows() {
    return (
      this.data()?.recent.map((e) => [
        e.query.account,
        new Date(e.created).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }),
        e.status,
        e.processed,
      ]) ?? []
    );
  }
  async load(show = true) {
    if (show)
      await this.api.action(async () => this.data.set(await this.api.get<Dashboard>('dashboard')));
    else
      try {
        this.data.set(await this.api.get<Dashboard>('dashboard'));
      } catch {
        /* Mantener vista ante corte transitorio. */
      }
  }
}
