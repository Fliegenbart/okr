"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { type BoardElementType } from "@prisma/client";
import { useAction } from "next-safe-action/hooks";
import {
  Edit3,
  Frame,
  Grip,
  LocateFixed,
  Minus,
  Plus,
  RefreshCw,
  ScanSearch,
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

type ViewportState = {
  x: number;
  y: number;
  scale: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

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
  scale: number;
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
const INITIAL_VIEWPORT: ViewportState = { x: 48, y: 40, scale: 1 };
const GRID_SIZE = 32;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.6;
const MINI_MAP_WIDTH = 220;
const MINI_MAP_HEIGHT = 140;
const VIEWPORT_PADDING = 80;
const ELEMENT_PADDING = 24;

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

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function constrainViewport(viewport: ViewportState, size: ViewportSize) {
  const scaledBoardWidth = CANVAS_WIDTH * viewport.scale;
  const scaledBoardHeight = CANVAS_HEIGHT * viewport.scale;

  const x =
    scaledBoardWidth <= size.width - VIEWPORT_PADDING * 2
      ? (size.width - scaledBoardWidth) / 2
      : clamp(
          viewport.x,
          size.width - scaledBoardWidth - VIEWPORT_PADDING,
          VIEWPORT_PADDING
        );
  const y =
    scaledBoardHeight <= size.height - VIEWPORT_PADDING * 2
      ? (size.height - scaledBoardHeight) / 2
      : clamp(
          viewport.y,
          size.height - scaledBoardHeight - VIEWPORT_PADDING,
          VIEWPORT_PADDING
        );

  return {
    x,
    y,
    scale: clamp(viewport.scale, MIN_SCALE, MAX_SCALE),
  };
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

function getViewportForScale(
  viewport: ViewportState,
  nextScale: number,
  origin: { x: number; y: number }
) {
  const canvasX = (origin.x - viewport.x) / viewport.scale;
  const canvasY = (origin.y - viewport.y) / viewport.scale;

  return {
    x: origin.x - canvasX * nextScale,
    y: origin.y - canvasY * nextScale,
    scale: nextScale,
  };
}

function getFitViewport(size: ViewportSize): ViewportState {
  const scale = clamp(
    Math.min(
      (size.width - VIEWPORT_PADDING * 2) / CANVAS_WIDTH,
      (size.height - VIEWPORT_PADDING * 2) / CANVAS_HEIGHT
    ),
    MIN_SCALE,
    1
  );

  return constrainViewport(
    {
      x: (size.width - CANVAS_WIDTH * scale) / 2,
      y: (size.height - CANVAS_HEIGHT * scale) / 2,
      scale,
    },
    size
  );
}

export function BoardWorkspace({ initialBoard }: BoardWorkspaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const viewportStateRef = useRef<ViewportState>(INITIAL_VIEWPORT);
  const viewportSizeRef = useRef<ViewportSize>({ width: 1200, height: 720 });
  const moveActionExecuteRef = useRef<(args: {
    elementId: string;
    x: number;
    y: number;
    zIndex: number;
  }) => void>(() => undefined);

  const [board, setBoard] = useState(initialBoard);
  const [viewport, setViewport] = useState<ViewportState>(INITIAL_VIEWPORT);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    width: 1200,
    height: 720,
  });
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [draft, setDraft] = useState<BoardElementDraft>(defaultDrafts.NOTE);
  const [connectionStatus, setConnectionStatus] = useState<
    "live" | "reconnecting" | "offline"
  >("live");
  const [isInteracting, setIsInteracting] = useState(false);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const sortedElements = useMemo(
    () => [...board.elements].sort((left, right) => left.zIndex - right.zIndex),
    [board.elements]
  );

  const miniMapMetrics = useMemo(() => {
    const scale = Math.min(MINI_MAP_WIDTH / CANVAS_WIDTH, MINI_MAP_HEIGHT / CANVAS_HEIGHT);
    const width = CANVAS_WIDTH * scale;
    const height = CANVAS_HEIGHT * scale;
    const visibleWidth = viewportSize.width / viewport.scale;
    const visibleHeight = viewportSize.height / viewport.scale;

    return {
      scale,
      width,
      height,
      viewportLeft: clamp((-viewport.x / viewport.scale) * scale, 0, width),
      viewportTop: clamp((-viewport.y / viewport.scale) * scale, 0, height),
      viewportWidth: Math.min(visibleWidth * scale, width),
      viewportHeight: Math.min(visibleHeight * scale, height),
    };
  }, [viewport, viewportSize]);

  const setViewportConstrained = (
    next:
      | ViewportState
      | ((currentViewport: ViewportState) => ViewportState)
  ) => {
    setViewport((currentViewport) => {
      const resolved =
        typeof next === "function" ? next(currentViewport) : next;
      const constrained = constrainViewport(
        resolved,
        viewportSizeRef.current
      );
      viewportStateRef.current = constrained;
      return constrained;
    });
  };

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
    viewportStateRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    viewportSizeRef.current = viewportSize;
  }, [viewportSize]);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    const updateSize = () => {
      if (!viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      const nextSize = {
        width: rect.width,
        height: rect.height,
      };

      setViewportSize(nextSize);
      viewportSizeRef.current = nextSize;
      setViewportConstrained((currentViewport) =>
        constrainViewport(currentViewport, nextSize)
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

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

  const fitBoardToViewport = () => {
    setViewportConstrained(getFitViewport(viewportSizeRef.current));
  };

  const resetViewport = () => {
    setViewportConstrained(INITIAL_VIEWPORT);
  };

  const zoomAt = (nextScale: number, origin?: { x: number; y: number }) => {
    const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const fallbackOrigin = {
      x: viewportSizeRef.current.width / 2,
      y: viewportSizeRef.current.height / 2,
    };

    setViewportConstrained((currentViewport) =>
      getViewportForScale(currentViewport, safeScale, origin ?? fallbackOrigin)
    );
  };

  const zoomByStep = (direction: "in" | "out") => {
    const nextScale =
      viewportStateRef.current.scale + (direction === "in" ? 0.15 : -0.15);
    zoomAt(nextScale);
  };

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
      scale: viewportStateRef.current.scale,
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
      viewportStartX: viewportStateRef.current.x,
      viewportStartY: viewportStateRef.current.y,
    };

    setIsInteracting(true);
  };

  useEffect(() => {
    const handleMove = (event: MouseEvent | PointerEvent) => {
      if (dragStateRef.current) {
        const rawX =
          dragStateRef.current.elementStartX +
          (event.clientX - dragStateRef.current.pointerStartX) /
            dragStateRef.current.scale;
        const rawY =
          dragStateRef.current.elementStartY +
          (event.clientY - dragStateRef.current.pointerStartY) /
            dragStateRef.current.scale;
        const nextX = clamp(
          snapToGrid(rawX),
          ELEMENT_PADDING,
          CANVAS_WIDTH - dragStateRef.current.width - ELEMENT_PADDING
        );
        const nextY = clamp(
          snapToGrid(rawY),
          ELEMENT_PADDING,
          CANVAS_HEIGHT - dragStateRef.current.height - ELEMENT_PADDING
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
        setViewportConstrained((currentViewport) => ({
          ...currentViewport,
          x:
            panStateRef.current!.viewportStartX +
            (event.clientX - panStateRef.current!.pointerStartX),
          y:
            panStateRef.current!.viewportStartY +
            (event.clientY - panStateRef.current!.pointerStartY),
        }));
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

  const openDialogDeferred = (nextState: NonNullable<DialogState>, nextDraft: BoardElementDraft) => {
    window.requestAnimationFrame(() => {
      setDraft(nextDraft);
      setDialogState(nextState);
    });
  };

  const openCreateDialog = (type: BoardElementType) => {
    openDialogDeferred({ mode: "create", type }, defaultDrafts[type]);
  };

  const openEditDialog = (element: BoardElementSnapshot) => {
    openDialogDeferred(
      { mode: "edit", elementId: element.id },
      {
        type: element.type,
        title: element.title ?? "",
        content: element.content ?? "",
        color: element.color ?? defaultDrafts[element.type].color,
      }
    );
  };

  const handleDialogSubmit = () => {
    if (!dialogState) return;

    if (dialogState.mode === "create") {
      const size = defaultSizes[draft.type];
      const boardX = clamp(
        (viewportSize.width / 2 - viewport.x) / viewport.scale - size.width / 2,
        ELEMENT_PADDING,
        CANVAS_WIDTH - size.width - ELEMENT_PADDING
      );
      const boardY = clamp(
        (viewportSize.height / 2 - viewport.y) / viewport.scale - size.height / 2,
        ELEMENT_PADDING,
        CANVAS_HEIGHT - size.height - ELEMENT_PADDING
      );

      createAction.execute({
        boardId: board.id,
        type: draft.type,
        title: draft.title,
        content: draft.content,
        color: draft.color,
        x: snapToGrid(boardX),
        y: snapToGrid(boardY),
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

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const origin = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const nextScale =
      viewportStateRef.current.scale + (event.deltaY < 0 ? 0.08 : -0.08);

    zoomAt(nextScale, origin);
  };

  const handleMiniMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const canvasX = offsetX / miniMapMetrics.scale;
    const canvasY = offsetY / miniMapMetrics.scale;
    const nextScale = viewportStateRef.current.scale;

    setViewportConstrained({
      x: viewportSize.width / 2 - canvasX * nextScale,
      y: viewportSize.height / 2 - canvasY * nextScale,
      scale: nextScale,
    });
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
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
            <div className="flex flex-col items-end gap-2">
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
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                {Math.round(viewport.scale * 100)}%
              </span>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Zoomt mit den Controls oder per Trackpad-Pinch, zieht am Hintergrund zum
            Navigieren und lasst Karten am Grid einrasten, damit das Board schneller
            lesbar bleibt.
          </p>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Elemente
            </p>
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={() => openCreateDialog("NOTE")}
                disabled={!isHydrated}
              >
                <StickyNote className="h-4 w-4" />
                Sticky Note
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={() => openCreateDialog("TEXT")}
                disabled={!isHydrated}
              >
                <Type className="h-4 w-4" />
                Textblock
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={() => openCreateDialog("FRAME")}
                disabled={!isHydrated}
              >
                <Frame className="h-4 w-4" />
                Frame
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Navigation
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={() => zoomByStep("out")}
                disabled={!isHydrated}
              >
                <Minus className="h-4 w-4" />
                Zoom out
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={() => zoomByStep("in")}
                disabled={!isHydrated}
              >
                <Plus className="h-4 w-4" />
                Zoom in
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={resetViewport}
                disabled={!isHydrated}
              >
                <LocateFixed className="h-4 w-4" />
                Reset view
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start rounded-2xl"
                onClick={fitBoardToViewport}
                disabled={!isHydrated}
              >
                <ScanSearch className="h-4 w-4" />
                Fit board
              </Button>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] bg-muted/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Was jetzt besser ist
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Elemente rasten am 32px-Grid ein.</li>
              <li>Das Board laesst sich zoomen und sauber zentrieren.</li>
              <li>Die Minimap gibt euch Orientierung auf grossen Flaechen.</li>
              <li>Doppelklick auf eine Karte oeffnet direkt den Editor.</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="mt-5 rounded-2xl"
            onClick={() => void refreshBoardSnapshot()}
            disabled={!isHydrated}
          >
            <RefreshCw className="h-4 w-4" />
            Board neu laden
          </Button>
        </aside>

        <div className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-[0_22px_60px_rgba(24,24,24,0.08)] backdrop-blur-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1.5">
                Grid {GRID_SIZE}px
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5">
                Canvas {CANVAS_WIDTH} x {CANVAS_HEIGHT}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5">
                Ctrl/Cmd + Scroll zoomt
              </span>
              {!isHydrated ? (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">
                  Board wird aktiviert ...
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => zoomByStep("out")}
                disabled={!isHydrated}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="min-w-16 rounded-full border border-border bg-white px-3 py-1 text-center text-sm font-semibold text-foreground">
                {Math.round(viewport.scale * 100)}%
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => zoomByStep("in")}
                disabled={!isHydrated}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div
              ref={viewportRef}
              data-testid="board-canvas"
              className={cn(
                "relative h-[72vh] min-h-[640px] overflow-hidden rounded-[1.6rem] border border-border/60 bg-[#f8f6f2]",
                !isHydrated
                  ? "pointer-events-none opacity-80"
                  : isInteracting
                    ? "cursor-grabbing"
                    : "cursor-grab"
              )}
              onPointerDown={beginPan}
              onMouseDown={beginPan}
              onWheel={handleCanvasWheel}
              aria-busy={!isHydrated}
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(29,29,31,0.14) 1px, transparent 0)",
                backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                backgroundSize: `${GRID_SIZE * viewport.scale}px ${
                  GRID_SIZE * viewport.scale
                }px`,
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
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
                          "group absolute overflow-hidden rounded-[1.7rem] transition-shadow hover:shadow-[0_24px_50px_rgba(20,20,20,0.12)]",
                          styles.shell
                        )}
                        style={{
                          left: element.x,
                          top: element.y,
                          width: element.width,
                          height: element.height,
                          zIndex: element.zIndex,
                          backgroundColor:
                            element.color ?? defaultDrafts[element.type].color,
                        }}
                        onPointerDown={(event) => beginElementDrag(event, element)}
                        onMouseDown={(event) => beginElementDrag(event, element)}
                        onDoubleClick={() => openEditDialog(element)}
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

            <div className="pointer-events-none absolute bottom-4 right-4 rounded-[1.4rem] border border-white/90 bg-white/92 p-3 shadow-[0_18px_40px_rgba(20,20,20,0.12)] backdrop-blur-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Minimap
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {Math.round(viewport.scale * 100)}%
                </p>
              </div>
              <div
                className="pointer-events-auto relative cursor-pointer rounded-[1rem] border border-border/60 bg-[#f8f6f2]"
                style={{
                  width: miniMapMetrics.width,
                  height: miniMapMetrics.height,
                }}
                onClick={handleMiniMapClick}
              >
                {sortedElements.map((element) => (
                  <div
                    key={element.id}
                    className="absolute rounded-sm border border-black/10"
                    style={{
                      left: element.x * miniMapMetrics.scale,
                      top: element.y * miniMapMetrics.scale,
                      width: Math.max(element.width * miniMapMetrics.scale, 8),
                      height: Math.max(element.height * miniMapMetrics.scale, 8),
                      backgroundColor:
                        element.color ?? defaultDrafts[element.type].color,
                    }}
                  />
                ))}
                <div
                  className="absolute rounded-md border-2 border-primary bg-primary/10"
                  style={{
                    left: miniMapMetrics.viewportLeft,
                    top: miniMapMetrics.viewportTop,
                    width: miniMapMetrics.viewportWidth,
                    height: miniMapMetrics.viewportHeight,
                  }}
                />
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
