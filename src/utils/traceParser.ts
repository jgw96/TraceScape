export interface TraceEvent {
  pid: number;
  tid: number;
  ts: number;
  ph: string;
  cat?: string;
  name: string;
  args?: {
    data?: {
      url?: string;
      fileName?: string;
      lineNumber?: number;
      columnNumber?: number;
      navigationId?: string;
      compositeFailed?: number;
      isMainFrame?: boolean;
    };
    name?: string;
    frame?: string;
    url?: string;
    readyState?: number;
    labels?: string[];
  };
  dur?: number;
  tdur?: number;
  tts?: number;
  id?: string;
}

export interface TraceMetadata {
  fileName: string;
  fileSize: number;
  totalDurationMs: number;
  cpuTimeMs: number;
  mainPid: number;
  mainTid: number;
}

export interface CategoryBreakdown {
  loadingMs: number;
  scriptingMs: number;
  renderingMs: number;
  paintingMs: number;
  otherMs: number;
  idleMs: number;
}

export interface LongTask {
  name: string;
  durationMs: number;
  startTimeMs: number;
  url?: string;
  details?: string;
}

export interface PerfMarker {
  name: string;
  timeMs: number;
}

export interface ParsedTrace {
  metadata: TraceMetadata;
  categories: CategoryBreakdown;
  longTasks: LongTask[];
  markers: PerfMarker[];
}

/**
 * Parses Chrome Performance Trace JSON file contents.
 */
