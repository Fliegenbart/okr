"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { type BoardElementType } from "@prisma/client";
import { useAction } from "next-safe-action/hooks";
import {
  Edit3,
  Frame,
  Grip,
  RefreshCw,
  StickyNote,
  Type,
} from "lucide-react";
import { toast } from "sonner";

import {
  createBoardElement,
  deleteBoardElement,
  moveBoardElement,
  updateBoardElement,
} from "@/actions/board";
import {
  BoardElementDialog,
  type BoardElementDraft,
} from "@/components/dashboard/board-element-dialog";
import { Button } from "@/components/ui/button";
import { type BoardSnapshot } from "@/lib/boards";
import { cn } from "@/lib/utils";

type BoardWorkspaceProps = {
  initialBoard: BoardSnapshot;
};

type BoardElementSnapshot = BoardSnapshot["elements"][number];

type DialogState =
  | { mode: "create"; type: BoardElementType }
  | { mode: "edit"; elementId: string }
  | null;

type DragState = {
  elementId: string;
  pointerStartX: number;
  pointerStartY: number;
  elementStartX: number;
  elementStartY: number;
  width: number;
  height: number;
  zIndex: number;
  currentX: number;
  currentY: number;
};

type PanState = {
  pointerStartX: number;
  pointerStartY: number;
  viewportStartX: number;
  viewportStartY: number;
};

const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 2000;
const INITIAL_VIEWPORT = { x: 48, y: 40 };

const defaultDrafts: Record<BoardElementType, BoardElementDraft> = {
  NOTE: {
    type: "NOTE",
    title: "Neue Notiz",
    content: "",
    color: "#F9E27D",
  },
  TEXT: {
    type: "TEXT",
    title: "Neuer Textblock",
    content: "",
    color: "#FFFDF7",
  },
  FRAME: {
    type: "FRAME",
    title: "Neuer Bereich",
    content: "",
    color: "#E9F3FF",
  },
};

