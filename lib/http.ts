import { z } from "zod";
import { AppError } from "./security";
import { metrics } from "./metrics";
export async function bodyBytes(req: Request, max = 65536) {
  if (Number(req.headers.get("content-length")) > max)
    throw new AppError(413, "حجم درخواست بیش از حد مجاز است.");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new AppError(413, "حجم درخواست بیش از حد مجاز است.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function jsonBody(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "نوع درخواست باید JSON باشد.");
  try {
    return JSON.parse(new TextDecoder().decode(await bodyBytes(req)));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "درخواست نامعتبر است.");
  }
}
export async function handle(route: string, method: string, fn: () => Promise<unknown>) {
  const end = metrics.latency.startTimer({ route });
  let status = 200;
  try {
    const result = await fn();
    if (result instanceof Response) {
      status = result.status;
      return result;
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    status = e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 500;
    const message =
      e instanceof AppError
        ? e.message
        : e instanceof z.ZodError
          ? e.issues.map((i) => i.message).join(" · ")
          : "عملیات انجام نشد؛ لطفاً دوباره تلاش کنید.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  } finally {
    end();
    metrics.request.inc({ route, method, status: `${Math.floor(status / 100)}xx` });
  }
}
