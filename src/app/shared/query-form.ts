import { Component, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Api, Account, Query } from '../core/api';

@Component({
  selector: 'app-query-form',
  imports: [ReactiveFormsModule],
  template: ` <label>Configuración guardada<select #saved (change)="loadConfiguration(saved.value)">
    <option value="">Seleccione una configuración para cargarla</option>
    @for (q of configurations(); track $index) { <option [value]="$index">{{ q.account }} · {{ q.from }} → {{ q.to }} · {{ q.mode }}</option> }
  </select></label>
  <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
    <label
      >Cuenta SRI<select formControlName="account">
        <option value="">Seleccione una cuenta</option>
        @for (a of accounts(); track a.id) {
          <option [value]="a.id">{{ a.name }} · {{ a.id }}</option>
        }
      </select></label
    >
    <label
      >Operación<select formControlName="mode">
        <option value="Sri">Consultar SRI (requiere validar integración)</option>
        <option value="Stored">Procesar documentos almacenados</option>
      </select></label
    >
    <label>Desde<input type="date" formControlName="from" [max]="today" required /></label>
    <label
      >Hasta<input
        type="date"
        formControlName="to"
        [min]="form.controls.from.value"
        [max]="today"
        required
    /></label>
    <label
      >Establecimiento<input formControlName="establishment" placeholder="001" maxlength="3"
    /></label>
    <label
      >Punto de emisión<input formControlName="emissionPoint" placeholder="001" maxlength="3"
    /></label>
    <label
      >Estado<select formControlName="authorizationStatus">
        <option>Autorizado</option>
      </select></label
    >
    <label
      >Destino<input value="Carpeta configurada / cuenta / año / mes" readonly
    /></label>
    <fieldset class="full">
      <legend>Tipos de comprobante</legend>
      @for (t of types; track t) {
        <label class="inline"
          ><input type="checkbox" [checked]="selected().includes(t)" (change)="toggle(t)" />{{
            t
          }}</label
        >
      }
    </fieldset>
    <div class="full">
      <span>Se descargan archivos PDF.</span>
    </div>
    @if (form.controls.mode.value === 'Sri') {
      <p class="muted full">
        El rango máximo es de un año. Se consultan todos los comprobantes disponibles.
      </p>
      <label class="inline full"
        ><input type="checkbox" formControlName="broadRangeApproved" />Autorizo expresamente
        consultar el rango y los tipos seleccionados si exceden la prueba de un día y un tipo. Se
        mantienen los límites del perfil local.</label
      >
    }
    @if (invalidRange()) {
      <p class="error full">Revise el rango de fechas y los tipos seleccionados.</p>
    }
    <div class="actions full">
      <button [disabled]="form.invalid || api.busy()">{{ label() }}</button><ng-content />
    </div>
  </form>`,
})
export class QueryForm {
  api = inject(Api);
  private fb = inject(FormBuilder);
  accounts = signal<Account[]>([]);
  configurations = signal<Query[]>([]);
  selected = signal(['Facturas']);
  invalidRange = signal(false);
  label = input('Crear ejecución');
  submitted = output<Query>();
  today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guayaquil' }).format(new Date());
  types = [
    'Facturas',
    'Retenciones',
    'Notas-Credito',
    'Notas-Debito',
    'Liquidaciones',
    'Guias-Remision',
  ];
  form = this.fb.nonNullable.group({
    account: ['', Validators.required],
    from: [this.today, Validators.required],
    to: [this.today, Validators.required],
    mode: ['Sri'],
    pdf: [true],
    xml: [true],
    establishment: ['', Validators.pattern(/^\d{3}$|^$/)],
    emissionPoint: ['', Validators.pattern(/^\d{3}$|^$/)],
    authorizationStatus: ['Autorizado'],
    broadRangeApproved: [false],
  });
  constructor() {
    void this.api.action(async () => {
      const [accounts, configurations] = await Promise.all([this.api.get<Account[]>('accounts'), this.api.get<Query[]>('configurations')]);
      this.accounts.set(accounts); this.configurations.set(configurations);
    });
  }
  loadConfiguration(index: string) {
    if (index === '') return;
    const q=this.configurations()[Number(index)]; if (!q) return;
    this.form.patchValue({...q,pdf:true,xml:false,broadRangeApproved:false});
    this.selected.set([...q.types]);
  }
  toggle(type: string) {
    this.selected.update((items) =>
      items.includes(type) ? items.filter((t) => t !== type) : [...items, type],
    );
  }
  value(): Query {
    return { ...this.form.getRawValue(), types: this.selected(), pdf:true, xml:false };
  }
  submit() {
    const q = this.value();
    this.invalidRange.set(q.from > q.to || q.to > this.today || !q.types.length);
    if (this.form.valid && !this.invalidRange()) this.submitted.emit(q);
  }
}
