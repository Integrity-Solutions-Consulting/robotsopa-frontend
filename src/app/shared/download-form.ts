import { Component, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Api, Account, Query } from '../core/api';
@Component({selector:'app-query-form',imports:[ReactiveFormsModule],template:`
  <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
    <label>Cuenta SRI<select aria-label="Cuenta SRI" formControlName="account" (change)="api.activeAccount.set(form.controls.account.value)"><option value="">Seleccione una cuenta</option>
      @for(a of accounts();track a.id){<option [value]="a.id">{{ a.name }}</option>}
    </select></label>
    <label>Fecha inicial<input type="date" formControlName="from" [max]="today" /></label>
    <label>Fecha final<input type="date" formControlName="to" [min]="form.controls.from.value" [max]="today" /></label>
    <fieldset class="full"><legend>Tipos de comprobante · {{ selected().length }} seleccionados</legend>
      <div class="actions"><button type="button" class="secondary" (click)="selected.set([...types])">Seleccionar todos</button><button type="button" class="secondary" (click)="selected.set([])">Deseleccionar todos</button></div>
      @for(t of types;track t){<label class="inline"><input type="checkbox" [checked]="selected().includes(t)" (change)="toggle(t)" />{{ names[t] }}</label>}
    </fieldset>
    <p class="full muted">El bot utilizará la contraseña cifrada del perfil para ingresar al portal oficial y continuar en segundo plano. CAPTCHA o MFA requieren su intervención. El rango máximo es de un año; se descargarán los PDF encontrados.</p>
    <details class="full"><summary>Opciones adicionales</summary><div class="form-grid">
      <label>Operación<select formControlName="mode"><option value="Sri">Descargar del SRI</option><option value="Stored">Actualizar Excel desde archivos almacenados</option></select></label>
      <label>Establecimiento<input formControlName="establishment" maxlength="3" /></label><label>Punto de emisión<input formControlName="emissionPoint" maxlength="3" /></label>
    </div></details>
    @if(error()){<p class="error full">{{ error() }}</p>}
    <div class="actions full"><button [disabled]="form.invalid||!selected().length||api.busy()">{{ label() }}</button><ng-content /></div>
  </form>`})
export class QueryForm {
  api=inject(Api);fb=inject(FormBuilder);accounts=signal<Account[]>([]);selected=signal(['Facturas']);error=signal('');
  label=input('Descargar comprobantes');submitted=output<Query>();
  types=['Facturas','Retenciones','Notas-Credito','Notas-Debito','Liquidaciones','Guias-Remision'];
  names:Record<string,string>={'Facturas':'Facturas','Retenciones':'Retenciones','Notas-Credito':'Notas de crédito','Notas-Debito':'Notas de débito','Liquidaciones':'Liquidaciones','Guias-Remision':'Guías de remisión'};
  today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil'}).format(new Date());
  form=this.fb.nonNullable.group({account:[this.api.activeAccount(),Validators.required],from:[this.today,Validators.required],to:[this.today,Validators.required],mode:['Sri'],establishment:['',Validators.pattern(/^\d{3}$|^$/)],emissionPoint:['',Validators.pattern(/^\d{3}$|^$/)]});
  constructor(){void this.api.action(async()=>{this.accounts.set(await this.api.get<Account[]>('accounts'));if(!this.form.controls.account.value)this.form.controls.account.setValue(this.api.activeAccount());});}
  toggle(type:string){this.selected.update(items=>items.includes(type)?items.filter(t=>t!==type):[...items,type]);}
  value():Query{return {...this.form.getRawValue(),types:[...this.selected()],pdf:true,xml:false,authorizationStatus:'Autorizado'};}
  submit(){const q=this.value();if(!q.from||!q.to){this.error.set('Revise las fechas seleccionadas.');return;}const limit=new Date(q.from+'T00:00:00Z');const month=limit.getUTCMonth();limit.setUTCFullYear(limit.getUTCFullYear()+1);if(limit.getUTCMonth()!==month)limit.setUTCDate(0);limit.setUTCDate(limit.getUTCDate()-1);this.error.set(q.to<q.from||q.to>this.today?'Revise las fechas seleccionadas.':q.to>limit.toISOString().slice(0,10)?'El rango máximo es de un año.':'');if(this.form.valid&&this.selected().length&&!this.error())this.submitted.emit(q);}
}
