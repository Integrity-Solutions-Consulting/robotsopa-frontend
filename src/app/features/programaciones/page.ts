import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Query, Schedule } from '../../core/api';
import { QueryForm } from '../../shared/download-form';
@Component({
  selector:'sri-programaciones',
  imports: [FormsModule, QueryForm],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">AUTOMATIZACIÓN</p>
        <h1>Programaciones</h1>
        <p>El Worker mantiene las tareas aunque cierre Angular. El bot usa la contraseña cifrada del perfil. CAPTCHA o MFA requieren intervención humana. La descarga fiscal automática continúa pendiente de validación real.</p>
      </div>
    </div>
    <section class="card">
      <div class="form-grid">
        <label
          >Frecuencia<select [(ngModel)]="frequency">
            <option value="Once">Una vez</option>
            <option value="Daily">Diaria</option>
            <option value="Weekly">Semanal</option>
            <option value="Monthly">Mensual</option>
            <option value="Custom">Cada varios días</option>
          </select></label
        ><label
          >Próxima ejecución (Guayaquil)<input type="datetime-local" [(ngModel)]="next" required
        /></label>
      </div>
      @if(frequency==='Custom'){<label>Intervalo en días<input type="number" [(ngModel)]="intervalDays" min="1" max="365" /></label>}
      <app-query-form label="Crear programación" (submitted)="create($event)" />
    </section>
    <section class="card">
      <h2>Programaciones guardadas</h2>
      @for (s of schedules(); track s.id) {
        <article class="schedule">
          <div>
            <strong>{{ s.query.account }}</strong
            ><small>{{ s.query.from }} → {{ s.query.to }} · {{ s.query.mode }}</small>
          </div>
          <label
            >Frecuencia<select [(ngModel)]="s.frequency">
              <option value="Once">Una vez</option>
              <option value="Daily">Diaria</option>
              <option value="Weekly">Semanal</option>
              <option value="Monthly">Mensual</option>
              <option value="Custom">Cada varios días</option>
            </select></label
          ><label
            >Próxima ejecución<input
              type="datetime-local"
              [ngModel]="localDate(s.next)"
              (ngModelChange)="s.next = $event + '-05:00'" /></label
          ><span class="badge">{{ s.enabled ? 'Activa' : 'Inactiva' }}</span>
          @if(s.frequency==='Custom'){<label>Intervalo en días<input type="number" [(ngModel)]="s.intervalDays" min="1" max="365" /></label>}
          <div class="actions">
            <button class="secondary" (click)="update(s)">Guardar cambios</button
            ><button class="secondary" (click)="s.enabled = !s.enabled; update(s)">
              {{ s.enabled ? 'Desactivar' : 'Activar' }}</button
            ><button class="secondary" (click)="run(s)">Ejecutar ahora</button
            ><button class="danger" (click)="remove(s)">Eliminar</button>
          </div>
        </article>
      } @empty {
        <p class="empty">No hay programaciones guardadas.</p>
      }
    </section>`,
})
export class ProgramacionesPage {
  api = inject(Api);
  schedules = signal<Schedule[]>([]);
  frequency = 'Daily';
  intervalDays=1;
  next = '';
  constructor() {
    void this.load();
  }
  localDate(value: string) {
    const d = new Date(new Date(value).getTime() - 5 * 3600000);
    return d.toISOString().slice(0, 16);
  }
  async load() {
    await this.api.action(async () =>
      this.schedules.set(await this.api.get<Schedule[]>('schedules')),
    );
  }
  async create(query: Query) {
    if(query.mode==='Sri'&&!confirm('¿Autoriza programar consultas SRI del '+query.from+' al '+query.to+', tipos '+query.types.join(', ')+', con la frecuencia seleccionada?'))return;
    if (!this.next) {
      this.api.notice.set('Seleccione la próxima fecha y hora.');
      return;
    }
    await this.api.action(
      () =>
        this.api.post('schedules', {
          query,
          frequency: this.frequency,
          intervalDays:this.intervalDays,
          next: this.next + '-05:00',
          enabled: true,
        }),
      'Programación creada.',
    );
    await this.load();
  }
  async update(s: Schedule) {
    await this.api.action(() => this.api.put('schedules/' + s.id, s), 'Programación actualizada.');
    await this.load();
  }
  async run(s: Schedule) {
    if(s.query.mode==='Sri'&&!confirm('¿Autoriza ejecutar ahora esta consulta SRI con los filtros de la programación?'))return;
    await this.api.action(
      () => this.api.post('schedules/' + s.id + '/run', {}),
      'Ejecución en cola.',
    );
  }
  async remove(s: Schedule) {
    if (!confirm('¿Eliminar esta programación?')) return;
    await this.api.action(() => this.api.delete('schedules/' + s.id), 'Programación eliminada.');
    await this.load();
  }
}
