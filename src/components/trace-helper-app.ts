import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { type ParsedTrace } from '../utils/traceParser.ts';
import { icons } from '../utils/icons.ts';

// Import subcomponents so they are registered
import './trace-dashboard.ts';
import './trace-comparison.ts';
import './chat-assistant.ts';

type AppTab = 'dashboard' | 'compare' | 'chat';

@customElement('trace-helper-app')
export class TraceHelperApp extends LitElement {
  @state() private activeTab: AppTab = 'dashboard';
  @state() private parsedTrace: ParsedTrace | null = null;
  @state() private traceB: ParsedTrace | null = null;

  static override styles = css`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      background-color: var(--md-sys-color-background);
      color: var(--md-sys-color-on-background);
    }

    .app-layout {
      display: flex;
      height: 100%;
      width: 100%;
    }

    /* M3 Standard Navigation Drawer */
    .navigation-drawer {
      width: 320px;
      background: var(--md-sys-color-surface-container-low);
      display: flex;
      flex-direction: column;
      padding: 0 12px;
      flex-shrink: 0;
      box-sizing: border-box;
      border-right: 1px solid var(--md-sys-color-outline-variant);
    }

    .drawer-header {
      padding: 24px 16px 20px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      box-shadow: var(--md-sys-elevation-1);
    }

    .brand-title {
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: 0.15px;
      color: var(--md-sys-color-on-surface);
    }

    .drawer-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    /* M3 Drawer Item Style (By the book M3 spec) */
    .drawer-item {
      display: flex;
      align-items: center;
      height: 56px;
      border: none;
      background: transparent;
      padding: 0 16px 0 24px;
      border-radius: 28px;
      color: var(--md-sys-color-on-surface-variant);
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      position: relative;
      overflow: hidden;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    /* Hover State Layer (+8% overlay) */
    .drawer-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--md-sys-color-on-surface-variant);
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 0;
    }

    .drawer-item:hover::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .drawer-item.active::before {
      background-color: var(--md-sys-color-on-secondary-container);
    }

    .drawer-item.active:hover::before {
      opacity: calc(var(--md-sys-state-hover-state-layer-opacity) + 0.04);
    }

    .drawer-item.active {
      background-color: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
      font-weight: 600;
    }

    .drawer-item svg {
      width: 24px;
      height: 24px;
      margin-right: 12px;
      flex-shrink: 0;
      z-index: 1;
    }

    .drawer-item span {
      z-index: 1;
      font-size: 0.875rem;
      letter-spacing: 0.1px;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      background-color: var(--md-sys-color-primary);
      border-radius: 50%;
      margin-left: auto;
      z-index: 1;
    }

    /* Drawer Footer Info */
    .drawer-footer {
      margin: 16px 12px 24px 12px;
      padding: 16px;
      background: var(--md-sys-color-surface-container);
      border-radius: var(--md-sys-shape-corner-medium);
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: var(--md-sys-elevation-1);
    }

    .footer-label {
      color: var(--md-sys-color-on-surface-variant);
      text-transform: uppercase;
      font-size: 0.65rem;
      letter-spacing: 0.5px;
      font-weight: 700;
    }

    .footer-value {
      font-family: monospace;
      color: var(--md-sys-color-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.75rem;
    }

    .view-area {
      flex: 1;
      height: 100%;
      overflow-y: auto;
      background-color: var(--md-sys-color-background);
      view-transition-name: main-view;
    }

    /* View Transitions styling for M3 fade-through motion */
    ::view-transition-old(main-view) {
      animation: 90ms cubic-bezier(0.4, 0, 1, 1) both fade-out;
    }
    ::view-transition-new(main-view) {
      animation: 210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in;
    }

    @keyframes fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;

  override render(): TemplateResult {
    return html`
      <div class="app-layout">
        <!-- M3 Standard Navigation Drawer -->
        <aside class="navigation-drawer">
          <div class="drawer-header">
            <div class="brand-icon">⚡</div>
            <div class="brand-title">TraceHelper</div>
          </div>
          
          <nav class="drawer-menu">
            <button 
              class="drawer-item ${this.activeTab === 'dashboard' ? 'active' : ''}"
              @click=${() => this.switchTab('dashboard')}
            >
              ${icons['dashboard']}
              <span>Analyze Trace</span>
              ${this.parsedTrace ? html`<span class="badge-dot"></span>` : ''}
            </button>

            <button 
              class="drawer-item ${this.activeTab === 'compare' ? 'active' : ''}"
              @click=${() => this.switchTab('compare')}
            >
              ${icons['comparison']}
              <span>Compare Traces</span>
              ${this.parsedTrace && this.traceB ? html`<span class="badge-dot"></span>` : ''}
            </button>

            <button 
              class="drawer-item ${this.activeTab === 'chat' ? 'active' : ''}"
              @click=${() => this.switchTab('chat')}
            >
              ${icons['chat']}
              <span>AI Assistant</span>
              ${this.parsedTrace ? html`<span class="badge-dot"></span>` : ''}
            </button>
          </nav>

          <!-- Drawer Footer - Active Trace Info -->
          ${this.parsedTrace ? html`
            <div class="drawer-footer">
              <span class="footer-label">Active Trace</span>
              <span class="footer-value" title="${this.parsedTrace.metadata.fileName}">
                ${this.parsedTrace.metadata.fileName}
              </span>
              <span style="color: var(--md-sys-color-on-surface-variant); font-size: 0.7rem;">
                Duration: ${(this.parsedTrace.metadata.totalDurationMs / 1000).toFixed(2)}s
              </span>
            </div>
          ` : ''}
        </aside>

        <!-- Main View Area -->
        <main class="view-area">
          ${this.renderActiveView()}
        </main>
      </div>
    `;
  }

  private renderActiveView(): TemplateResult {
    switch (this.activeTab) {
      case 'dashboard':
        return html`
          <trace-dashboard 
            .parsedTrace=${this.parsedTrace}
            @trace-loaded=${this.handleTraceLoaded}
          ></trace-dashboard>
        `;
      case 'compare':
        return html`
          <trace-comparison 
            .traceA=${this.parsedTrace}
            .traceB=${this.traceB}
            @comparison-trace-loaded=${this.handleComparisonTraceLoaded}
          ></trace-comparison>
        `;
      case 'chat':
        return html`
          <chat-assistant 
            .parsedTrace=${this.parsedTrace}
          ></chat-assistant>
        `;
      default:
        return html`<div>Unknown View</div>`;
    }
  }

  private switchTab(tab: AppTab): void {
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        this.activeTab = tab;
      });
    } else {
      this.activeTab = tab;
    }
  }

  private handleTraceLoaded(e: CustomEvent<{ parsedTrace: ParsedTrace | null }>): void {
    this.parsedTrace = e.detail.parsedTrace;
  }

  private handleComparisonTraceLoaded(e: CustomEvent<{ type: 'A' | 'B'; parsedTrace: ParsedTrace | null }>): void {
    if (e.detail.type === 'A') {
      this.parsedTrace = e.detail.parsedTrace;
    } else {
      this.traceB = e.detail.parsedTrace;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-helper-app': TraceHelperApp;
  }
}
