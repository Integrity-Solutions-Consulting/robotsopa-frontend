import { Routes } from '@angular/router';

export const routes: Routes = [
  {path:'inicio',loadComponent:()=>import('./features/dashboard/inicio').then(m=>m.InicioPage)},
  {path:'conexion-sri',redirectTo:'configuracion'},
  {
    path: 'dashboard',
    redirectTo:'inicio',
  },
  {
    path: 'comprobantes',
    loadComponent: () => import('./features/comprobantes/hub').then((m) => m.ComprobantesHub),
  },
  {
    path: 'documentos',
    redirectTo:'comprobantes',
  },
  {
    path: 'reportes',
    redirectTo:'comprobantes',
  },
  {
    path: 'programaciones',
    redirectTo:'comprobantes',
  },
  {
    path: 'historial',
    loadComponent: () => import('./features/historial/audit').then((m) => m.AuditPage),
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./features/settings/page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'inicio' },
];
