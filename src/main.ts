import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

fetch('app.config.json', { cache: 'no-store' }).then(async response => {
  if (!response.ok) throw new Error('No se pudo cargar app.config.json');
  const config = await response.json();
  if (typeof config.apiBaseUrl !== 'string') throw new Error('apiBaseUrl no es válido');
  const url = config.apiBaseUrl.trim().replace(/\/$/, '');
  if (url && (!/^https?:\/\//i.test(url) || new URL(url).origin !== url)) throw new Error('apiBaseUrl debe ser un origen HTTP(S)');
  window.apiBaseUrl = url;
  return bootstrapApplication(App, appConfig);
}).catch(err => { console.error(err); document.body.textContent = 'No se pudo iniciar la aplicación. Revise app.config.json.'; });
declare global { interface Window { apiBaseUrl: string; } }
