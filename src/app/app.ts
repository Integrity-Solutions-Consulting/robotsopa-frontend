import { Component, signal, inject,DestroyRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Api } from './core/api';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule],
  selector: 'app-root',
  styleUrl: './app.scss',
  template: `@if (!api.authenticated()) {
      <main class="login">
        <section class="card">
          <div class="brand">SRI<span>Automation</span></div>
          <p>Administración local de comprobantes electrónicos</p>
          <form (submit)="$event.preventDefault(); login()">
            <label
              >Contraseña del panel<input
                type="password"
                autocomplete="current-password"
                [formControl]="password" /></label
            ><button [disabled]="api.busy() || !password.value">Entrar al panel</button>
          </form>
        </section>
      </main>
    } @else {
      <div class="shell" [class.collapsed]="collapsed()">
        <aside>
          <div class="brand">SRI<span>Automation</span></div>
          <small>ESPACIO DE TRABAJO LOCAL</small>
          <nav>
            @for (link of links; track link[0]) {
              <a [routerLink]="link[0]" routerLinkActive="active">{{ link[1] }}</a>
            }
          </nav>
          <p class="sidebar-foot">Documentos bajo tu control<br />America/Guayaquil</p>
        </aside>
        <div class="workspace">
          <header>
            <button
              class="secondary"
              (click)="collapsed.set(!collapsed())"
              aria-label="Alternar navegación"
            >
              ☰</button
            ><span>Panel de operaciones</span>
            <div class="spacer"></div>
            <span>{{ api.user() }}</span>
          </header>
          @if (api.busy()) {
            <div class="loading" role="progressbar" aria-label="Cargando"></div>
          }
          <main><router-outlet /></main>
        </div>
      </div>
    }
    @if (api.notice()) {
      <div class="toast" [attr.role]="api.noticeKind()==='error'?'alert':'status'" [attr.data-kind]="api.noticeKind()">
        @if(api.noticeKind()==='loading'){<span class="spinner" aria-hidden="true"></span>}
        {{ api.notice() }}<button (click)="api.notice.set('')" aria-label="Cerrar aviso">×</button>
      </div>
    }`,
})
export class App {
  api = inject(Api);
  collapsed = signal(false);
  password = new FormControl('', { nonNullable: true });
  links = [
    ['/inicio', 'Inicio'],
    ['/comprobantes', 'Comprobantes'],
    ['/historial', 'Historial'],
    ['/configuracion', 'Configuración'],
  ];
  constructor() {
    void this.api.session();
    this.api.applyTheme();
    const media=matchMedia('(prefers-color-scheme: dark)');const follow=()=>this.api.applyTheme();media.addEventListener('change',follow);inject(DestroyRef).onDestroy(()=>media.removeEventListener('change',follow));
  }
  async login() {
    await this.api.login(this.password.value);
    this.password.reset();
  }
  theme() {
    const theme = document.documentElement.dataset['theme'] === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('sri-theme', theme);
  }
}
