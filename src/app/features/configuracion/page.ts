import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Account } from '../../core/api';
import { DataTable } from '../../shared/data-table';
@Component({
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">ADMINISTRACIÓN</p>
        <h1>Configuración</h1>
        <p>Cuentas autorizadas y estado del almacenamiento.</p>
      </div>
    </div>
    <div class="two-col">
      <section class="card">
        <h2>Registrar cuenta</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label
            >Identificador de cuenta / RUC<input formControlName="id" autocomplete="off" /></label
          ><label>Nombre descriptivo<input formControlName="name" /></label
          ><label
            >RUC del emisor (si usa un alias de cuenta)<input
              formControlName="taxId"
              maxlength="13"
          /></label>
          <p class="muted">No almacene contraseñas del SRI en estos campos.</p>
          <button [disabled]="form.invalid || api.busy()">Guardar cuenta</button>
        </form>
      </section>
      <section class="card">
        <h2>Sistema</h2>
        <p class="muted">
          Autentique y supervise su cuenta desde Prueba de conexión SRI. La contraseña
          se introduce directamente en el portal oficial; Angular no la recibe.
        </p>
        <a routerLink="/conexion-sri" class="button">Abrir Prueba de conexión SRI</a>
        <label
          >Sesión SRI por cuenta<select
            #sessionAccount
            (change)="checkSession(sessionAccount.value)"
          >
            <option value="">Seleccione una cuenta</option>
            @for (a of accounts(); track a.id) {
              <option [value]="a.id">{{ a.name }}</option>
            }
          </select></label
        >
        <p>{{ sessionStatus() }}</p>
        @if (system(); as s) {
          <p>
            Destino interno: <code>{{ s.outputPath }}</code>
          </p>
          <p>Destino del host: {{ s.outputHostPath || 'No informado' }}</p>
          <p>Zona horaria: {{ s.timezone }}</p>
          <span class="badge">SRI: {{ s.sri }}</span>
        }
        <p>Las credenciales del panel se configuran mediante variables de entorno.</p>
      </section>
    </div>
    <section class="card">
      <h2>Cuentas registradas</h2>
      <div class="table-wrap"><table><thead><tr><th>Identificador</th><th>Alias</th><th>RUC</th><th>Configuración</th><th>Acciones</th></tr></thead><tbody>
      @for (a of accounts(); track a.id) {
        <tr><td>{{ a.id }}</td><td><input [attr.aria-label]="'Alias de '+a.id" [disabled]="api.busy()" [value]="aliases()[a.id] ?? a.name" (input)="editAlias(a.id,$event)" /></td><td>{{ a.taxId || 'Pendiente' }}</td>
        <td>{{ a.isTest ? 'Prueba local; SRI no disponible' : a.taxId ? 'RUC configurado; autenticación por verificar' : 'NotConfigured' }}</td>
        <td><button class="secondary" [disabled]="api.busy()" (click)="rename(a)">Guardar alias</button><button class="danger" [disabled]="api.busy()" (click)="remove(a)">Eliminar configuración</button></td></tr>
      } @empty { <tr><td colspan="5">Sin cuentas registradas.</td></tr> }
      </tbody></table></div>
    </section>`,
})
export class ConfiguracionPage {
  api = inject(Api);
  fb = inject(FormBuilder);
  accounts = signal<Account[]>([]);
  aliases = signal<Record<string,string>>({});
  sessionStatus = signal('Seleccione una cuenta para comprobar la presencia de su sesión cifrada.');
  system = signal<{
    outputPath: string;
    outputHostPath: string;
    timezone: string;
    sri: string;
  } | null>(null);
  form = this.fb.nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]{1,100}$/)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    taxId: ['', Validators.pattern(/^[0-9]{13}$|^$/)],
  });
  constructor() {
    void this.load();
  }
  rows() {
    return this.accounts().map((a) => [a.id, a.name]);
  }
  async load() {
    await this.api.action(async () => {
      this.accounts.set(await this.api.get<Account[]>('accounts'));
      this.system.set(await this.api.get('system'));
    });
  }
  async save() {
    if (this.form.invalid) return;
    const result = await this.api.action(
      () => this.api.post('accounts', this.form.getRawValue()),
      'Cuenta registrada.',
    );
    if (result) this.form.reset();
    await this.load();
  }
  async checkSession(account: string) {
    if (!account) return;
    const status = await this.api.action(() =>
      this.api.get<{ present: boolean; status: string; message: string }>(
        'accounts/' + encodeURIComponent(account) + '/session',
      ),
    );
    if (status) this.sessionStatus.set(status.status + ': ' + status.message);
  }
  editAlias(id: string,event: Event) { const name=(event.target as HTMLInputElement).value; this.aliases.update(values=>({...values,[id]:name})); }
  async rename(a: Account) {
    const name=this.aliases()[a.id] ?? a.name;
    const result=await this.api.action(()=>this.api.put('accounts/'+encodeURIComponent(a.id),{name}),'Alias actualizado.');
    await this.load();
    if (result) this.aliases.update(values=>{const next={...values};delete next[a.id];return next;});
  }
  async remove(a: Account) {
    if (!confirm('¿Eliminar la configuración de '+a.name+'? Los documentos e historial se conservan.')) return;
    await this.api.action(()=>this.api.delete('accounts/'+encodeURIComponent(a.id)),'Configuración eliminada.'); await this.load();
  }
}
