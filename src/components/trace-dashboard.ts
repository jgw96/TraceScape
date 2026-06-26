import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { parseTraceAsync, type ParsedTrace } from '../utils/traceParser.ts';
import { icons } from '../utils/icons.ts';

@customElement('trace-dashboard')
export class TraceDashboard extends LitElement {
  @property({ type: Object }) parsedTrace: ParsedTrace | null = null;
  @state() private isDragging = false;
  @state() private errorMsg: string | null = null;
  @state() private parsing = false;

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

    /* M3 Upload Zone (Large Outlined / Filled container) */
    .upload-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 380px;
      border: 2px dashed var(--md-sys-color-primary);
      border-radius: var(--md-sys-shape-corner-extra-large);
      background: var(--md-sys-color-surface-container-low);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
      padding: 2rem;
      box-sizing: border-box;
      text-align: center;
      margin-top: 2rem;
      position: relative;
      overflow: hidden;
    }

    .upload-zone:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 4px;
      background: var(--md-sys-color-surface-container);
    }

    .upload-zone::before {
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

    .upload-zone:hover::before, .upload-zone.dragging::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .upload-zone svg {
      width: 48px;
      height: 48px;
      color: var(--md-sys-color-primary);
      margin-bottom: 1.5rem;
      transition: transform 0.2s ease;
      z-index: 1;
    }

    .upload-zone:hover svg {
      transform: translateY(-4px);
    }

    .upload-zone h3 {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0 0 0.5rem 0;
      color: var(--md-sys-color-on-surface);
      z-index: 1;
    }

    .upload-zone p {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0;
      font-size: 0.875rem;
      z-index: 1;
    }

    /* M3 Error Banner */
    .error-banner {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      box-shadow: var(--md-sys-elevation-1);
    }

    .error-banner svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* M3 Header Section */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      padding-bottom: 1.25rem;
    }

    .dashboard-header h2 {
      font-size: 1.75rem;
      margin: 0;
      font-weight: 400;
      color: var(--md-sys-color-on-surface);
    }

    .file-badge {
      font-family: monospace;
      background: var(--md-sys-color-surface-container-high);
      border: 1px solid var(--md-sys-color-outline-variant);
      padding: 0.25rem 0.75rem;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      display: inline-block;
    }

    /* M3 Outlined Button */
    .btn-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      padding: 0 24px;
      border-radius: 20px;
      border: 1px solid var(--md-sys-color-outline);
      background: transparent;
      color: var(--md-sys-color-primary);
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      letter-spacing: 0.1px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.15s ease;
    }

    .btn-clear::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--md-sys-color-primary);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .btn-clear:hover::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .btn-clear:active::before {
      opacity: var(--md-sys-state-pressed-state-layer-opacity);
    }

    /* M3 Elevated Cards Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .card {
      background: var(--md-sys-color-surface-container-low);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-shadow: var(--md-sys-elevation-1);
      transition: box-shadow 0.2s ease, background-color 0.2s ease;
    }

    .card:hover {
      box-shadow: var(--md-sys-elevation-2);
      background: var(--md-sys-color-surface-container);
    }

    .card-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      color: var(--md-sys-color-on-surface-variant);
    }

    .card-value {
      font-size: 2rem;
      font-weight: 400;
      color: var(--md-sys-color-on-surface);
    }

    .card-meta {
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
    }

    /* M3 Card-style Breakdown Section */
    .breakdown-section {
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1.5rem;
      box-shadow: var(--md-sys-elevation-1);
    }

    .breakdown-header {
      font-size: 1.125rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
      color: var(--md-sys-color-on-surface);
    }

    .timeline-bar {
      display: flex;
      height: 24px;
      border-radius: var(--md-sys-shape-corner-small);
      overflow: hidden;
      background: var(--md-sys-color-surface-container-highest);
      margin-bottom: 1.5rem;
    }

    .timeline-segment {
      height: 100%;
      transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
      cursor: pointer;
      position: relative;
    }

    .timeline-segment:hover {
      opacity: 0.85;
    }

    .legend-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: var(--md-sys-shape-corner-extra-small);
    }

    .legend-details {
      display: flex;
      flex-direction: column;
    }

    .legend-name {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.75rem;
      font-weight: 500;
    }

    .legend-value {
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
      font-size: 0.875rem;
    }

    /* M3 Detail Cards Grid */
    .detail-columns {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    @media (min-width: 900px) {
      .detail-columns {
        grid-template-columns: 3fr 2fr;
      }
    }

    /* M3 Outlined Card for Tables & Lists */
    .outlined-card {
      background: var(--md-sys-color-surface);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-medium);
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 500;
      margin: 0 0 1.25rem 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--md-sys-color-on-surface);
    }

    .section-title svg {
      width: 20px;
      height: 20px;
      color: var(--md-sys-color-primary);
    }

    .table-responsive {
      overflow-x: auto;
      width: 100%;
    }

    .tasks-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    .tasks-table th {
      color: var(--md-sys-color-on-surface-variant);
      font-weight: 500;
      padding: 0.75rem;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tasks-table td {
      padding: 1rem 0.75rem;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      max-width: 250px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--md-sys-color-on-surface);
    }

    .tasks-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge-task {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      padding: 0.25rem 0.5rem;
      border-radius: var(--md-sys-shape-corner-extra-small);
      font-weight: 500;
      font-size: 0.75rem;
      display: inline-block;
    }

    .tasks-table td.duration {
      font-weight: 600;
      color: var(--md-sys-color-error);
    }

    .task-url {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--md-sys-color-outline);
    }

    /* M3 List Items for Performance Markers */
    .markers-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .marker-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--md-sys-color-surface-container-low);
      border-radius: var(--md-sys-shape-corner-small);
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background-color 0.15s ease;
    }

    .marker-item:hover {
      background: var(--md-sys-color-surface-container);
    }

    .marker-item.fcp {
      border-left: 4px solid var(--color-loading);
    }

    .marker-item.lcp {
      border-left: 4px solid var(--color-scripting);
    }

    .marker-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
    }

    .marker-value {
      font-family: monospace;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--md-sys-color-primary);
    }

    /* Loader Overlay */
    .parsing-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      height: 380px;
      color: var(--md-sys-color-on-surface-variant);
    }

    /* M3 Circular Progress indicator fallback */
    .circular-progress {
      width: 48px;
      height: 48px;
      border: 4px solid var(--md-sys-color-surface-container-highest);
      border-top-color: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: spin 1s infinite linear;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  override render(): TemplateResult {
    if (this.parsing) {
      return html`
        <div class="parsing-overlay">
          <div class="circular-progress"></div>
          <p class="m3-body-medium">Analyzing performance trace events off-thread...</p>
        </div>
      `;
    }

    if (!this.parsedTrace) {
      return html`
        <div class="container">
          ${this.errorMsg ? html`
            <div class="error-banner">
              ${icons['alertTriangle']}
              <span>${this.errorMsg}</span>
            </div>
          ` : ''}
          
          <div 
            class="upload-zone ${this.isDragging ? 'dragging' : ''}"
            tabindex="0"
            role="button"
            aria-label="Upload Chrome Performance Trace"
            @dragover=${this.handleDragOver}
            @dragleave=${this.handleDragLeave}
            @drop=${this.handleDrop}
            @click=${this.triggerFileInput}
            @keydown=${this.handleKeyDown}
          >
            ${icons['upload']}
            <h3>Upload Chrome Performance Trace</h3>
            <p>Drag and drop your exported trace JSON file here, or click to browse</p>
            <p style="margin-top: 1.5rem; font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant);">
              File remains local. Compatible with .json and .gz formats.
            </p>
            <input 
              type="file" 
              id="fileInput" 
              accept=".json,.gz" 
              style="display: none;" 
              aria-hidden="true"
              tabindex="-1"
              @change=${this.handleFileSelect}
            />
          </div>
        </div>
      `;
    }

    const meta = this.parsedTrace.metadata;
    const cats = this.parsedTrace.categories;
    const totalMs = meta.totalDurationMs || 1;

    const pctLoading = ((cats.loadingMs / totalMs) * 100).toFixed(1);
    const pctScripting = ((cats.scriptingMs / totalMs) * 100).toFixed(1);
    const pctRendering = ((cats.renderingMs / totalMs) * 100).toFixed(1);
    const pctPainting = ((cats.paintingMs / totalMs) * 100).toFixed(1);
    const pctOther = ((cats.otherMs / totalMs) * 100).toFixed(1);
    const pctIdle = ((cats.idleMs / totalMs) * 100).toFixed(1);

    return html`
      <div class="container">
        <div class="dashboard-header">
          <div>
            <h2>Trace Performance Summary</h2>
            <div class="file-badge" style="margin-top: 0.5rem;">
              ${meta.fileName} (${(meta.fileSize / 1024 / 1024).toFixed(2)} MB)
            </div>
          </div>
          <button class="btn-clear" @click=${this.clearTrace}>Clear Trace</button>
        </div>

        <!-- M3 Elevated KPI Cards -->
        <div class="metrics-grid">
          <div class="card">
            <span class="card-label">Total Duration</span>
            <span class="card-value">${(meta.totalDurationMs / 1000).toFixed(2)}s</span>
            <span class="card-meta">${meta.totalDurationMs.toFixed(0)} ms total time</span>
          </div>
          <div class="card">
            <span class="card-label">Active CPU Time</span>
            <span class="card-value">${(meta.cpuTimeMs / 1000).toFixed(2)}s</span>
            <span class="card-meta">
              ${((meta.cpuTimeMs / totalMs) * 100).toFixed(0)}% CPU utilization
            </span>
          </div>
          <div class="card">
            <span class="card-label">Long Tasks</span>
            <span class="card-value" style="color: ${this.parsedTrace.longTasks.length > 0 ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface)'}">
              ${this.parsedTrace.longTasks.length}
            </span>
            <span class="card-meta">Tasks exceeding 50ms</span>
          </div>
          <div class="card">
            <span class="card-label">Avg Task Time</span>
            <span class="card-value">
              ${this.parsedTrace.longTasks.length > 0 
                ? (this.parsedTrace.longTasks.reduce((acc, t) => acc + t.durationMs, 0) / this.parsedTrace.longTasks.length).toFixed(1)
                : '0'}ms
            </span>
            <span class="card-meta">Average of long tasks</span>
          </div>
        </div>

        <!-- CPU Breakdown Card -->
        <div class="breakdown-section">
          <div class="breakdown-header">CPU Main-Thread Execution Breakdown</div>
          <div class="timeline-bar">
            <div class="timeline-segment" style="width: ${pctLoading}%; background: var(--color-loading);" title="Loading: ${cats.loadingMs.toFixed(1)}ms (${pctLoading}%)"></div>
            <div class="timeline-segment" style="width: ${pctScripting}%; background: var(--color-scripting);" title="Scripting: ${cats.scriptingMs.toFixed(1)}ms (${pctScripting}%)"></div>
            <div class="timeline-segment" style="width: ${pctRendering}%; background: var(--color-rendering);" title="Rendering: ${cats.renderingMs.toFixed(1)}ms (${pctRendering}%)"></div>
            <div class="timeline-segment" style="width: ${pctPainting}%; background: var(--color-painting);" title="Painting: ${cats.paintingMs.toFixed(1)}ms (${pctPainting}%)"></div>
            <div class="timeline-segment" style="width: ${pctOther}%; background: var(--color-other);" title="Other: ${cats.otherMs.toFixed(1)}ms (${pctOther}%)"></div>
            <div class="timeline-segment" style="width: ${pctIdle}%; background: var(--color-idle);" title="Idle: ${cats.idleMs.toFixed(1)}ms (${pctIdle}%)"></div>
          </div>

          <div class="legend-grid">
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-loading);"></div>
              <div class="legend-details">
                <span class="legend-name">Loading</span>
                <span class="legend-value">${cats.loadingMs.toFixed(1)}ms (${pctLoading}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-scripting);"></div>
              <div class="legend-details">
                <span class="legend-name">Scripting</span>
                <span class="legend-value">${cats.scriptingMs.toFixed(1)}ms (${pctScripting}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-rendering);"></div>
              <div class="legend-details">
                <span class="legend-name">Rendering</span>
                <span class="legend-value">${cats.renderingMs.toFixed(1)}ms (${pctRendering}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-painting);"></div>
              <div class="legend-details">
                <span class="legend-name">Painting</span>
                <span class="legend-value">${cats.paintingMs.toFixed(1)}ms (${pctPainting}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-other);"></div>
              <div class="legend-details">
                <span class="legend-name">Other Tasks</span>
                <span class="legend-value">${cats.otherMs.toFixed(1)}ms (${pctOther}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: var(--color-idle);"></div>
              <div class="legend-details">
                <span class="legend-name">Idle</span>
                <span class="legend-value">${cats.idleMs.toFixed(1)}ms (${pctIdle}%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- M3 Detail Layout -->
        <div class="detail-columns">
          <!-- M3 Outlined Card for Long Tasks -->
          <div class="outlined-card">
            <h3 class="section-title">
              ${icons['alertTriangle']}
              Long Thread Blocking Tasks (${this.parsedTrace.longTasks.length})
            </h3>
            ${this.parsedTrace.longTasks.length === 0 ? html`
              <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">No main thread blocking tasks detected.</p>
            ` : html`
              <div class="table-responsive">
                <table class="tasks-table">
                  <thead>
                    <tr>
                      <th>Task Event</th>
                      <th>Start Time</th>
                      <th>Duration</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.parsedTrace.longTasks.map(task => html`
                      <tr>
                        <td><span class="badge-task">${task.name}</span></td>
                        <td>${(task.startTimeMs / 1000).toFixed(3)}s</td>
                        <td class="duration">${task.durationMs.toFixed(1)} ms</td>
                        <td>
                          <div class="task-url" title="${task.url ?? ''}">${task.url ? task.url.split('/').pop() || task.url : 'System / Internal'}</div>
                          <div style="font-size: 0.7rem; color: var(--md-sys-color-on-surface-variant);">${task.details}</div>
                        </td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- M3 Outlined Card for Performance Markers -->
          <div class="outlined-card">
            <h3 class="section-title">
              ${icons['clock']}
              Performance Milestones
            </h3>
            ${this.parsedTrace.markers.length === 0 ? html`
              <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">No performance markers found.</p>
            ` : html`
              <div class="markers-list">
                ${this.parsedTrace.markers.map(m => {
                  const lowerName = m.name.toLowerCase();
                  const isFcp = lowerName.includes('fcp') || lowerName.includes('firstcontentfulpaint');
                  const isLcp = lowerName.includes('lcp') || lowerName.includes('largestcontentfulpaint');
                  const itemClass = isFcp ? 'marker-item fcp' : (isLcp ? 'marker-item lcp' : 'marker-item');
                  
                  return html`
                    <div class=${itemClass}>
                      <span class="marker-name">${m.name}</span>
                      <span class="marker-value">${m.timeMs >= 1000 ? `${(m.timeMs / 1000).toFixed(3)}s` : `${m.timeMs.toFixed(1)}ms`}</span>
                    </div>
                  `;
                })}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // File triggers
  private triggerFileInput(): void {
    const input = this.renderRoot.querySelector('#fileInput') as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.triggerFileInput();
    }
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
  }

  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        void this.processFile(file);
      }
    }
  }

  private handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file) {
        void this.processFile(file);
      }
    }
  }

  private async processFile(file: File): Promise<void> {
    const isGzip = file.name.endsWith('.gz');
    const isJson = file.name.endsWith('.json');
    if (!isJson && !isGzip) {
      this.errorMsg = 'Unsupported file format. Please upload a Chrome performance trace .json or .json.gz file.';
      return;
    }

    this.parsing = true;
    this.errorMsg = null;

    try {
      const parsed = await parseTraceAsync(file);
      this.parsedTrace = parsed;
      
      // Dispatch event to app container
      this.dispatchEvent(new CustomEvent('trace-loaded', {
        detail: { parsedTrace: parsed },
        bubbles: true,
        composed: true
      }));
    } catch (err) {
      this.errorMsg = (err as Error).message;
      this.parsedTrace = null;
    } finally {
      this.parsing = false;
    }
  }

  private clearTrace(): void {
    this.parsedTrace = null;
    this.errorMsg = null;
    this.dispatchEvent(new CustomEvent('trace-loaded', {
      detail: { parsedTrace: null },
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-dashboard': TraceDashboard;
  }
}
