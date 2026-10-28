import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Account {
  id: string;
  name: string;
  taxId?: string;
  isTest?: boolean;
}
export interface Query {
  account: string;
  from: string;
  to: string;
  types: string[];
  mode: string;
  pdf: boolean;
  xml: boolean;
  establishment: string;
  emissionPoint: string;
  authorizationStatus: string;
  broadRangeApproved?: boolean;
  maxDocuments?: number;
}
export interface Execution {
  reports?: {year:number;month:number;path:string}[];
  events?: {at:string;stage:string;message:string}[];
  id: string;
  query: Query;
  status: string;
  stage?: string;
  created: string;
  started?: string;
  finished?: string;
  found: number;
  processed: number;
  errors: number;
  message?: string;
  checkpoint?: string;
  downloaded?: number;
  issues?: string[];
  queries?: {
    date: string;
    type: string;
    found: number;
    downloaded: number;
    errors: number;
    status: string;
  }[];
}
export interface Voucher {
  id: string;
  account: string;
  type: string;
  number: string;
  issued: string;
  recipient: string;
  identification: string;
  subtotal: number | null;
  total: number | null;
  status: string;
  pdfPath?: string;
  xmlPath?: string;
  warning?: string;
}
export interface Schedule {
  intervalDays?:number;
  id: string;
  query: Query;
  frequency: string;
  next: string;
  enabled: boolean;
}
export interface Dashboard {
  documents: number;
  downloaded: number;
  completed: number;
  failed: number;
  workerOnline: boolean;
  last?: Execution;
  next?: string;
  recent: Execution[];
  scope?: string;
  sriDocuments?: number;
  importedDocuments?: number;
}
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  readonly authenticated = signal(false);
  readonly user = signal('');
  readonly activeAccount = signal('');
  readonly notice = signal('');
  readonly noticeKind = signal<'info'|'loading'|'success'|'error'>('info');
  notify(message:string,kind:'info'|'loading'|'success'|'error'='info'){this.noticeKind.set(kind);this.notice.set(message);}
  readonly busy = signal(false);
  get<T>(path: string) {
    return firstValueFrom(this.http.get<T>('/api/v1/' + path));
  }
  post<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.post<T>('/api/v1/' + path, body));
  }
  put<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.put<T>('/api/v1/' + path, body));
  }
  delete(path: string) {
    return firstValueFrom(this.http.delete('/api/v1/' + path));
  }
  async action<T>(fn: () => Promise<T>, message = ''): Promise<T | undefined> {
    this.busy.set(true);
    try {
      const result = await fn();
      if (message) this.notify(message);
      return result;
    } catch (error) {
      const e = error as HttpErrorResponse;
      this.noticeKind.set('error');
      if (e.status === 401) this.authenticated.set(false);
      this.notice.set(
        e.error?.detail ||
          (e.status === 401
            ? 'Sesión no válida. Inicie sesión.'
            : 'No se pudo completar la operación. Compruebe la conexión.'),
      );
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
  async login(password: string) {
    const response = await this.action(() => this.post<{user:string}>('auth/login', { password }));
    if (response) {this.authenticated.set(true);this.user.set(response.user);await this.loadDefault();}
  }
  async session() {
    try {
      const session=await this.get<{user:string}>('auth/session');this.user.set(session.user);
      this.authenticated.set(true);
      await this.loadDefault();
    } catch {
      this.authenticated.set(false);
    }
  }
  async logout() {
    await this.action(() => this.post('auth/logout', {}));
    this.authenticated.set(false);
  }
  async loadDefault() { const settings=await this.get<{defaultAccount?:string}>('settings');if(!this.activeAccount())this.activeAccount.set(settings.defaultAccount||''); }
  applyTheme(value=localStorage.getItem('sri-theme')||'auto') {
    const dark=value==='dark'||value==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset['theme']=dark?'dark':'light';
  }
  setTheme(value:string){localStorage.setItem('sri-theme',value);this.applyTheme(value);}
}
