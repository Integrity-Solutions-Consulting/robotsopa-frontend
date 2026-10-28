import { Component, signal } from '@angular/core';
import { ComprobantesPage } from './page';
import { DocumentosPage } from '../documentos/page';
import { ReportesPage } from '../reportes/page';
import { ProgramacionesPage } from '../programaciones/page';
@Component({imports:[ComprobantesPage,DocumentosPage,ReportesPage,ProgramacionesPage],template:`
  <div class="page-heading"><div><p class="eyebrow">ARCHIVO Y DESCARGAS</p><h1>Comprobantes</h1><p>Consulta, archivos, Excel y programación en un solo lugar.</p></div></div>
  <div class="actions section-tools" role="group" aria-label="Herramientas de comprobantes">
    @for(t of tools;track t[0]){<button [class.secondary]="section()!==t[0]" [attr.aria-pressed]="section()===t[0]" (click)="section.set(t[0])">{{t[1]}}</button>}
  </div>
  <div class="comprobantes-tools">@switch(section()){
    @case('consulta'){<sri-consulta />}
    @case('documentos'){<sri-documentos />}
    @case('excel'){<sri-reportes />}
    @case('programacion'){<sri-programaciones />}
  }</div>`})
export class ComprobantesHub {section=signal('consulta');tools=[['consulta','Descargar comprobantes'],['documentos','Documentos descargados'],['excel','Generar / Actualizar Excel'],['programacion','Programar descarga']];}
