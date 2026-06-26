import { parseTrace } from './traceParser.ts';

self.addEventListener('message', (e: MessageEvent<{ file: File }>) => {
  const { file } = e.data;
  void (async () => {
    try {
      const isGzip = file.name.endsWith('.gz');
      let text = '';

      if (isGzip) {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = file.stream().pipeThrough(ds);
        const response = new Response(decompressedStream);
        text = await response.text();
      } else {
        text = await file.text();
      }

      const parsed = parseTrace(file.name, file.size, text);
      self.postMessage({ type: 'success', parsed });
    } catch (err) {
      self.postMessage({ type: 'error', error: (err as Error).message });
    }
  })();
});
