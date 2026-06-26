import { LitElement, html, css, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type ParsedTrace } from '../utils/traceParser.ts';
import { icons } from '../utils/icons.ts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AISession {
  prompt: (text: string) => Promise<string>;
  promptStreaming: (text: string) => AsyncIterable<string>;
  destroy: () => Promise<void>;
}

interface AICreateMonitor {
  addEventListener: (
    type: 'downloadprogress',
    listener: (e: ProgressEvent) => void
  ) => void;
}

@customElement('chat-assistant')
export class ChatAssistant extends LitElement {
  @property({ type: Object }) parsedTrace: ParsedTrace | null = null;

  @state() private aiSupported: boolean | null = null;
  @state() private errorMsg: string | null = null;
  @state() private messages: ChatMessage[] = [];
  @state() private inputValue = '';
  @state() private generating = false;
  @state() private diagnostics: Record<string, string> = {};
  @state() private downloadProgress: number | null = null;
  @state() private statusMsg: string | null = null;

  private session: AISession | null = null;

  static override styles = css`
    :host {
      display: block;
      height: calc(100vh - 4.5rem);
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      box-sizing: border-box;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
      flex-shrink: 0;
    }

    .chat-header h2 {
      font-size: 1.5rem;
      margin: 0;
      font-weight: 400;
      color: var(--md-sys-color-on-surface);
    }

    .chat-header p {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
    }

    /* M3 Badge Style */
    .ai-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      padding: 0.35rem 0.75rem;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* M3 Outlined Card Error */
    .error-card {
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-error);
      border-radius: var(--md-sys-shape-corner-medium);
      color: var(--md-sys-color-on-surface);
      padding: 2rem;
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      text-align: center;
      align-items: center;
      box-shadow: var(--md-sys-elevation-1);
    }

    .error-card svg {
      width: 44px;
      height: 44px;
      color: var(--md-sys-color-error);
    }

    .error-card h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }

    .error-card p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.5;
    }

    /* Chat Messages Layout */
    .message-area {
      flex: 1;
      overflow-y: auto;
      padding-right: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }

    /* M3 spec style bubbles */
    .message-bubble {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      max-width: 80%;
      padding: 1rem 1.25rem;
      border-radius: var(--md-sys-shape-corner-large);
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .message-bubble.user {
      align-self: flex-end;
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      border-bottom-right-radius: var(--md-sys-shape-corner-extra-small);
      box-shadow: var(--md-sys-elevation-1);
    }

    .message-bubble.assistant {
      align-self: flex-start;
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
      color: var(--md-sys-color-on-surface);
      border-bottom-left-radius: var(--md-sys-shape-corner-extra-small);
      box-shadow: var(--md-sys-elevation-1);
    }

    .message-sender {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--md-sys-color-on-surface-variant);
    }

    .message-bubble.user .message-sender {
      color: rgba(255, 255, 255, 0.7);
    }

    /* M3 Outlined Text Field / Search layout container */
    .input-form {
      display: flex;
      gap: 0.75rem;
      background: var(--md-sys-color-surface-container-high);
      border: 1px solid var(--md-sys-color-outline);
      border-radius: var(--md-sys-shape-corner-extra-large);
      padding: 0.35rem 0.5rem 0.35rem 1.25rem;
      align-items: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
      box-sizing: border-box;
      height: 56px;
    }

    .input-form:focus-within {
      border-color: var(--md-sys-color-primary);
      border-width: 2px;
      padding-left: calc(1.25rem - 1px);
      background: var(--md-sys-color-surface-container-highest);
    }

    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--md-sys-color-on-surface);
      font-size: 0.875rem;
      outline: none;
      height: 100%;
    }

    .chat-input::placeholder {
      color: var(--md-sys-color-on-surface-variant);
    }

    /* M3 Filled Icon Button */
    .btn-send {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .btn-send::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--md-sys-color-on-primary);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .btn-send:hover::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .btn-send:disabled {
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface-variant);
      cursor: not-allowed;
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .btn-send:disabled::before {
      display: none;
    }

    .btn-send svg {
      width: 18px;
      height: 18px;
      z-index: 1;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
      text-align: center;
      gap: 1rem;
      padding: 2rem;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      color: var(--md-sys-color-outline);
      margin-bottom: 0.5rem;
    }

    /* M3 Suggestion Chips (By the book M3 layout) */
    .suggestion-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1.5rem;
      max-width: 600px;
    }

    .suggestion-chip {
      background: transparent;
      border: 1px solid var(--md-sys-color-outline);
      padding: 0.5rem 1rem;
      border-radius: var(--md-sys-shape-corner-small);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      color: var(--md-sys-color-on-surface);
      transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      height: 32px;
      box-sizing: border-box;
    }

    .suggestion-chip::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--md-sys-color-on-surface);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .suggestion-chip:hover::before {
      opacity: var(--md-sys-state-hover-state-layer-opacity);
    }

    .suggestion-chip:hover {
      border-color: var(--md-sys-color-primary);
      background: rgba(208, 188, 255, 0.05);
    }

    /* Message typing/generating dots */
    .generating-dots {
      display: flex;
      gap: 6px;
      align-items: center;
      height: 20px;
    }

    .dot {
      width: 6px;
      height: 6px;
      background: var(--md-sys-color-primary);
      border-radius: 50%;
      animation: bounce 0.6s infinite alternate;
    }

    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0% { transform: translateY(0); }
      100% { transform: translateY(-6px); }
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.initModel();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.session) {
      void this.session.destroy().catch((err: unknown) => {
        console.error('Failed to destroy AI session:', err);
      });
      this.session = null;
    }
  }

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('parsedTrace')) {
      this.messages = [];
      if (this.parsedTrace && this.aiSupported) {
        void this.createSession(this.parsedTrace);
      } else {
        if (this.session) {
          void this.session.destroy().catch((err: unknown) => {
            console.error('Failed to destroy AI session on trace clear:', err);
          });
          this.session = null;
        }
      }
    }
  }

  private async initModel(): Promise<void> {
    const diag: Record<string, string> = {
      'Secure Context (isSecureContext)': String(window.isSecureContext),
      'User Agent': navigator.userAgent,
    };
    try {
      /* ------------------------------------------------------------------ *
       *  Type surface covering every known iteration of Chrome's Prompt API *
       * ------------------------------------------------------------------ */
      interface AINamespace {
        capabilities?: () => Promise<{ available: string }>;
        availability?: () => Promise<string>;
        create?: (options: Record<string, unknown>) => Promise<unknown>;
      }

      const win = window as unknown as {
        LanguageModel?: AINamespace;          // global constructor (current Chrome)
        languageModel?: AINamespace;          // lowercase variant
        ai?: {
          languageModel?: AINamespace;        // window.ai.languageModel
          assistant?: AINamespace;            // window.ai.assistant (Chrome 128-129)
          createTextSession?: (options: Record<string, unknown>) => Promise<unknown>;
          canCreateTextSession?: () => Promise<string>;
        };
      };

      diag['window.ai object'] = win.ai ? 'Present' : 'Missing';
      diag['window.languageModel object'] = win.languageModel ? 'Present' : 'Missing';
      diag['window.LanguageModel class'] = win.LanguageModel ? 'Present' : 'Missing';

      /* Helper: probe a single namespace for availability */
      const probeNamespace = async (
        label: string,
        ns: AINamespace
      ): Promise<void> => {
        // Try availability() first (current spec)
        if (typeof ns.availability === 'function') {
          diag[`${label}.availability`] = 'Present';
          try {
            const status = await ns.availability();
            diag[`${label} availability`] = status;
            if (status !== 'no') {
              this.aiSupported = true;
            }
          } catch (err) {
            diag[`${label}.availability() error`] = (err as Error).message;
          }
        }
        // Fall back to capabilities() (older spec)
        if (typeof ns.capabilities === 'function') {
          diag[`${label}.capabilities`] = 'Present';
          try {
            const cap = await ns.capabilities();
            diag[`${label} capabilities.available`] = cap.available;
            if (cap.available !== 'no') {
              this.aiSupported = true;
            }
          } catch (err) {
            diag[`${label}.capabilities() error`] = (err as Error).message;
          }
        }
        // If namespace has create() but neither availability/capabilities, assume it works
        if (
          typeof ns.create === 'function' &&
          typeof ns.availability !== 'function' &&
          typeof ns.capabilities !== 'function'
        ) {
          diag[`${label}.create`] = 'Present (no availability check available)';
          this.aiSupported = true;
        }
      };

      // Probe window.LanguageModel (global constructor – current Chrome)
      if (win.LanguageModel) {
        await probeNamespace('LanguageModel', win.LanguageModel);
      }

      // Probe window.languageModel (lowercase variant)
      if (win.languageModel) {
        await probeNamespace('languageModel', win.languageModel);
      }

      // Probe window.ai.languageModel
      const ai = win.ai;
      if (ai) {
        if (ai.languageModel) {
          diag['ai.languageModel'] = 'Present';
          await probeNamespace('ai.languageModel', ai.languageModel);
        } else {
          diag['ai.languageModel'] = 'Missing';
        }

        if (ai.assistant) {
          diag['ai.assistant'] = 'Present';
          await probeNamespace('ai.assistant', ai.assistant);
        } else {
          diag['ai.assistant'] = 'Missing';
        }

        diag['ai.createTextSession'] = typeof ai.createTextSession === 'function' ? 'Present' : 'Missing';
        diag['ai.canCreateTextSession'] = typeof ai.canCreateTextSession === 'function' ? 'Present' : 'Missing';
        if (typeof ai.canCreateTextSession === 'function') {
          try {
            const status = await ai.canCreateTextSession();
            diag['ai.canCreateTextSession() status'] = status;
            if (status !== 'no') {
              this.aiSupported = true;
            }
          } catch (err) {
            diag['ai.canCreateTextSession() error'] = (err as Error).message;
          }
        }
      }

      this.diagnostics = diag;

      if (this.aiSupported !== true) {
        this.aiSupported = false;
        if (!win.ai && !win.languageModel && !win.LanguageModel) {
          this.errorMsg = 'Prompt API is not supported in this browser. Neither window.ai, window.languageModel, nor window.LanguageModel was found.';
        } else {
          this.errorMsg = 'Built-in AI was detected but reported as unavailable. Check chrome://flags and chrome://components. See diagnostics below.';
        }
        return;
      }

      if (this.parsedTrace) {
        await this.createSession(this.parsedTrace);
      }
    } catch (e) {
      this.aiSupported = false;
      this.diagnostics = diag;
      this.errorMsg = `Failed to initialize on-device AI: ${(e as Error).message}`;
    }
  }

  private async createSession(trace: ParsedTrace): Promise<void> {
    try {
      this.statusMsg = 'Initializing local AI session...';
      this.downloadProgress = null;

      if (this.session) {
        await this.session.destroy();
        this.session = null;
      }

      interface CreateOptions {
        systemPrompt?: string;
        initialPrompts?: Array<{ role: string; content: string }>;
        temperature?: number;
        expectedOutputLanguages?: string[];
        monitor?: (m: AICreateMonitor) => void;
      }

      interface AINamespaceCreate {
        create: (options: CreateOptions) => Promise<unknown>;
      }

      const win = window as unknown as {
        LanguageModel?: AINamespaceCreate;
        languageModel?: AINamespaceCreate;
        ai?: {
          languageModel?: AINamespaceCreate;
          assistant?: AINamespaceCreate;
          createTextSession?: (options: CreateOptions) => Promise<unknown>;
        };
      };

      const systemPrompt = this.getSystemPrompt(trace);
      
      interface NativeSession {
        prompt: (text: string) => Promise<string>;
        promptStreaming: (text: string) => AsyncIterable<string>;
        destroy?: () => Promise<void>;
      }
      let sessionInstance: NativeSession | null = null;

      const options: CreateOptions = {
        systemPrompt,
        initialPrompts: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.3,
        expectedOutputLanguages: ['en'],
        monitor: (m: AICreateMonitor) => {
          m.addEventListener('downloadprogress', (e: ProgressEvent) => {
            if (e.total > 0) {
              this.downloadProgress = Math.round((e.loaded / e.total) * 100);
              this.statusMsg = `Downloading local model: ${this.downloadProgress}%`;
            } else {
              this.statusMsg = `Downloading local model...`;
            }
          });
        }
      };

      if (win.LanguageModel && typeof win.LanguageModel.create === 'function') {
        sessionInstance = await win.LanguageModel.create(options) as unknown as NativeSession;
      } else if (win.languageModel && typeof win.languageModel.create === 'function') {
        sessionInstance = await win.languageModel.create(options) as unknown as NativeSession;
      } else if (win.ai?.languageModel && typeof win.ai.languageModel.create === 'function') {
        sessionInstance = await win.ai.languageModel.create(options) as unknown as NativeSession;
      } else if (win.ai?.assistant && typeof win.ai.assistant.create === 'function') {
        sessionInstance = await win.ai.assistant.create(options) as unknown as NativeSession;
      } else if (win.ai && typeof win.ai.createTextSession === 'function') {
        sessionInstance = await win.ai.createTextSession(options) as unknown as NativeSession;
      } else {
        throw new Error('No valid session creation method found');
      }

      if (!sessionInstance) {
        throw new Error('Session creation returned null or undefined');
      }

      const activeInstance = sessionInstance;
      this.session = {
        prompt: (text: string) => activeInstance.prompt(text),
        promptStreaming: (text: string) => activeInstance.promptStreaming(text),
        destroy: () => {
          if (activeInstance.destroy && typeof activeInstance.destroy === 'function') {
            return activeInstance.destroy();
          }
          return Promise.resolve();
        }
      };
      
      this.statusMsg = null;
      this.downloadProgress = null;

      this.messages = [
        {
          role: 'assistant',
          content: `Hi! I have analyzed the trace file: **${trace.metadata.fileName}**. The main bottlenecks appear to be related to CPU execution. How can I help you optimize it?`
        }
      ];
    } catch (e) {
      this.statusMsg = null;
      this.downloadProgress = null;
      this.aiSupported = false;
      this.errorMsg = `Failed to establish local AI session: ${(e as Error).message}`;
    }
  }

  private getSystemPrompt(trace: ParsedTrace): string {
    const meta = trace.metadata;
    const cats = trace.categories;
    const longTasks = trace.longTasks;
    const markers = trace.markers;

    return `You are TraceHelper AI, a Chrome DevTools performance trace analyst.
Here is the performance trace summary for the application currently being analyzed:

- File: ${meta.fileName}
- Total Duration: ${(meta.totalDurationMs / 1000).toFixed(2)}s (${meta.totalDurationMs.toFixed(0)} ms)
- Active CPU Time: ${(meta.cpuTimeMs / 1000).toFixed(2)}s (${meta.cpuTimeMs.toFixed(0)} ms)

CPU Category Breakdown:
- Loading: ${cats.loadingMs.toFixed(1)} ms
- Scripting: ${cats.scriptingMs.toFixed(1)} ms
- Rendering: ${cats.renderingMs.toFixed(1)} ms
- Painting: ${cats.paintingMs.toFixed(1)} ms
- Other Tasks: ${cats.otherMs.toFixed(1)} ms
- Idle (Thread Sleep): ${cats.idleMs.toFixed(1)} ms

Top Long Tasks (>50ms):
${longTasks.slice(0, 8).map((t, i) => `${i + 1}. ${t.name}: ${t.durationMs.toFixed(1)}ms (Started at ${(t.startTimeMs / 1000).toFixed(3)}s) ${t.url ? `from ${t.url}` : ''}`).join('\n')}

Key Milestones / Performance Markers:
${markers.map(m => `- ${m.name}: ${m.timeMs >= 1000 ? `${(m.timeMs / 1000).toFixed(3)}s` : `${m.timeMs.toFixed(1)}ms`}`).join('\n')}

Analyze these metrics, identify the primary performance bottlenecks, and answer user queries concisely and directly based ONLY on these metrics. Suggest actionable optimization strategies (e.g. splitting bundles, avoiding layout thrashing, optimizing image sizes, etc.). Keep explanations short.`;
  }

  override render(): TemplateResult {
    if (this.aiSupported === false) {
      return html`
        <div class="container">
          <div class="error-card">
            ${icons['alertTriangle']}
            <h3>Built-in AI Not Enabled</h3>
            <p>${this.errorMsg}</p>
            <p style="margin-top: 1rem; font-size: 0.8rem; text-align: left;">
              <strong>To enable it in Google Chrome:</strong><br/>
              1. Go to <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set to <strong>Enabled</strong>.<br/>
              2. Go to <code>chrome://flags/#optimization-guide-on-device-model</code> and set to <strong>Enabled BypassPerfRequirement</strong>.<br/>
              3. Relaunch Chrome. You may need to wait a couple minutes for the model to download (check <code>chrome://components</code> for "Optimization Guide On Device Model").
            </p>
            
            <div style="margin-top: 1.5rem; text-align: left; width: 100%; max-width: 500px; background: var(--md-sys-color-surface-container-high); border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 1rem; box-sizing: border-box;">
              <h4 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Browser Diagnostics:</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; font-family: monospace; line-height: 1.4;">
                ${Object.entries(this.diagnostics).map(([key, val]) => {
                  let valColor = 'var(--md-sys-color-on-surface)';
                  if (val === 'true' || val === 'readily' || val === 'Present') {
                    valColor = '#10b981'; // Green
                  } else if (val === 'false' || val === 'no' || val === 'Missing' || val === 'undefined') {
                    valColor = '#ef4444'; // Red
                  } else if (val.startsWith('after-download') || val.startsWith('Downloading') || val.startsWith('Initializing')) {
                    valColor = '#f59e0b'; // Amber
                  }
                  return html`
                    <tr style="border-bottom: 1px solid var(--md-sys-color-outline-variant);">
                      <td style="padding: 0.35rem 0; color: var(--md-sys-color-on-surface-variant); vertical-align: top; padding-right: 1rem;">${key}</td>
                      <td style="padding: 0.35rem 0; font-weight: bold; text-align: right; color: ${valColor}; word-break: break-all;">${val}</td>
                    </tr>
                  `;
                })}
              </table>
            </div>
          </div>
        </div>
      `;
    }

    if (!this.parsedTrace) {
      return html`
        <div class="container">
          <div class="empty-state">
            ${icons['chat']}
            <h3>AI Chat Assistant</h3>
            <p>Please load a performance trace in the <strong>Dashboard</strong> tab to begin conversing with the AI about it.</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="container">
        <div class="chat-header">
          <div>
            <h2>AI Assistant</h2>
            <p>Conversing about ${this.parsedTrace.metadata.fileName}</p>
          </div>
          <div class="ai-badge">
            <span style="display:inline-block; width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></span>
            Chrome AI Local Session
          </div>
        </div>

        <div class="message-area" id="messageArea">
          ${this.statusMsg ? html`
            <div class="empty-state">
              ${icons['chat']}
              <h3>Model Download & Initialization</h3>
              <p>${this.statusMsg}</p>
              ${this.downloadProgress !== null ? html`
                <div style="width: 100%; max-width: 300px; height: 4px; background: var(--md-sys-color-surface-container-highest); border-radius: 2px; overflow: hidden; margin-top: 1rem;">
                  <div style="width: ${this.downloadProgress}%; height: 100%; background: var(--md-sys-color-primary); transition: width 0.3s ease;"></div>
                </div>
              ` : ''}
            </div>
          ` : (this.messages.length === 0 ? html`
            <div class="empty-state">
              ${icons['chat']}
              <p>Ask a question about the current performance trace!</p>
              <div class="suggestion-chips">
                <button class="suggestion-chip" @click=${() => this.sendSuggestion('What is the biggest performance bottleneck in this trace?')}>What is the biggest performance bottleneck in this trace?</button>
                <button class="suggestion-chip" @click=${() => this.sendSuggestion('Are there any issues with layout or rendering?')}>Are there any issues with layout or rendering?</button>
                <button class="suggestion-chip" @click=${() => this.sendSuggestion('Explain the longest blocking task details.')}>Explain the longest blocking task details.</button>
              </div>
            </div>
          ` : html`
            ${this.messages.map(msg => html`
              <div class="message-bubble ${msg.role}">
                <span class="message-sender">${msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                <div>${msg.content}</div>
              </div>
            `)}
          `)}
          ${this.generating ? html`
            <div class="message-bubble assistant">
              <span class="message-sender">AI Assistant</span>
              <div class="generating-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          ` : ''}
        </div>

        <form class="input-form" @submit=${this.handleSend}>
          <input 
            type="text" 
            class="chat-input" 
            placeholder="Ask a question about the performance trace metrics..." 
            aria-label="Ask a question about the performance trace metrics"
            .value=${this.inputValue}
            @input=${(e: InputEvent) => this.inputValue = (e.target as HTMLInputElement).value}
            ?disabled=${this.generating || !this.session}
          />
          <button class="btn-send" type="submit" ?disabled=${this.generating || !this.inputValue.trim() || !this.session} aria-label="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    `;
  }

  private sendSuggestion(text: string): void {
    this.inputValue = text;
    this.handleSend(new Event('submit'));
  }

  private handleSend(e: Event): void {
    e.preventDefault();
    const query = this.inputValue.trim();
    if (!query || !this.session || this.generating) return;

    this.inputValue = '';
    this.messages = [...this.messages, { role: 'user', content: query }];
    this.generating = true;

    this.scrollChat();
    void this.processPrompt(query);
  }

  private async processPrompt(query: string): Promise<void> {
    if (!this.session) return;
    try {
      const stream = this.session.promptStreaming(query);
      
      this.messages = [...this.messages, { role: 'assistant', content: '' }];
      const assistantMsgIndex = this.messages.length - 1;

      for await (const chunk of stream) {
        this.messages[assistantMsgIndex] = { role: 'assistant', content: chunk };
        this.messages = [...this.messages]; 
        this.scrollChat();
      }
    } catch (err) {
      this.messages = [
        ...this.messages, 
        { 
          role: 'assistant', 
          content: `Sorry, I encountered an error prompting the model: ${(err as Error).message}` 
        }
      ];
    } finally {
      this.generating = false;
      this.scrollChat();
    }
  }

  private scrollChat(): void {
    setTimeout(() => {
      const area = this.renderRoot.querySelector('#messageArea');
      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    }, 50);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-assistant': ChatAssistant;
  }
}