const defaultSizes: Record<BoardElementType, { width: number; height: number }> = {
  NOTE: { width: 280, height: 220 },
  TEXT: { width: 360, height: 180 },
  FRAME: { width: 520, height: 380 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getElementLabel(type: BoardElementType) {
  switch (type) {
    case "FRAME":
      return "Frame";
    case "TEXT":
      return "Text";
    case "NOTE":
    default:
      return "Notiz";
  }
}

function getConnectionLabel(status: "live" | "reconnecting" | "offline") {
  switch (status) {
    case "live":
      return "Live Sync aktiv";
    case "reconnecting":
      return "Verbindung wird erneuert";
    case "offline":
    default:
      return "Offline, lade nach";
  }
}

function getElementStyles(element: BoardElementSnapshot) {
  switch (element.type) {
    case "FRAME":
      return {
        shell:
          "border border-dashed border-black/10 bg-white/70 shadow-[0_18px_60px_rgba(20,20,20,0.08)]",
        title: "text-sm uppercase tracking-[0.18em] text-foreground/75",
        content: "text-sm text-muted-foreground",
      };
    case "TEXT":
      return {
        shell:
          "border border-white/80 bg-white/95 shadow-[0_14px_32px_rgba(20,20,20,0.08)]",
        title: "text-base font-semibold text-foreground",
        content: "text-sm leading-6 text-muted-foreground",
      };
    case "NOTE":
    default:
      return {
        shell:
          "border border-black/5 shadow-[0_18px_40px_rgba(50,40,10,0.16)]",
        title: "text-sm font-semibold text-foreground",
        content: "text-sm leading-6 text-foreground/80",
      };
  }
}

export function BoardWorkspace({ initialBoard }: BoardWorkspaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);

  const [board, setBoard] = useState(initialBoard);
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [draft, setDraft] = useState<BoardElementDraft>(defaultDrafts.NOTE);
  const [connectionStatus, setConnectionStatus] = useState<
    "live" | "reconnecting" | "offline"
  >("live");
  const [isInteracting, setIsInteracting] = useState(false);

  const sortedElements = useMemo(
    () => [...board.elements].sort((left, right) => left.zIndex - right.zIndex),
    [board.elements]
  );

  async function refreshBoardSnapshot() {
    const response = await fetch(`/api/boards/${board.id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      setConnectionStatus("offline");
      return;
    }

    const nextBoard = (await response.json()) as BoardSnapshot;
    setBoard(nextBoard);
    setConnectionStatus("live");
  }

  const applySnapshot = useEffectEvent((nextBoard: BoardSnapshot) => {
    if (dragStateRef.current) {
      return;
    }

    setBoard(nextBoard);
    setConnectionStatus("live");
  });

  useEffect(() => {
    document.body.classList.toggle("select-none", isInteracting);

    return () => {
      document.body.classList.remove("select-none");
    };
  }, [isInteracting]);

  useEffect(() => {
    let cancelled = false;
    let fallbackInterval: number | null = null;

    const source = new EventSource(`/api/boards/${board.id}/events`);

    const refreshFromEffect = async () => {
      const response = await fetch(`/api/boards/${board.id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        setConnectionStatus("offline");
        return;
      }

      const nextBoard = (await response.json()) as BoardSnapshot;
      applySnapshot(nextBoard);
    };

    const handleSnapshot = (event: MessageEvent) => {
      if (cancelled) return;

      try {
        applySnapshot(JSON.parse(event.data) as BoardSnapshot);
      } catch {
        setConnectionStatus("reconnecting");
      }
    };

    const handleHeartbeat = () => {
      if (!cancelled) {
        setConnectionStatus("live");
      }
    };

    source.addEventListener("snapshot", handleSnapshot as EventListener);
    source.addEventListener("heartbeat", handleHeartbeat as EventListener);
    source.onerror = () => {
      if (cancelled) return;

      setConnectionStatus("reconnecting");
      source.close();

      if (!fallbackInterval) {
        fallbackInterval = window.setInterval(() => {
          void refreshFromEffect();
        }, 4000);
      }
    };

    return () => {
      cancelled = true;
      source.close();
      if (fallbackInterval) {
        window.clearInterval(fallbackInterval);
      }
    };
  }, [board.id]);

  const moveAction = useAction(moveBoardElement, {
    onError: ({ error }) => {
      toast.error("Position konnte nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
      void refreshBoardSnapshot();
    },
  });
  const moveActionExecuteRef = useRef(moveAction.execute);

  useEffect(() => {
    moveActionExecuteRef.current = moveAction.execute;
  }, [moveAction.execute]);

  const createAction = useAction(createBoardElement, {
    onSuccess: () => {
      toast.success("Element angelegt");
      setDialogState(null);
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Element konnte nicht angelegt werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const updateAction = useAction(updateBoardElement, {
    onSuccess: () => {
      toast.success("Element gespeichert");
      setDialogState(null);
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Aenderungen konnten nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const deleteAction = useAction(deleteBoardElement, {
    onSuccess: () => {
      toast.success("Element geloescht");
      setDialogState(null);
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Element konnte nicht geloescht werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const beginElementDrag = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
    element: BoardElementSnapshot
  ) => {
    const target = event.target as HTMLElement;

    if (target.closest("[data-board-action='true']")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const topZIndex =
      board.elements.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1;

    dragStateRef.current = {
      elementId: element.id,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      elementStartX: element.x,
      elementStartY: element.y,
      width: element.width,
      height: element.height,
      zIndex: topZIndex,
      currentX: element.x,
      currentY: element.y,
    };

    setIsInteracting(true);

    setBoard((currentBoard) => ({
      ...currentBoard,
      elements: currentBoard.elements.map((item) =>
        item.id === element.id ? { ...item, zIndex: topZIndex } : item
      ),
    }));
  };

  const beginPan = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    panStateRef.current = {
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      viewportStartX: viewport.x,
      viewportStartY: viewport.y,
    };

    setIsInteracting(true);
  };

  useEffect(() => {
    const handleMove = (event: MouseEvent | PointerEvent) => {
      if (dragStateRef.current) {
        const nextX = clamp(
          dragStateRef.current.elementStartX +
            (event.clientX - dragStateRef.current.pointerStartX),
          24,
          CANVAS_WIDTH - dragStateRef.current.width - 24
        );
        const nextY = clamp(
          dragStateRef.current.elementStartY +
            (event.clientY - dragStateRef.current.pointerStartY),
          24,
          CANVAS_HEIGHT - dragStateRef.current.height - 24
        );

        dragStateRef.current.currentX = nextX;
        dragStateRef.current.currentY = nextY;

        setBoard((currentBoard) => ({
          ...currentBoard,
          elements: currentBoard.elements.map((item) =>
            item.id === dragStateRef.current?.elementId
              ? {
                  ...item,
                  x: nextX,
                  y: nextY,
                  zIndex: dragStateRef.current.zIndex,
                }
              : item
          ),
        }));

        return;
      }

      if (panStateRef.current) {
        setViewport({
          x:
            panStateRef.current.viewportStartX +
            (event.clientX - panStateRef.current.pointerStartX),
          y:
            panStateRef.current.viewportStartY +
            (event.clientY - panStateRef.current.pointerStartY),
        });
      }
    };

    const handleUp = () => {
      const activeDrag = dragStateRef.current;

      dragStateRef.current = null;
      panStateRef.current = null;
      setIsInteracting(false);

      if (!activeDrag) {
        return;
      }

      moveActionExecuteRef.current({
        elementId: activeDrag.elementId,
        x: activeDrag.currentX,
        y: activeDrag.currentY,
        zIndex: activeDrag.zIndex,
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setIsInteracting(false);
    };
  }, []);

  const openCreateDialog = (type: BoardElementType) => {
    setDialogState({ mode: "create", type });
    setDraft(defaultDrafts[type]);
  };

  const openEditDialog = (element: BoardElementSnapshot) => {
    setDialogState({ mode: "edit", elementId: element.id });
    setDraft({
      type: element.type,
      title: element.title ?? "",
      content: element.content ?? "",
      color: element.color ?? defaultDrafts[element.type].color,
    });
  };

  const handleDialogSubmit = () => {
    if (!dialogState) return;

    if (dialogState.mode === "create") {
      const rect = viewportRef.current?.getBoundingClientRect();
      const size = defaultSizes[draft.type];
      const boardX = clamp(
        ((rect?.width ?? 1200) / 2 - viewport.x) - size.width / 2,
        24,
        CANVAS_WIDTH - size.width - 24
      );
      const boardY = clamp(
        ((rect?.height ?? 720) / 2 - viewport.y) - size.height / 2,
        24,
        CANVAS_HEIGHT - size.height - 24
      );

      createAction.execute({
        boardId: board.id,
        type: draft.type,
        title: draft.title,
        content: draft.content,
        color: draft.color,
        x: boardX,
        y: boardY,
        width: size.width,
        height: size.height,
      });
      return;
    }

    updateAction.execute({
      elementId: dialogState.elementId,
      title: draft.title,
      content: draft.content,
      color: draft.color,
    });
  };

  const handleDelete = () => {
    if (!dialogState || dialogState.mode !== "edit") return;
    deleteAction.execute({ elementId: dialogState.elementId });
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_22px_60px_rgba(24,24,24,0.08)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Board Tools
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {board.title}
              </h2>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                connectionStatus === "live"
                  ? "bg-emerald-100 text-emerald-700"
                  : connectionStatus === "reconnecting"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-200 text-slate-700"
              )}
            >
              {getConnectionLabel(connectionStatus)}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Zieht Karten frei auf die Flaeche, zieht am Hintergrund zum Schwenken und
            oeffnet den Editor ueber das Stift-Icon.
          </p>

          <div className="mt-6 grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start rounded-2xl"
              onClick={() => openCreateDialog("NOTE")}
            >
              <StickyNote className="h-4 w-4" />
              Sticky Note
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start rounded-2xl"
              onClick={() => openCreateDialog("TEXT")}
            >
              <Type className="h-4 w-4" />
              Textblock
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start rounded-2xl"
              onClick={() => openCreateDialog("FRAME")}
            >
              <Frame className="h-4 w-4" />
              Frame
            </Button>
          </div>

          <div className="mt-6 rounded-[1.5rem] bg-muted/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Hinweise
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Notizen eignen sich fuer OKRs, Ideen und To-dos.</li>
              <li>Frames helfen euch, Roadmap- und Themenbereiche zu strukturieren.</li>
              <li>Live-Updates erscheinen automatisch bei beiden Partnern.</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="mt-5 rounded-2xl"
            onClick={() => void refreshBoardSnapshot()}
          >
            <RefreshCw className="h-4 w-4" />
            Board neu laden
          </Button>
        </aside>

        <div className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-[0_22px_60px_rgba(24,24,24,0.08)] backdrop-blur-sm">
          <div
            ref={viewportRef}
            data-testid="board-canvas"
            className="relative h-[72vh] min-h-[640px] overflow-hidden rounded-[1.6rem] border border-border/60 bg-[#f8f6f2]"
            onPointerDown={beginPan}
            onMouseDown={beginPan}
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(29,29,31,0.14) 1px, transparent 0)",
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
              backgroundSize: "32px 32px",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px)`,
                transformOrigin: "top left",
              }}
            >
              <div
                className="relative rounded-[2rem] border border-dashed border-black/8 bg-white/30"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                }}
              >
                {sortedElements.map((element) => {
                  const styles = getElementStyles(element);
                  const isFrame = element.type === "FRAME";

                  return (
                    <div
                      key={element.id}
                      data-testid={`board-element-${element.id}`}
                      className={cn(
                        "group absolute overflow-hidden rounded-[1.7rem] transition-shadow",
                        styles.shell
                      )}
                      style={{
                        left: element.x,
                        top: element.y,
                        width: element.width,
                        height: element.height,
                        zIndex: element.zIndex,
                        backgroundColor: element.color ?? defaultDrafts[element.type].color,
                      }}
                      onPointerDown={(event) => beginElementDrag(event, element)}
                      onMouseDown={(event) => beginElementDrag(event, element)}
                    >
                      <div className="flex h-full flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                              {getElementLabel(element.type)}
                            </p>
                            {element.title ? (
                              <p className={cn("mt-1 truncate", styles.title)}>
                                {element.title}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-white/80 p-1 text-muted-foreground">
                              <Grip className="h-3.5 w-3.5" />
                            </span>
                            <button
                              type="button"
                              data-board-action="true"
                              onClick={() => openEditDialog(element)}
                              className="rounded-full bg-white/85 p-1.5 text-muted-foreground transition hover:text-foreground"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {element.content ? (
                          <p
                            className={cn(
                              "mt-4 whitespace-pre-wrap break-words",
                              styles.content
                            )}
                          >
                            {element.content}
                          </p>
                        ) : (
                          <p className="mt-4 text-sm text-foreground/35">
                            {isFrame
                              ? "Zieht weitere Elemente in diesen Bereich."
                              : "Noch kein Inhalt"}
                          </p>
                        )}

                        {isFrame ? (
                          <div className="mt-4 flex-1 rounded-[1.3rem] border border-dashed border-black/10 bg-white/25" />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BoardElementDialog
        open={dialogState !== null}
        mode={dialogState?.mode ?? "create"}
        draft={draft}
        isSaving={createAction.isPending || updateAction.isPending}
        isDeleting={deleteAction.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(null);
          }
        }}
        onDraftChange={setDraft}
        onSubmit={handleDialogSubmit}
        onDelete={dialogState?.mode === "edit" ? handleDelete : undefined}
      />
    </>
  );
}
