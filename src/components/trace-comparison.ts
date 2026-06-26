import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { parseTraceAsync, type ParsedTrace } from '../utils/traceParser.ts';
import { icons } from '../utils/icons.ts';

@customElement('trace-comparison')
export class TraceComparison extends LitElement {
  @property({ type: Object }) traceA: ParsedTrace | null = null;
  @property({ type: Object }) traceB: ParsedTrace | null = null;

  @state() private draggingA = false;
  @state() private draggingB = false;
  @state() private errorA: string | null = null;
  @state() private errorB: string | null = null;
  @state() private parsingA = false;
  @state() private parsingB = false;

  static override styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      box-sizing: border-box;
    }

    .comparison-header {
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      padding-bottom: 1.25rem;
    }

    .comparison-header h2 {
      font-size: 1.75rem;
      margin: 0;
      font-weight: 400;
      color: var(--md-sys-color-on-surface);
    }

    .comparison-header p {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0.5rem 0 0 0;
      font-size: 0.875rem;
    }

    /* Side-by-side Upload Columns */
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    @media (min-width: 768px) {
      .upload-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .upload-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 220px;
      border: 2px dashed var(--md-sys-color-outline);
      border-radius: var(--md-sys-shape-corner-large);
      background: var(--md-sys-color-surface-container-low);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      padding: 1.5rem;
      text-align: center;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    }

    .upload-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--md-sys-color-primary);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .upload-box:hover::before, .upload-box.dragging::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .upload-box.active {
      border: 1px solid var(--md-sys-color-outline-variant);
      border-style: solid;
      background: var(--md-sys-color-surface-container-low);
      cursor: default;
    }

    .upload-box:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 4px;
      background: var(--md-sys-color-surface-container);
    }

    .upload-box.active::before {
      display: none;
    }

    .upload-box svg {
      width: 32px;
      height: 32px;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 1rem;
      z-index: 1;
    }

    .upload-box.active svg {
      color: var(--md-sys-color-primary);
    }

    .upload-box h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      z-index: 1;
    }

    .upload-box p {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0;
      font-size: 0.75rem;
      z-index: 1;
    }

    .btn-remove-file {
      position: absolute;
      top: 12px;
      right: 12px;
      background: transparent;
      border: none;
      color: var(--md-sys-color-on-surface-variant);
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease;
      z-index: 2;
    }

    .btn-remove-file:hover {
      color: var(--md-sys-color-on-surface);
      background: rgba(255, 255, 255, 0.08);
    }

    .btn-remove-file svg {
      width: 18px;
      height: 18px;
      margin: 0;
    }

    .error-text {
      color: var(--md-sys-color-error);
      font-size: 0.75rem;
      margin-top: 0.5rem;
      z-index: 1;
    }

    /* M3 Comparison Cards */
    .delta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .delta-card {
      background: var(--md-sys-color-surface-container-low);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-shadow: var(--md-sys-elevation-1);
    }

    .delta-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      color: var(--md-sys-color-on-surface-variant);
    }

    .delta-values {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .delta-v-a {
      font-size: 1rem;
      color: var(--md-sys-color-on-surface-variant);
      text-decoration: line-through;
    }

    .delta-v-b {
      font-size: 2rem;
      font-weight: 400;
      color: var(--md-sys-color-on-surface);
    }

    /* M3 Pill Badges for Deltas */
    .delta-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 100px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border: 1px solid transparent;
    }

    .delta-badge.better {
      background: rgba(72, 201, 176, 0.12);
      color: #48c9b0;
      border-color: rgba(72, 201, 176, 0.2);
    }

    .delta-badge.worse {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      border-color: rgba(242, 184, 181, 0.1);
    }

    .delta-badge.neutral {
      background: var(--md-sys-color-surface-container-high);
      color: var(--md-sys-color-on-surface-variant);
      border-color: var(--md-sys-color-outline-variant);
    }

    /* Outlined Card for Table */
    .table-container {
      background: var(--md-sys-color-surface);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1.5rem;
      overflow-x: auto;
    }

    .compare-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    .compare-table th {
      color: var(--md-sys-color-on-surface-variant);
      font-weight: 500;
      padding: 0.75rem;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .compare-table td {
      padding: 1rem 0.75rem;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      color: var(--md-sys-color-on-surface);
    }

    .category-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .category-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    /* Loader */
    .spinner-sm {
      width: 24px;
      height: 24px;
      border: 3px solid var(--md-sys-color-surface-container-highest);
      border-top-color: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: spin 1s infinite linear;
      z-index: 1;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  override render(): TemplateResult {
    return html`
      <div class="container">
        <div class="comparison-header">
          <h2>Compare Performance Traces</h2>
          <p>Analyze differences between two Chrome trace sessions side-by-side.</p>
        </div>

        <!-- Files Selection Grid -->
        <div class="upload-grid">
          <!-- Trace A Upload -->
          <!-- Trace A Upload -->
          <div 
            class="upload-box ${this.traceA ? 'active' : ''} ${this.draggingA ? 'dragging' : ''}"
            tabindex=${this.traceA ? '-1' : '0'}
            role="button"
            aria-label="Upload Trace A (Baseline)"
            @dragover=${(e: DragEvent) => this.handleDragOver(e, 'A')}
            @dragleave=${(e: DragEvent) => this.handleDragLeave(e, 'A')}
            @drop=${(e: DragEvent) => this.handleDrop(e, 'A')}
            @click=${() => this.triggerFileInput('A')}
            @keydown=${(e: KeyboardEvent) => this.handleKeyDown(e, 'A')}
          >
            ${this.parsingA ? html`
              <div class="spinner-sm"></div>
              <p style="margin-top: 0.5rem; z-index: 1;">Parsing Trace A...</p>
            ` : this.traceA ? html`
              ${icons['check']}
              <h4>Trace A (Baseline)</h4>
              <p class="file-name" style="font-family: monospace;">${this.traceA.metadata.fileName}</p>
              <p style="margin-top: 0.5rem;">Duration: ${(this.traceA.metadata.totalDurationMs / 1000).toFixed(2)}s</p>
              <button class="btn-remove-file" @click=${(e: Event) => this.removeTrace(e, 'A')} aria-label="Remove Trace A">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            ` : html`
              ${icons['file']}
              <h4>Load Trace A (Baseline)</h4>
              <p>Drag trace JSON file here or click to browse</p>
            `}
            <input 
              type="file" 
              id="fileInputA" 
              accept=".json,.gz" 
              style="display: none;" 
              aria-hidden="true"
              tabindex="-1"
              @change=${(e: Event) => this.handleFileSelect(e, 'A')}
            />
            ${this.errorA ? html`<div class="error-text">${this.errorA}</div>` : ''}
          </div>

          <!-- Trace B Upload -->
          <div 
            class="upload-box ${this.traceB ? 'active' : ''} ${this.draggingB ? 'dragging' : ''}"
            tabindex=${this.traceB ? '-1' : '0'}
            role="button"
            aria-label="Upload Trace B (Comparison)"
            @dragover=${(e: DragEvent) => this.handleDragOver(e, 'B')}
            @dragleave=${(e: DragEvent) => this.handleDragLeave(e, 'B')}
            @drop=${(e: DragEvent) => this.handleDrop(e, 'B')}
            @click=${() => this.triggerFileInput('B')}
            @keydown=${(e: KeyboardEvent) => this.handleKeyDown(e, 'B')}
          >
            ${this.parsingB ? html`
              <div class="spinner-sm"></div>
              <p style="margin-top: 0.5rem; z-index: 1;">Parsing Trace B...</p>
            ` : this.traceB ? html`
              ${icons['check']}
              <h4>Trace B (Comparison)</h4>
              <p class="file-name" style="font-family: monospace;">${this.traceB.metadata.fileName}</p>
              <p style="margin-top: 0.5rem;">Duration: ${(this.traceB.metadata.totalDurationMs / 1000).toFixed(2)}s</p>
              <button class="btn-remove-file" @click=${(e: Event) => this.removeTrace(e, 'B')} aria-label="Remove Trace B">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            ` : html`
              ${icons['file']}
              <h4>Load Trace B (Comparison)</h4>
              <p>Drag trace JSON file here or click to browse</p>
            `}
            <input 
              type="file" 
              id="fileInputB" 
              accept=".json,.gz" 
              style="display: none;" 
              aria-hidden="true"
              tabindex="-1"
              @change=${(e: Event) => this.handleFileSelect(e, 'B')}
            />
            ${this.errorB ? html`<div class="error-text">${this.errorB}</div>` : ''}
          </div>
        </div>

        <!-- Render Comparison Details -->
        ${this.traceA && this.traceB ? this.renderComparison(this.traceA, this.traceB) : html`
          <div style="text-align: center; color: var(--md-sys-color-on-surface-variant); margin-top: 3rem; font-size: 0.875rem;">
            Please load both performance trace files to see a delta analysis.
          </div>
        `}
      </div>
    `;
  }

  private renderComparison(a: ParsedTrace, b: ParsedTrace): TemplateResult {
    const metaA = a.metadata;
    const metaB = b.metadata;

    // Deltas (lower is better for performance metrics)
    const deltaDuration = metaB.totalDurationMs - metaA.totalDurationMs;
    const pctDuration = (deltaDuration / metaA.totalDurationMs) * 100;

    const deltaCpu = metaB.cpuTimeMs - metaA.cpuTimeMs;
    const pctCpu = (deltaCpu / (metaA.cpuTimeMs || 1)) * 100;

    const deltaLongTasks = b.longTasks.length - a.longTasks.length;

    // Helper to format deltas
    const formatDelta = (delta: number, pct: number, lowerIsBetter = true): TemplateResult => {
      if (Math.abs(delta) < 0.1) {
        return html`<span class="delta-badge neutral">0% diff</span>`;
      }
      
      const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
      const sign = delta > 0 ? '+' : '';
      const badgeClass = isImprovement ? 'delta-badge better' : 'delta-badge worse';
      
      return html`
        <span class=${badgeClass}>
          ${sign}${pct.toFixed(1)}% (${sign}${delta >= 1000 ? `${(delta / 1000).toFixed(2)}s` : `${delta.toFixed(0)}ms`})
        </span>
      `;
    };

    return html`
      <!-- Delta Summary Cards -->
      <div class="delta-grid">
        <div class="delta-card">
          <span class="delta-label">Total Duration</span>
          <div class="delta-values">
            <span class="delta-v-a">${(metaA.totalDurationMs / 1000).toFixed(2)}s</span>
            <span class="delta-v-b">${(metaB.totalDurationMs / 1000).toFixed(2)}s</span>
          </div>
          <div>
            ${formatDelta(deltaDuration, pctDuration)}
          </div>
        </div>

        <div class="delta-card">
          <span class="delta-label">CPU Active Time</span>
          <div class="delta-values">
            <span class="delta-v-a">${(metaA.cpuTimeMs / 1000).toFixed(2)}s</span>
            <span class="delta-v-b">${(metaB.cpuTimeMs / 1000).toFixed(2)}s</span>
          </div>
          <div>
            ${formatDelta(deltaCpu, pctCpu)}
          </div>
        </div>

        <div class="delta-card">
          <span class="delta-label">Long Tasks Count</span>
          <div class="delta-values">
            <span class="delta-v-a" style="text-decoration: none;">${a.longTasks.length}</span>
            <span class="delta-v-b">${b.longTasks.length}</span>
          </div>
          <div>
            ${deltaLongTasks === 0 ? html`
              <span class="delta-badge neutral">No change</span>
            ` : html`
              <span class=${deltaLongTasks < 0 ? 'delta-badge better' : 'delta-badge worse'}>
                ${deltaLongTasks > 0 ? '+' : ''}${deltaLongTasks} tasks
              </span>
            `}
          </div>
        </div>
      </div>

      <!-- Execution Breakdown Details Table -->
      <div class="table-container">
        <h3 style="margin: 0 0 1.25rem 0; font-size: 1.125rem; font-weight: 500; color: var(--md-sys-color-on-surface);">Category Comparison</h3>
        <table class="compare-table">
          <thead>
            <tr>
              <th>Task Category</th>
              <th>Trace A Time</th>
              <th>Trace B Time</th>
              <th>Change Delta</th>
            </tr>
          </thead>
          <tbody>
            ${this.renderCategoryRow('Loading', a.categories.loadingMs, b.categories.loadingMs, 'var(--color-loading)')}
            ${this.renderCategoryRow('Scripting', a.categories.scriptingMs, b.categories.scriptingMs, 'var(--color-scripting)')}
            ${this.renderCategoryRow('Rendering', a.categories.renderingMs, b.categories.renderingMs, 'var(--color-rendering)')}
            ${this.renderCategoryRow('Painting', a.categories.paintingMs, b.categories.paintingMs, 'var(--color-painting)')}
            ${this.renderCategoryRow('Other Tasks', a.categories.otherMs, b.categories.otherMs, 'var(--color-other)')}
            ${this.renderCategoryRow('Idle', a.categories.idleMs, b.categories.idleMs, 'var(--color-idle)', false)}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderCategoryRow(name: string, valA: number, valB: number, color: string, lowerIsBetter = true): TemplateResult {
    const delta = valB - valA;
    const pct = valA === 0 ? 0 : (delta / valA) * 100;

    const displayDelta = (): TemplateResult => {
      if (Math.abs(delta) < 0.1) {
        return html`<span style="color: var(--md-sys-color-on-surface-variant);">No difference</span>`;
      }
      
      const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
      const sign = delta > 0 ? '+' : '';
      const colorStyle = isImprovement ? 'color: #48c9b0;' : 'color: var(--md-sys-color-error);';
      
      return html`
        <span style="${colorStyle} font-weight: 600;">
          ${sign}${pct.toFixed(1)}% (${sign}${delta.toFixed(1)}ms)
        </span>
      `;
    };

    return html`
      <tr>
        <td>
          <div class="category-row">
            <div class="category-dot" style="background: ${color};"></div>
            <span>${name}</span>
          </div>
        </td>
        <td>${valA.toFixed(1)} ms</td>
        <td>${valB.toFixed(1)} ms</td>
        <td>${displayDelta()}</td>
      </tr>
    `;
  }

  // Upload/File Trigger helpers
  private triggerFileInput(type: 'A' | 'B'): void {
    if (type === 'A' && this.traceA) return;
    if (type === 'B' && this.traceB) return;

    const selector = type === 'A' ? '#fileInputA' : '#fileInputB';
    const input = this.renderRoot.querySelector(selector) as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  }

  private handleKeyDown(e: KeyboardEvent, type: 'A' | 'B'): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.triggerFileInput(type);
    }
  }

  private handleDragOver(e: DragEvent, type: 'A' | 'B'): void {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'A') this.draggingA = true;
    else this.draggingB = true;
  }

  private handleDragLeave(e: DragEvent, type: 'A' | 'B'): void {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'A') this.draggingA = false;
    else this.draggingB = false;
  }

  private handleDrop(e: DragEvent, type: 'A' | 'B'): void {
    e.preventDefault();
    e.stopPropagation();
    
    if (type === 'A') this.draggingA = false;
    else this.draggingB = false;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        void this.processFile(file, type);
      }
    }
  }

  private handleFileSelect(e: Event, type: 'A' | 'B'): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file) {
        void this.processFile(file, type);
      }
    }
  }

  private async processFile(file: File, type: 'A' | 'B'): Promise<void> {
    const isGzip = file.name.endsWith('.gz');
    const isJson = file.name.endsWith('.json');
    if (!isJson && !isGzip) {
      if (type === 'A') this.errorA = 'Upload trace .json or .gz';
      else this.errorB = 'Upload trace .json or .gz';
      return;
    }

    if (type === 'A') {
      this.parsingA = true;
      this.errorA = null;
    } else {
      this.parsingB = true;
      this.errorB = null;
    }

    try {
      const parsed = await parseTraceAsync(file);
      
      if (type === 'A') {
        this.traceA = parsed;
        this.dispatchEvent(new CustomEvent('comparison-trace-loaded', {
          detail: { type: 'A', parsedTrace: parsed },
          bubbles: true,
          composed: true
        }));
      } else {
        this.traceB = parsed;
        this.dispatchEvent(new CustomEvent('comparison-trace-loaded', {
          detail: { type: 'B', parsedTrace: parsed },
          bubbles: true,
          composed: true
        }));
      }
    } catch (err) {
      if (type === 'A') this.errorA = (err as Error).message;
      else this.errorB = (err as Error).message;
    } finally {
      if (type === 'A') this.parsingA = false;
      else this.parsingB = false;
    }
  }

  private removeTrace(e: Event, type: 'A' | 'B'): void {
    e.stopPropagation();
    if (type === 'A') {
      this.traceA = null;
      this.errorA = null;
      this.dispatchEvent(new CustomEvent('comparison-trace-loaded', {
        detail: { type: 'A', parsedTrace: null },
        bubbles: true,
        composed: true
      }));
    } else {
      this.traceB = null;
      this.errorB = null;
      this.dispatchEvent(new CustomEvent('comparison-trace-loaded', {
        detail: { type: 'B', parsedTrace: null },
        bubbles: true,
        composed: true
      }));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-comparison': TraceComparison;
  }
}
