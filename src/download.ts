function trigger(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string): void {
  trigger(filename, new Blob([text], { type: "text/plain" }));
}

export function downloadBytes(filename: string, bytes: Uint8Array, type: string): void {
  trigger(filename, new Blob([bytes as BlobPart], { type }));
}
