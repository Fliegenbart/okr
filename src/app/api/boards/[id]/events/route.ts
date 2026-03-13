import { requireUserWithCouple } from "@/actions/utils";
import {
  type BoardSnapshot,
  getBoardForCoupleById,
  serializeBoard,
} from "@/lib/boards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeEvent(event: string, data: BoardSnapshot | { version: number }) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUserWithCouple();
    const { id } = await context.params;

    const initialBoard = await getBoardForCoupleById(id, user.coupleId);

    if (!initialBoard) {
      return new Response("Board nicht gefunden.", { status: 404 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        let lastVersion = initialBoard.version;

        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };

        const onAbort = () => close();

        request.signal.addEventListener("abort", onAbort);
        controller.enqueue(encodeEvent("snapshot", serializeBoard(initialBoard)));

        while (!closed) {
          await wait(1500);

          if (closed) {
            break;
          }

          const latestBoard = await getBoardForCoupleById(id, user.coupleId);

          if (!latestBoard) {
            close();
            break;
          }

          if (latestBoard.version !== lastVersion) {
            lastVersion = latestBoard.version;
            controller.enqueue(encodeEvent("snapshot", serializeBoard(latestBoard)));
            continue;
          }

          controller.enqueue(
            encodeEvent("heartbeat", {
              version: latestBoard.version,
            })
          );
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Stream konnte nicht gestartet werden.",
      { status: 401 }
    );
  }
}
