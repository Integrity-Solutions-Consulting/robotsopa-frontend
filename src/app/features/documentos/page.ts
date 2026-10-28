import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Account, Voucher } from '../../core/api';
@Component({
  selector:'sri-documentos',
  imports: [FormsModule],
  template: ` <div class="page-heading">
      <div>
        <p class="eyebrow">ARCHIVO DIGITAL</p>
        <h1>Documentos</h1>
        <p>Archivos almacenados y metadatos extraídos del XML.</p>
      </div>
    </div>
    <section class="card">
      <div class="filters">
        <label
          >Cuenta<select [ngModel]="account" (ngModelChange)="selectAccount($event)">
            <option value="">Todas las cuentas</option>
            @for (a of accounts(); track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select></label
        ><label>Buscar<input [(ngModel)]="search" placeholder="Receptor o número" /></label
        ><label
          >Tipo<select [(ngModel)]="type">
            <option value="">Todos</option>
            @for (t of types; track t) {
              <option>{{ t }}</option>
            }
          </select></label
        ><label
          >Estado<select [(ngModel)]="status">
            <option value="">Todos</option>
            <option>ValidadoXML</option>
            <option>Revisar</option>
          </select></label
        ><label>Desde<input type="date" [(ngModel)]="from" /></label
        ><label>Hasta<input type="date" [(ngModel)]="to" /></label
        ><button (click)="page = 1; load()">Filtrar</button>
      </div>
    </section>
    <section class="card">
      <h2>Importar documentos existentes</h2>
      <button class="secondary" [disabled]="!account || api.busy()" (click)="reindex()">
        Reconstruir catálogo desde XML
      </button>
      <p>
        Seleccione una cuenta para importar XML o asociar un PDF a su comprobante. No consulta el
        SRI.
      </p>
      <label
        >Archivo XML<input
          type="file"
          accept=".xml"
          [disabled]="!account || api.busy()"
          (change)="importXml($event)"
      /></label>
    </section>
    <section class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo / número</th>
              <th>Emisión</th>
              <th>Receptor</th>
              <th>Identificación</th>
              <th>Subtotal</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Archivos</th>
            </tr>
          </thead>
          <tbody>
            @for (d of documents(); track d.id) {
              <tr>
                <td>
                  {{ d.type }}<small>{{ d.number }}</small>
                </td>
                <td>{{ d.issued }}</td>
                <td>{{ d.recipient || '—' }}</td>
                <td>{{ d.identification || '—' }}</td>
                <td>{{ d.subtotal ?? '—' }}</td>
                <td>{{ d.total ?? '—' }}</td>
                <td>
                  <span class="badge" [title]="d.warning || ''">{{ d.status }}</span>
                </td>
                <td>
                  <div class="actions">
                    @if (d.xmlPath) {
                      <a [href]="url(d.id, 'xml')">XML</a>
                    }
                    @if (d.pdfPath) {
                      <a [href]="url(d.id, 'pdf')">PDF</a>
                    }
                    <label class="upload"
                      >Asociar PDF<input
                        type="file"
                        accept=".pdf"
                        (change)="importPdf($event, d.id)"
                    /></label>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="empty">
                  No hay documentos para estos filtros. Importe un XML para comenzar.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <button class="secondary" [disabled]="page <= 1" (click)="page = page - 1; load()">
          Anterior</button
        ><span>Página {{ page }} · {{ total() }} documentos</span
        ><button
          class="secondary"
          [disabled]="page * 20 >= total()"
          (click)="page = page + 1; load()"
        >
          Siguiente
        </button>
      </div>
    </section>`,
})
export class DocumentosPage {
  api = inject(Api);
  accounts = signal<Account[]>([]);
  documents = signal<Voucher[]>([]);
  total = signal(0);
  account = this.api.activeAccount();
  private requestVersion=0;
  search = '';
  type = '';
  status = '';
  from = '';
  to = '';
  page = 1;
  types = [
    'Facturas',
    'Retenciones',
    'Notas-Credito',
    'Notas-Debito',
    'Liquidaciones',
    'Guias-Remision',
  ];
  constructor() {
    void this.api.action(async () => this.accounts.set(await this.api.get<Account[]>('accounts')));
    void this.load();
  }
  async load() {
    const version=++this.requestVersion;const account=this.account;
    await this.api.action(async () => {
      const params = new URLSearchParams({ page: String(this.page), pageSize: '20' });
      for (const [key, value] of Object.entries({
        account: this.account,
        search: this.search,
        type: this.type,
        status: this.status,
        from: this.from,
        to: this.to,
      }))
        if (value) params.set(key, value);
      const data = await this.api.get<{ items: Voucher[]; total: number }>('documents?' + params);
      if(version===this.requestVersion&&account===this.account){this.documents.set(data.items);this.total.set(data.total);}
    });
  }
  selectAccount(account:string){this.account=account;this.page=1;this.documents.set([]);this.total.set(0);if(account)this.api.activeAccount.set(account);void this.load();}
  async reindex() {
    await this.api.action(
      () => this.api.post('documents/reindex/' + encodeURIComponent(this.account), {}),
      'Catálogo reconstruido. Revise los estados de extracción.',
    );
    await this.load();
  }
  url(id: string, extension: string) {
    return '/api/v1/documents/' + id + '/' + extension;
  }
  async importXml(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.account) return;
    await this.api.action(
      () => this.api.post('documents/import/' + encodeURIComponent(this.account), file),
      'XML importado.',
    );
    input.value = '';
    await this.load();
  }
  async importPdf(event: Event, id: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.api.action(() => this.api.post('documents/' + id + '/pdf', file), 'PDF asociado.');
    input.value = '';
    await this.load();
  }
}
