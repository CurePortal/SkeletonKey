// Local document reading and analysis.
// Text/PDF extraction happens in the browser; analysis uses Ollama on this
// machine. No document content is sent to a cloud provider.

const MAX_TEXT = 20000;

export function isTextLike(file: File): boolean {
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|csv|log|json)$/i.test(file.name)
  );
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function pdfText(blob: Blob): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const chunks: string[] = [];
  const pages = Math.min(pdf.numPages, 20);
  for (let page = 1; page <= pages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    chunks.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
    if (chunks.join("\n").length > MAX_TEXT) break;
  }
  return chunks.join("\n").slice(0, MAX_TEXT);
}

export async function extractDocumentText(file: File): Promise<string> {
  try {
    if (isPdf(file)) return await pdfText(file);
    if (isTextLike(file)) return (await file.text()).slice(0, MAX_TEXT);
  } catch (error) {
    console.warn("Document text extraction failed", error);
  }
  return "";
}

export async function analyzeDocumentWithOllama(
  name: string,
  text: string,
): Promise<string> {
  const system = `You are the local SkeletonKey assistant. Read one document and explain it to its owner.
Rules:
- You are not a lawyer, benefits worker, tax preparer, or financial adviser.
- Never invent facts, amounts, names, dates, agencies, or deadlines.
- If something is unclear or unreadable, say so.
- Do not file, send, or sign anything.
- Be concrete and brief: what it is, key dates/amounts/names, what the person may need to do next, and what to verify.
Return plain text, not JSON.`;
  const user = text
    ? `Document: ${name}\n\n${text}\n\nExplain this document for the person who owns it.`
    : `Document: ${name}\n\nNo readable text was extracted. It may be a scan or photo. Say that you cannot read it and ask for a typed summary or a better scan.`;

  const { callConfiguredAI } = await import("./llmProviders");
  return callConfiguredAI(system, user, { temperature: 0.2 });
}

