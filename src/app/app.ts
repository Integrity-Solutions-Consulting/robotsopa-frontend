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
            <label>Usuario<input autocomplete="username" [formControl]="username" /></label>
            <label
              >Contraseña del panel<input
                type="password"
                autocomplete="current-password"
                [formControl]="password" /></label
            ><button [disabled]="api.busy() || !username.value || !password.value">Entrar al panel</button>
          </form>
        </section>
      </main>
    } @else if (api.mustChange()) {
      <main class="login"><section class="card"><h1>Cambiar contraseña</h1><p>Antes de continuar, crea una contraseña personal de al menos 12 caracteres.</p>
      <form (submit)="$event.preventDefault(); changePassword()">
        <label>Contraseña actual<input type="password" autocomplete="current-password" [formControl]="currentPassword" /></label>
        <label>Nueva contraseña<input type="password" autocomplete="new-password" [formControl]="newPassword" /></label>
        <label>Confirmar contraseña<input type="password" autocomplete="new-password" [formControl]="confirmPassword" /></label>
        <button [disabled]="api.busy() || !currentPassword.value || newPassword.value.length<12 || newPassword.value!==confirmPassword.value">Cambiar contraseña</button>
        <button type="button" class="secondary" (click)="api.logout()">Cerrar sesión</button>
      </form></section></main>    } @else {
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
  username = new FormControl('', { nonNullable: true });
  password = new FormControl('', { nonNullable: true });
  currentPassword = new FormControl('', { nonNullable: true });
  newPassword = new FormControl('', { nonNullable: true });
  confirmPassword = new FormControl('', { nonNullable: true });
  async changePassword(){const result=await this.api.action(()=>this.api.post('auth/change-password',{currentPassword:this.currentPassword.value,newPassword:this.newPassword.value}),'Contraseña actualizada.');this.currentPassword.reset();this.newPassword.reset();this.confirmPassword.reset();if(result){this.api.mustChange.set(false);await this.api.loadDefault();}}
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
    await this.api.login(this.username.value, this.password.value);
    this.password.reset();
  }
  theme() {
    const theme = document.documentElement.dataset['theme'] === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('sri-theme', theme);
  }
}
