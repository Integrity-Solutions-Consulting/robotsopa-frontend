import { Component, input } from '@angular/core';

@Component({
  selector: 'app-data-table',
  template: ` <div class="table-wrap">
    <table>
      <thead>
        <tr>
          @for (h of headers(); track h) {
            <th>{{ h }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index) {
          <tr>
            @for (cell of row; track $index) {
              <td>{{ cell ?? '—' }}</td>
            }
          </tr>
        } @empty {
          <tr>
            <td [attr.colspan]="headers().length" class="empty">No hay registros para mostrar.</td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
})
export class DataTable {
  headers = input<string[]>([]);
  rows = input<(string | number | null | undefined)[][]>([]);
}