export function parseTrace(fileName: string, fileSize: number, rawData: string): ParsedTrace {
  let events: TraceEvent[] = [];
  try {
    const parsed = JSON.parse(rawData) as unknown;
    if (Array.isArray(parsed)) {
      events = parsed as TraceEvent[];
    } else if (parsed && typeof parsed === 'object' && 'traceEvents' in parsed) {
      events = (parsed as { traceEvents: TraceEvent[] }).traceEvents;
    } else {
      throw new Error('Invalid trace format. Expected JSON array or object with traceEvents.');
    }
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${(e as Error).message}`);
  }

  if (events.length === 0) {
    throw new Error('Trace file contains no events.');
  }

  // 1. Identify Main Thread (Heuristic: thread with highest count of layout/scripting events)
  const threadEventCounts = new Map<string, { count: number; pid: number; tid: number }>();
  let mainPid = 0;
  let mainTid = 0;
  let maxCount = -1;

  // Let's also look for thread name metadata events
  const threadNames = new Map<string, string>();

  for (const ev of events) {
    if (!ev) continue;
    
    // Track thread names
    if (ev.name === 'thread_name' && ev.args?.name) {
      const key = `${ev.pid}-${ev.tid}`;
      threadNames.set(key, String(ev.args.name));
      if (String(ev.args.name) === 'CrRendererMain') {
        mainPid = ev.pid;
        mainTid = ev.tid;
        maxCount = Infinity; // Guaranteed main thread
      }
    }

    if (maxCount !== Infinity) {
      const isCpuIntensive = 
        ev.name === 'Layout' || 
        ev.name === 'EvaluateScript' || 
        ev.name === 'UpdateLayoutTree' || 
        ev.name === 'FunctionCall';

      if (isCpuIntensive) {
        const key = `${ev.pid}-${ev.tid}`;
        const current = threadEventCounts.get(key) ?? { count: 0, pid: ev.pid, tid: ev.tid };
        current.count++;
        threadEventCounts.set(key, current);
        if (current.count > maxCount) {
          maxCount = current.count;
          mainPid = ev.pid;
          mainTid = ev.tid;
        }
      }
    }
  }

  // If no main thread was identified via heuristics, fallback to the thread with the most events
  if (mainPid === 0 && mainTid === 0) {
    const threadCounts = new Map<string, { count: number; pid: number; tid: number }>();
    for (const ev of events) {
      if (!ev) continue;
      const key = `${ev.pid}-${ev.tid}`;
      const current = threadCounts.get(key) ?? { count: 0, pid: ev.pid, tid: ev.tid };
      current.count++;
      threadCounts.set(key, current);
    }
    let maxTotal = -1;
    for (const val of threadCounts.values()) {
      if (val.count > maxTotal) {
        maxTotal = val.count;
        mainPid = val.pid;
        mainTid = val.tid;
      }
    }
  }

  // 2. Compute Start and End Timestamps of the Main Thread events
  let minTs = Infinity;
  let maxTs = -Infinity;
  const mainThreadEvents: TraceEvent[] = [];

  for (const ev of events) {
    if (!ev) continue;
    if (ev.pid === mainPid && ev.tid === mainTid) {
      mainThreadEvents.push(ev);
      if (ev.ts < minTs) minTs = ev.ts;
      
      const endTs = ev.ts + (ev.dur ?? 0);
      if (endTs > maxTs) maxTs = endTs;
    }
  }

  // Fallback to overall events if main thread had none
  if (mainThreadEvents.length === 0) {
    for (const ev of events) {
      if (!ev) continue;
      if (ev.ts < minTs) minTs = ev.ts;
      const endTs = ev.ts + (ev.dur ?? 0);
      if (endTs > maxTs) maxTs = endTs;
    }
  }

  const totalDurationMs = minTs === Infinity ? 0 : (maxTs - minTs) / 1000;

  // 3. Category Breakdown and Long Tasks
  let loadingMs = 0;
  let scriptingMs = 0;
  let renderingMs = 0;
  let paintingMs = 0;
  let otherMs = 0;
  
  const longTasks: LongTask[] = [];
  const markers: PerfMarker[] = [];
  let navStartTs: number | null = null;

  // Categories helper
  const getCategory = (name: string): 'Loading' | 'Scripting' | 'Rendering' | 'Painting' | 'Other' => {
    switch (name) {
      case 'EvaluateScript':
      case 'FunctionCall':
      case 'TimerFire':
      case 'FireAnimationFrame':
      case 'RunMicrotasks':
      case 'v8.compile':
      case 'v8.parseLazy':
      case 'MajorGC':
      case 'MinorGC':
      case 'GC':
      case 'RunTask':
        return 'Scripting';
      case 'Layout':
      case 'UpdateLayoutTree':
      case 'RecalculateStyles':
      case 'HitTest':
      case 'InvalidateLayout':
        return 'Rendering';
      case 'Paint':
      case 'PaintImage':
      case 'DecodeImage':
      case 'Decode Image':
      case 'ResizeImage':
      case 'Resize Image':
      case 'CompositeLayers':
      case 'RasterTask':
      case 'UpdateLayerTree':
        return 'Painting';
      case 'ParseHTML':
      case 'ParseAuthorStyleSheet':
      case 'ResourceSendRequest':
      case 'ResourceReceiveResponse':
      case 'ResourceFinish':
        return 'Loading';
      default:
        return 'Other';
    }
  };

  // Process main thread events for categories and tasks
  for (const ev of mainThreadEvents) {
    // Collect markers
    if (ev.name === 'navigationStart') {
      navStartTs = ev.ts;
      markers.push({ name: 'Navigation Start', timeMs: 0 });
    } else if (ev.name === 'firstContentfulPaint' || ev.name === 'FirstContentfulPaint') {
      const fcpTime = navStartTs !== null ? (ev.ts - navStartTs) / 1000 : (ev.ts - minTs) / 1000;
      markers.push({ name: 'FCP', timeMs: Math.max(0, fcpTime) });
    } else if (ev.name === 'largestContentfulPaint::Candidate' || ev.name === 'LCP') {
      const lcpTime = navStartTs !== null ? (ev.ts - navStartTs) / 1000 : (ev.ts - minTs) / 1000;
      markers.push({ name: 'LCP', timeMs: Math.max(0, lcpTime) });
    } else if (ev.name === 'domContentLoadedEventEnd' || ev.name === 'DOMContentLoadedEventEnd') {
      const dclTime = navStartTs !== null ? (ev.ts - navStartTs) / 1000 : (ev.ts - minTs) / 1000;
      markers.push({ name: 'DOMContentLoaded', timeMs: Math.max(0, dclTime) });
    } else if (ev.name === 'loadEventEnd' || ev.name === 'LoadEventEnd') {
      const loadTime = navStartTs !== null ? (ev.ts - navStartTs) / 1000 : (ev.ts - minTs) / 1000;
      markers.push({ name: 'Load', timeMs: Math.max(0, loadTime) });
    }

    // Process duration-based events (Phase 'X' or Phase 'B'/'E' paired - we look at 'X' / 'dur' for simplicity)
    if (ev.dur !== undefined && ev.ph === 'X') {
      const durationMs = ev.dur / 1000;
      const cat = getCategory(ev.name);
      
      switch (cat) {
        case 'Loading':
          loadingMs += durationMs;
          break;
        case 'Scripting':
          scriptingMs += durationMs;
          break;
        case 'Rendering':
          renderingMs += durationMs;
          break;
        case 'Painting':
          paintingMs += durationMs;
          break;
        default:
          if (ev.name !== 'RunTask') {
            // Exclude RunTask container itself to avoid double counting, but count other subtasks
            otherMs += durationMs;
          }
          break;
      }

      // Detect Long Tasks (> 50ms)
      // Usually, top-level tasks on the main thread are named "RunTask" or "EvaluateScript"
      if (ev.dur >= 50000 && (ev.name === 'RunTask' || ev.name === 'EvaluateScript' || ev.name === 'Layout')) {
        let taskUrl: string | undefined;
        let details = ev.name;

        if (ev.args?.data?.url) {
          taskUrl = ev.args.data.url;
        } else if (ev.args?.url) {
          taskUrl = ev.args.url;
        }

        if (ev.args?.data?.lineNumber !== undefined) {
          details += ` (${ev.args.data.fileName ?? ''}:${ev.args.data.lineNumber})`;
        }

        const task: LongTask = {
          name: ev.name === 'RunTask' ? 'Long Task' : ev.name,
          durationMs,
          startTimeMs: (ev.ts - minTs) / 1000,
          details,
        };
        if (taskUrl !== undefined) {
          task.url = taskUrl;
        }
        longTasks.push(task);
      }
    }
  }

  // Sort long tasks descending by duration
  longTasks.sort((a, b) => b.durationMs - a.durationMs);

  const cpuTimeMs = loadingMs + scriptingMs + renderingMs + paintingMs + otherMs;
  const idleMs = Math.max(0, totalDurationMs - cpuTimeMs);

  // Fallback: If no markers were found via standard events, scan the entire event log for any user timing markers
  if (markers.length === 0) {
    for (const ev of events) {
      if (!ev) continue;
      if (ev.ph === 'R' || ev.ph === 'n' || ev.ph === 'I') {
        markers.push({
          name: ev.name,
          timeMs: (ev.ts - minTs) / 1000,
        });
      }
    }
    markers.sort((a, b) => a.timeMs - b.timeMs);
  }

  return {
    metadata: {
      fileName,
      fileSize,
      totalDurationMs,
      cpuTimeMs,
      mainPid,
      mainTid,
    },
    categories: {
      loadingMs,
      scriptingMs,
      renderingMs,
      paintingMs,
      otherMs,
      idleMs,
    },
    longTasks,
    markers: markers.slice(0, 15), // Cap at 15 key markers
  };
}

/**
 * Parses Chrome Performance Trace asynchronously in a Web Worker.
 */
export function parseTraceAsync(file: File): Promise<ParsedTrace> {
  return new Promise<ParsedTrace>((resolve, reject) => {
    const worker = new Worker(new URL('./traceWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<{ type: 'success'; parsed: ParsedTrace } | { type: 'error'; error: string }>) => {
      if (e.data.type === 'success') {
        resolve(e.data.parsed);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    worker.postMessage({ file });
  });
}
