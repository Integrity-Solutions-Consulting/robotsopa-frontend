import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Account } from '../../core/api';
@Component({
  selector:'sri-reportes',
  imports: [FormsModule],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">REPORTES</p>
        <h1>Excel mensuales</h1>
        <p>Reconstruye reportes desde documentos almacenados, sin consultar el SRI.</p>
      </div>
    </div>
    <section class="card">
      <div class="form-grid">
        <label
          >Cuenta<select [(ngModel)]="account">
            <option value="">Seleccione una cuenta</option>
            @for (a of accounts(); track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select></label
        ><label>Mes inicial<input type="month" [(ngModel)]="month" /></label
        ><label>Mes final del rango<input type="month" [(ngModel)]="end" /></label>
      </div>
      <div class="actions">
        <button [disabled]="!account || !month || api.busy()" (click)="generate(false)">
          Generar / actualizar mes</button
        ><button
          class="secondary"
          [disabled]="!account || !month || !end || api.busy()"
          (click)="generate(true)"
        >
          Generar rango
        </button>
      </div>
      <p class="muted">Cada mes contiene Documentos, Resumen por tipo y Pendientes.</p>
    </section>
    @if (generated().length) {
      <section class="card">
        <h2>Reportes listos</h2>
        @for (m of generated(); track m) {
          <p>
            <a [href]="download(m)">Descargar Excel {{ m }}</a>
          </p>
        }
      </section>
    }`,
})
export class ReportesPage {
  api = inject(Api);
  accounts = signal<Account[]>([]);
  account = '';
  month = '';
  end = '';
  generatedAccount = '';
  generated = signal<string[]>([]);
  constructor() {
    void this.api.action(async () => this.accounts.set(await this.api.get<Account[]>('accounts')));
  }
  async generate(range: boolean) {
    if (range && this.end < this.month) {
      this.api.notice.set('El mes final debe ser posterior al inicial.');
      return;
    }
    const [year, month] = this.month.split('-').map(Number);
    const result = await this.api.action(
      () =>
        this.api.post<{ paths: string[] }>('reports', {
          account: this.account,
          year,
          month,
          to: range ? this.end + '-01' : null,
        }),
      'Reportes actualizados.',
    );
    if (result) {
      this.generatedAccount = this.account;
      const months: string[] = [];
      let current = this.month;
      while (current <= (range ? this.end : this.month)) {
        months.push(current);
        const [y, m] = current.split('-').map(Number);
        current = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      }
      this.generated.set(months);
    }
  }
  download(month: string) {
    const [y, m] = month.split('-');
    return `/api/v1/reports/${encodeURIComponent(this.generatedAccount || this.account)}/${y}/${Number(m)}`;
  }
}
