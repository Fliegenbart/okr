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
  CaseSensitive,
  Edit3,
  Frame,
  Grip,
  Hand,
  Layers3,
  Link2,
  LocateFixed,
  Minus,
  MousePointer2,
  Plus,
  RefreshCw,
  ScanSearch,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  createBoardConnection,
  createBoardElement,
  deleteBoardConnection,
  deleteBoardElements,
  deleteBoardElement,
  moveBoardElements,
  updateBoardElement,
} from "@/actions/board";
import {
  BoardElementDialog,
  BOARD_COLOR_OPTIONS,
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
  pointerStartX: number;
  pointerStartY: number;
  scale: number;
  selectedIds: string[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  deltaX: number;
  deltaY: number;
  zIndexMap: Record<string, number>;
  initialElements: Array<{
    id: string;
    x: number;
    y: number;
  }>;
};

type PanState = {
  pointerStartX: number;
  pointerStartY: number;
  viewportStartX: number;
  viewportStartY: number;
};

type PinchState = {
  // Distance between the two touch points when the gesture started, in CSS
  // pixels. Ratio of current distance vs. this yields the scale delta.
  startDistance: number;
  // Viewport scale at gesture start. We always compute the next scale from
  // here so the pinch feels like one continuous gesture (not cumulative).
  startScale: number;
  // Midpoint of the two touches relative to the viewport element; used as
  // the zoom origin so the canvas visually stays under the user's fingers.
  originX: number;
  originY: number;
};

type ResizeState = {
  elementId: string;
  pointerStartX: number;
  pointerStartY: number;
  widthStart: number;
  heightStart: number;
  elementX: number;
  elementY: number;
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
const RESIZE_HANDLE_SIZE = 16;

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

function getConnectionKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("::");
}

function getSelectionBounds(elements: BoardElementSnapshot[]) {
  if (elements.length === 0) {
    return null;
  }

  const minX = Math.min(...elements.map((element) => element.x));
  const minY = Math.min(...elements.map((element) => element.y));
  const maxX = Math.max(...elements.map((element) => element.x + element.width));
  const maxY = Math.max(...elements.map((element) => element.y + element.height));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getConnectionPoint(
  element: BoardElementSnapshot,
  target: BoardElementSnapshot
) {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const deltaX = targetCenterX - centerX;
  const deltaY = targetCenterY - centerY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX >= 0
      ? { x: element.x + element.width, y: centerY, axis: "x" as const }
      : { x: element.x, y: centerY, axis: "x" as const };
  }

  return deltaY >= 0
    ? { x: centerX, y: element.y + element.height, axis: "y" as const }
    : { x: centerX, y: element.y, axis: "y" as const };
}

function getConnectionPath(
  fromElement: BoardElementSnapshot,
  toElement: BoardElementSnapshot
) {
  const start = getConnectionPoint(fromElement, toElement);
  const end = getConnectionPoint(toElement, fromElement);

  if (start.axis === "x") {
    const offset = Math.max(72, Math.abs(end.x - start.x) * 0.35);
    return `M ${start.x} ${start.y} C ${start.x + offset} ${start.y}, ${end.x - offset} ${end.y}, ${end.x} ${end.y}`;
  }

  const offset = Math.max(72, Math.abs(end.y - start.y) * 0.35);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + offset}, ${end.x} ${end.y - offset}, ${end.x} ${end.y}`;
}

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
  const boardStateRef = useRef(initialBoard);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const pinchStateRef = useRef<PinchState | null>(null);
  // Tracks every pointer currently pressing the canvas (mouse or touch). Used
  // to detect pinch-zoom: when the map size crosses from 1 → 2 we switch the
  // interaction from pan to pinch; 2 → 1 ends the pinch gracefully.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const resizeStateRef = useRef<ResizeState | null>(null);
  const viewportStateRef = useRef<ViewportState>(INITIAL_VIEWPORT);
  const viewportSizeRef = useRef<ViewportSize>({ width: 1200, height: 720 });
  const moveActionExecuteRef = useRef<
    (
      moves: Array<{
        elementId: string;
        x: number;
        y: number;
        zIndex: number;
      }>
    ) => void
  >(() => undefined);

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
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const sortedElements = useMemo(
    () => [...board.elements].sort((left, right) => left.zIndex - right.zIndex),
    [board.elements]
  );

  const elementMap = useMemo(
    () => new Map(board.elements.map((element) => [element.id, element])),
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

  const selectedElements = useMemo(
    () =>
      selectedElementIds
        .map((elementId) => elementMap.get(elementId) ?? null)
        .filter((element): element is BoardElementSnapshot => element !== null),
    [elementMap, selectedElementIds]
  );

  const selectedElement = selectedElements.at(-1) ?? null;

  const selectedBounds = useMemo(
    () => getSelectionBounds(selectedElements),
    [selectedElements]
  );

  const selectedPairConnection = useMemo(() => {
    if (selectedElements.length !== 2) {
      return null;
    }

    const pairKey = getConnectionKey(selectedElements[0]!.id, selectedElements[1]!.id);

    return (
      board.connections.find(
        (connection) =>
          getConnectionKey(connection.fromElementId, connection.toElementId) === pairKey
      ) ?? null
    );
  }, [board.connections, selectedElements]);

  const sharedSelectionColor = useMemo(() => {
    if (selectedElements.length === 0) {
      return null;
    }

    const colors = new Set(
      selectedElements.map(
        (element) => element.color ?? defaultDrafts[element.type].color
      )
    );

    return colors.size === 1 ? Array.from(colors)[0]! : null;
  }, [selectedElements]);

  const selectedToolbarStyle = useMemo(() => {
    if (!selectedBounds) {
      return null;
    }

    return {
      left: viewport.x + (selectedBounds.minX + selectedBounds.width / 2) * viewport.scale,
      top: Math.max(
        18,
        viewport.y + selectedBounds.minY * viewport.scale - 18
      ),
    };
  }, [selectedBounds, viewport]);

  const connectionMarkerId = `board-arrow-${board.id}`;

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
    boardStateRef.current = board;
  }, [board]);

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

  const moveElementsAction = useAction(moveBoardElements, {
    onError: ({ error }) => {
      toast.error("Position konnte nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
      void refreshBoardSnapshot();
    },
  });

  useEffect(() => {
    moveActionExecuteRef.current = (moves) => {
      moveElementsAction.execute({ moves });
    };
  }, [moveElementsAction]);

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
      toast.error("Änderungen konnten nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const inlineUpdateAction = useAction(updateBoardElement, {
    onSuccess: () => {
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Element konnte nicht aktualisiert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
      void refreshBoardSnapshot();
    },
  });

  const applyInlineElementPatch = (
    elementId: string,
    patch: Partial<Pick<BoardElementSnapshot, "color" | "width" | "height">>
  ) => {
    setBoard((currentBoard) => ({
      ...currentBoard,
      elements: currentBoard.elements.map((element) =>
        element.id === elementId ? { ...element, ...patch } : element
      ),
    }));

    inlineUpdateAction.execute({
      elementId,
      title: undefined,
      content: undefined,
      color: patch.color,
      width: patch.width,
      height: patch.height,
    });
  };

  const commitInlineElementPatch = useEffectEvent(
    (
      elementId: string,
      patch: Partial<Pick<BoardElementSnapshot, "color" | "width" | "height">>
    ) => {
      applyInlineElementPatch(elementId, patch);
    }
  );

  const deleteAction = useAction(deleteBoardElement, {
    onSuccess: () => {
      toast.success("Element gelöscht");
      setSelectedElementIds([]);
      setDialogState(null);
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Element konnte nicht gelöscht werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const deleteSelectionAction = useAction(deleteBoardElements, {
    onSuccess: () => {
      toast.success("Auswahl gelöscht");
      setSelectedElementIds([]);
      setDialogState(null);
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Auswahl konnte nicht gelöscht werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const createConnectionAction = useAction(createBoardConnection, {
    onSuccess: () => {
      toast.success("Verbindung angelegt");
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Verbindung konnte nicht angelegt werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const deleteConnectionAction = useAction(deleteBoardConnection, {
    onSuccess: () => {
      toast.success("Verbindung gelöst");
      void refreshBoardSnapshot();
    },
    onError: ({ error }) => {
      toast.error("Verbindung konnte nicht gelöst werden", {
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

  const zoomAt = (nextScale: number, origin?: { x: number; y: number }): void => {
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

  // useEffectEvent wraps zoomAt so the global pointermove handler (which
  // lives in a useEffect with stable deps) can always call the latest
  // closure without tripping react-hooks/exhaustive-deps.
  const handlePinchZoom = useEffectEvent((nextScale: number, origin: { x: number; y: number }) => {
    zoomAt(nextScale, origin);
  });

  const clearSelection = () => {
    setSelectedElementIds([]);
  };

  const setSingleSelection = (elementId: string) => {
    setSelectedElementIds([elementId]);
  };

  const toggleSelection = (elementId: string) => {
    setSelectedElementIds((currentSelection) =>
      currentSelection.includes(elementId)
        ? currentSelection.filter((id) => id !== elementId)
        : [...currentSelection, elementId]
    );
  };

  const applyInlinePatchToSelection = (
    patch: Partial<Pick<BoardElementSnapshot, "color" | "width" | "height">>
  ) => {
    const targetIds = selectedElements.map((element) => element.id);

    targetIds.forEach((elementId) => {
      applyInlineElementPatch(elementId, patch);
    });
  };

  const toggleSelectedConnection = () => {
    if (selectedElements.length !== 2) {
      return;
    }

    if (selectedPairConnection) {
      deleteConnectionAction.execute({
        connectionId: selectedPairConnection.id,
      });
      return;
    }

    createConnectionAction.execute({
      firstElementId: selectedElements[0]!.id,
      secondElementId: selectedElements[1]!.id,
      color: "#2854C5",
    });
  };

  const deleteCurrentSelection = () => {
    if (selectedElements.length === 0) {
      return;
    }

    deleteSelectionAction.execute({
      elementIds: selectedElements.map((element) => element.id),
    });
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
    const isAdditiveSelection = event.shiftKey || event.metaKey || event.ctrlKey;

    if (isAdditiveSelection) {
      toggleSelection(element.id);
      return;
    }

    const dragSelectionIds = selectedElementIds.includes(element.id)
      ? selectedElementIds
      : [element.id];
    const dragElements = sortedElements.filter((item) =>
      dragSelectionIds.includes(item.id)
    );
    const bounds = getSelectionBounds(dragElements);

    if (!bounds) {
      return;
    }

    const topZStart =
      board.elements.reduce((max, item) => Math.max(max, item.zIndex), 0) + 1;
    const zIndexMap = Object.fromEntries(
      [...dragElements]
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((item, index) => [item.id, topZStart + index])
    );

    setSelectedElementIds(dragSelectionIds);

    dragStateRef.current = {
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      scale: viewportStateRef.current.scale,
      selectedIds: dragSelectionIds,
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      deltaX: 0,
      deltaY: 0,
      zIndexMap,
      initialElements: dragElements.map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
      })),
    };

    setIsInteracting(true);

    setBoard((currentBoard) => ({
      ...currentBoard,
      elements: currentBoard.elements.map((item) =>
        dragSelectionIds.includes(item.id)
          ? { ...item, zIndex: zIndexMap[item.id] ?? item.zIndex }
          : item
      ),
    }));
  };

  const beginResize = (
    event: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>,
    element: BoardElementSnapshot
  ) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      elementId: element.id,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      widthStart: element.width,
      heightStart: element.height,
      elementX: element.x,
      elementY: element.y,
    };

    setSingleSelection(element.id);
    setIsInteracting(true);
  };

  const beginPan = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    // Track pointer only for pointer events (mouse events don't carry pointerId).
    // Mouse interaction stays on the classic single-pointer pan path.
    const pointerId = "pointerId" in event ? event.pointerId : null;
    if (pointerId !== null) {
      activePointersRef.current.set(pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    // Two-finger pinch: cancel any active pan and compute start geometry.
    if (activePointersRef.current.size === 2) {
      panStateRef.current = null;
      const points = Array.from(activePointersRef.current.values());
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect) {
        pinchStateRef.current = {
          startDistance: Math.hypot(dx, dy),
          startScale: viewportStateRef.current.scale,
          originX: (points[0].x + points[1].x) / 2 - rect.left,
          originY: (points[0].y + points[1].y) / 2 - rect.top,
        };
      }
      setIsInteracting(true);
      return;
    }

    clearSelection();

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
      if (resizeStateRef.current) {
        const nextWidth = clamp(
          snapToGrid(
            resizeStateRef.current.widthStart +
              (event.clientX - resizeStateRef.current.pointerStartX) /
                viewportStateRef.current.scale
          ),
          160,
          CANVAS_WIDTH - resizeStateRef.current.elementX - ELEMENT_PADDING
        );
        const nextHeight = clamp(
          snapToGrid(
            resizeStateRef.current.heightStart +
              (event.clientY - resizeStateRef.current.pointerStartY) /
                viewportStateRef.current.scale
          ),
          120,
          CANVAS_HEIGHT - resizeStateRef.current.elementY - ELEMENT_PADDING
        );

        setBoard((currentBoard) => ({
          ...currentBoard,
          elements: currentBoard.elements.map((item) =>
            item.id === resizeStateRef.current?.elementId
              ? {
                  ...item,
                  width: nextWidth,
                  height: nextHeight,
                }
              : item
          ),
        }));

        return;
      }

      if (dragStateRef.current) {
        const rawDeltaX =
          (event.clientX - dragStateRef.current.pointerStartX) /
          dragStateRef.current.scale;
        const rawDeltaY =
          (event.clientY - dragStateRef.current.pointerStartY) /
          dragStateRef.current.scale;
        const nextDeltaX = clamp(
          snapToGrid(rawDeltaX),
          ELEMENT_PADDING - dragStateRef.current.minX,
          CANVAS_WIDTH - ELEMENT_PADDING - dragStateRef.current.maxX
        );
        const nextDeltaY = clamp(
          snapToGrid(rawDeltaY),
          ELEMENT_PADDING - dragStateRef.current.minY,
          CANVAS_HEIGHT - ELEMENT_PADDING - dragStateRef.current.maxY
        );

        dragStateRef.current.deltaX = nextDeltaX;
        dragStateRef.current.deltaY = nextDeltaY;

        setBoard((currentBoard) => ({
          ...currentBoard,
          elements: currentBoard.elements.map((item) =>
            dragStateRef.current?.selectedIds.includes(item.id)
              ? {
                  ...item,
                  x:
                    dragStateRef.current.initialElements.find(
                      (element) => element.id === item.id
                    )!.x + nextDeltaX,
                  y:
                    dragStateRef.current.initialElements.find(
                      (element) => element.id === item.id
                    )!.y + nextDeltaY,
                  zIndex:
                    dragStateRef.current.zIndexMap[item.id] ?? item.zIndex,
                }
              : item
          ),
        }));

        return;
      }

      // Pinch-zoom: if two fingers are still down, update scale from distance.
      // We call through a ref so the outer useEffect can keep its empty deps
      // array without triggering the exhaustive-deps lint rule.
      if (pinchStateRef.current && "pointerId" in event) {
        activePointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (activePointersRef.current.size >= 2) {
          const points = Array.from(activePointersRef.current.values()).slice(0, 2);
          const dx = points[0].x - points[1].x;
          const dy = points[0].y - points[1].y;
          const distance = Math.hypot(dx, dy);
          const pinch = pinchStateRef.current;
          if (pinch.startDistance > 0) {
            const ratio = distance / pinch.startDistance;
            const nextScale = pinch.startScale * ratio;
            handlePinchZoom(nextScale, { x: pinch.originX, y: pinch.originY });
          }
        }
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

    const handleUp = (event: MouseEvent | PointerEvent) => {
      // Remove just this pointer from the active set. Pinch stays armed until
      // both fingers leave; a leftover single pointer simply becomes inert.
      if ("pointerId" in event) {
        activePointersRef.current.delete(event.pointerId);
      }
      if (activePointersRef.current.size < 2) {
        pinchStateRef.current = null;
      }

      const activeDrag = dragStateRef.current;
      const activeResize = resizeStateRef.current;

      dragStateRef.current = null;
      panStateRef.current = null;
      resizeStateRef.current = null;
      setIsInteracting(false);

      if (activeResize) {
        const resizedElement = boardStateRef.current.elements.find(
          (element) => element.id === activeResize.elementId
        );

        if (resizedElement) {
          commitInlineElementPatch(activeResize.elementId, {
            width: resizedElement.width,
            height: resizedElement.height,
          });
        }

        return;
      }

      if (!activeDrag) {
        return;
      }

      const moves = boardStateRef.current.elements
        .filter((element) => activeDrag.selectedIds.includes(element.id))
        .map((element) => ({
          elementId: element.id,
          x: element.x,
          y: element.y,
          zIndex: element.zIndex,
        }));

      if (moves.length > 0) {
        moveActionExecuteRef.current(moves);
      }
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
    setSingleSelection(element.id);
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

  const handleDuplicateCreate = (type: BoardElementType) => {
    clearSelection();
    openCreateDialog(type);
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

  const handleCanvasDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    clearSelection();
    const rect = event.currentTarget.getBoundingClientRect();
    const canvasX = clamp(
      snapToGrid((event.clientX - rect.left - viewport.x) / viewport.scale),
      ELEMENT_PADDING,
      CANVAS_WIDTH - defaultSizes.NOTE.width - ELEMENT_PADDING
    );
    const canvasY = clamp(
      snapToGrid((event.clientY - rect.top - viewport.y) / viewport.scale),
      ELEMENT_PADDING,
      CANVAS_HEIGHT - defaultSizes.NOTE.height - ELEMENT_PADDING
    );

    createAction.execute({
      boardId: board.id,
      type: "NOTE",
      title: defaultDrafts.NOTE.title,
      content: "",
      color: defaultDrafts.NOTE.color,
      x: canvasX,
      y: canvasY,
      width: defaultSizes.NOTE.width,
      height: defaultSizes.NOTE.height,
    });
  };

  const handleKeyboardShortcut = useEffectEvent((event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "Escape") {
        setDialogState(null);
        clearSelection();
        return;
      }

      if (event.key === "Enter" && selectedElements.length === 1 && selectedElement) {
        event.preventDefault();
        openEditDialog(selectedElement);
        return;
      }

      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selectedElements.length > 0
      ) {
        event.preventDefault();
        deleteCurrentSelection();
        return;
      }

      if (event.key.toLowerCase() === "c" && selectedElements.length === 2) {
        event.preventDefault();
        toggleSelectedConnection();
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleDuplicateCreate("NOTE");
        return;
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        handleDuplicateCreate("TEXT");
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        handleDuplicateCreate("FRAME");
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomByStep("in");
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomByStep("out");
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        fitBoardToViewport();
      }
    });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(246,249,255,0.96)_100%)] p-3 shadow-[0_26px_80px_rgba(24,24,24,0.10)]">
        <div className="relative overflow-hidden rounded-[1.8rem] border border-[#d9e5f5] bg-[#edf3fb]">
          <div className="pointer-events-none absolute inset-x-5 top-5 z-20 flex flex-wrap items-start justify-between gap-3">
            <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-[1.3rem] border border-white/90 bg-white/92 px-4 py-3 shadow-[0_16px_45px_rgba(20,20,20,0.10)] backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5f7aa0]">
                  Canvas View
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  {board.title}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="rounded-full bg-[#e8f0ff] px-3 py-1 text-[11px] font-semibold text-[#2854c5]">
                  {sortedElements.length} Elemente
                </span>
                <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-[11px] font-semibold text-[#3d6dd8]">
                  {board.connections.length} Verbindungen
                </span>
                <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-[11px] font-semibold text-[#5f708f]">
                  Canvas {CANVAS_WIDTH} x {CANVAS_HEIGHT}
                </span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2 rounded-[1.3rem] border border-white/90 bg-white/92 px-3 py-2 shadow-[0_16px_45px_rgba(20,20,20,0.10)] backdrop-blur-sm">
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
              <div className="min-w-18 rounded-full bg-[#eef3fb] px-3 py-1 text-center text-sm font-semibold text-foreground">
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={fitBoardToViewport}
                disabled={!isHydrated}
              >
                <ScanSearch className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={resetViewport}
                disabled={!isHydrated}
              >
                <LocateFixed className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-5 top-1/2 z-20 hidden -translate-y-1/2 lg:block">
            <div className="pointer-events-auto flex flex-col gap-2 rounded-[1.5rem] border border-white/90 bg-white/94 p-3 shadow-[0_18px_45px_rgba(20,20,20,0.10)] backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-xl bg-[#edf3ff] px-3 py-2 text-sm font-semibold text-[#2854c5]">
                <MousePointer2 className="h-4 w-4" />
                Select
              </div>
              <button
                type="button"
                onClick={() => handleDuplicateCreate("NOTE")}
                disabled={!isHydrated}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[#f3f6fb] disabled:opacity-50"
              >
                <StickyNote className="h-4 w-4 text-[#f59e0b]" />
                Note
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateCreate("TEXT")}
                disabled={!isHydrated}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[#f3f6fb] disabled:opacity-50"
              >
                <CaseSensitive className="h-4 w-4 text-[#2563eb]" />
                Text
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateCreate("FRAME")}
                disabled={!isHydrated}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[#f3f6fb] disabled:opacity-50"
              >
                <Frame className="h-4 w-4 text-[#475569]" />
                Frame
              </button>
              <div className="my-1 h-px bg-border/70" />
              <button
                type="button"
                onClick={() => void refreshBoardSnapshot()}
                disabled={!isHydrated}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[#f3f6fb] disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 text-[#64748b]" />
                Sync
              </button>
              <button
                type="button"
                onClick={fitBoardToViewport}
                disabled={!isHydrated}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[#f3f6fb] disabled:opacity-50"
              >
                <Hand className="h-4 w-4 text-[#64748b]" />
                Fit
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden max-w-[70%] flex-wrap gap-2 lg:flex">
            <span className="rounded-full border border-white/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-[#5f708f] shadow-sm">
              Doppelklick auf freie Fläche = neue Notiz
            </span>
            <span className="rounded-full border border-white/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-[#5f708f] shadow-sm">
              N / T / F für Werkzeuge
            </span>
            <span className="rounded-full border border-white/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-[#5f708f] shadow-sm">
              Enter bearbeitet, Entf löscht
            </span>
            <span className="rounded-full border border-white/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-[#5f708f] shadow-sm">
              Shift-Klick wählt mehrere Karten
            </span>
            <span className="rounded-full border border-white/90 bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-[#5f708f] shadow-sm">
              C verbindet zwei ausgewählte Karten
            </span>
          </div>

          {/* Mobile-only tool bar: replaces the hidden left sidebar on small
              screens. Sits at the bottom with safe-area padding so it clears
              the iOS home indicator. */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 pb-safe lg:hidden">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/90 bg-white/96 px-2 py-2 shadow-[0_16px_45px_rgba(20,20,20,0.18)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleDuplicateCreate("NOTE")}
                disabled={!isHydrated}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground transition active:bg-[#f3f6fb] disabled:opacity-50"
                aria-label="Notiz hinzufügen"
              >
                <StickyNote className="h-4 w-4 text-[#f59e0b]" />
                Note
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateCreate("TEXT")}
                disabled={!isHydrated}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground transition active:bg-[#f3f6fb] disabled:opacity-50"
                aria-label="Text hinzufügen"
              >
                <CaseSensitive className="h-4 w-4 text-[#2563eb]" />
                Text
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateCreate("FRAME")}
                disabled={!isHydrated}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground transition active:bg-[#f3f6fb] disabled:opacity-50"
                aria-label="Frame hinzufügen"
              >
                <Frame className="h-4 w-4 text-[#475569]" />
                Frame
              </button>
              <div className="mx-1 h-6 w-px bg-border/70" />
              <button
                type="button"
                onClick={fitBoardToViewport}
                disabled={!isHydrated}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground transition active:bg-[#f3f6fb] disabled:opacity-50"
                aria-label="An Ansicht anpassen"
              >
                <ScanSearch className="h-4 w-4 text-[#64748b]" />
                Fit
              </button>
            </div>
          </div>

          {selectedElements.length > 0 && selectedToolbarStyle ? (
            <div
              className="pointer-events-none absolute z-30"
              style={{
                left: selectedToolbarStyle.left,
                top: selectedToolbarStyle.top,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/90 bg-white/96 px-2 py-2 shadow-[0_16px_45px_rgba(20,20,20,0.18)] backdrop-blur-sm">
                <div className="flex items-center gap-2 rounded-full bg-[#eef3fb] px-3 py-1 text-xs font-semibold text-[#2854c5]">
                  <Layers3 className="h-3.5 w-3.5" />
                  {selectedElements.length === 1
                    ? getElementLabel(selectedElements[0]!.type)
                    : `${selectedElements.length} ausgewählt`}
                </div>
                {selectedElements.length === 1 && selectedElement ? (
                  <button
                    type="button"
                    data-board-action="true"
                    onClick={() => openEditDialog(selectedElement)}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-[#eef3fb] hover:text-foreground"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  data-board-action="true"
                  onClick={deleteCurrentSelection}
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {selectedElements.length === 2 ? (
                  <button
                    type="button"
                    data-board-action="true"
                    onClick={toggleSelectedConnection}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
                      selectedPairConnection
                        ? "bg-[#eef3ff] text-[#2854c5] hover:bg-[#dfe9ff]"
                        : "bg-[#2854c5] text-white hover:bg-[#244cb3]"
                    )}
                  >
                    <Link2 className="h-4 w-4" />
                    {selectedPairConnection ? "Verbindung lösen" : "Verbinden"}
                  </button>
                ) : null}
                <div className="mx-1 h-5 w-px bg-border" />
                {BOARD_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    data-board-action="true"
                    onClick={() => applyInlinePatchToSelection({ color: option.value })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition",
                      sharedSelectionColor === option.value
                        ? "border-[#2854c5] shadow-sm"
                        : "border-white"
                    )}
                    style={{ backgroundColor: option.value }}
                    aria-label={option.label}
                  />
                ))}
                <button
                  type="button"
                  data-board-action="true"
                  onClick={clearSelection}
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-[#f3f6fb] hover:text-foreground"
                  aria-label="Auswahl aufheben"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          <div
            ref={viewportRef}
            data-testid="board-canvas"
            className={cn(
              "touch-none-canvas relative h-[72dvh] min-h-[520px] overflow-hidden md:h-[78vh] md:min-h-[700px]",
              !isHydrated
                ? "pointer-events-none opacity-80"
                : isInteracting
                  ? "cursor-grabbing"
                  : "cursor-grab"
            )}
            onPointerDown={beginPan}
            onMouseDown={beginPan}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleCanvasWheel}
            aria-busy={!isHydrated}
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(46,91,255,0.18) 1px, transparent 0), radial-gradient(circle at top left, rgba(255,255,255,0.72), rgba(255,255,255,0))",
              backgroundPosition: `${viewport.x}px ${viewport.y}px, 0 0`,
              backgroundSize: `${GRID_SIZE * viewport.scale}px ${GRID_SIZE * viewport.scale}px, 100% 100%`,
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
                className="relative rounded-[2rem] border border-dashed border-[#c8d6ea] bg-white/35"
                style={{
                  width: CANVAS_WIDTH,
                  height: CANVAS_HEIGHT,
                }}
              >
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                  fill="none"
                >
                  <defs>
                    <marker
                      id={connectionMarkerId}
                      markerWidth="10"
                      markerHeight="10"
                      refX="8"
                      refY="5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L10,5 L0,10 z" fill="#2854C5" />
                    </marker>
                  </defs>
                  {board.connections.map((connection) => {
                    const fromElement = elementMap.get(connection.fromElementId);
                    const toElement = elementMap.get(connection.toElementId);

                    if (!fromElement || !toElement) {
                      return null;
                    }

                    const isActiveConnection =
                      selectedPairConnection?.id === connection.id;

                    return (
                      <path
                        key={connection.id}
                        d={getConnectionPath(fromElement, toElement)}
                        stroke={connection.color ?? "#2854C5"}
                        strokeWidth={isActiveConnection ? 5 : 3}
                        strokeDasharray={isActiveConnection ? undefined : "0"}
                        strokeLinecap="round"
                        markerEnd={`url(#${connectionMarkerId})`}
                        opacity={isActiveConnection ? 1 : 0.9}
                      />
                    );
                  })}
                </svg>
                {sortedElements.map((element) => {
                  const styles = getElementStyles(element);
                  const isFrame = element.type === "FRAME";
                  const isSelected = selectedElementIds.includes(element.id);

                  return (
                    <div
                      key={element.id}
                      data-testid={`board-element-${element.id}`}
                      className={cn(
                        "group absolute overflow-hidden transition-shadow hover:shadow-[0_24px_50px_rgba(20,20,20,0.12)]",
                        isFrame ? "rounded-[1.6rem]" : "rounded-[1.1rem]",
                        styles.shell,
                        isSelected &&
                          "ring-2 ring-[#2e5bff] ring-offset-4 ring-offset-transparent shadow-[0_24px_60px_rgba(46,91,255,0.22)]"
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
                          <div className="mt-4 flex-1 rounded-[1.1rem] border border-dashed border-black/10 bg-white/25" />
                        ) : null}
                      </div>

                      {isSelected ? (
                        <button
                          type="button"
                          data-board-action="true"
                          onPointerDown={(event) => beginResize(event, element)}
                          onMouseDown={(event) => beginResize(event, element)}
                          className="absolute flex items-center justify-center rounded-full border-2 border-white bg-[#2e5bff] text-white shadow-lg"
                          style={{
                            right: -RESIZE_HANDLE_SIZE / 2,
                            bottom: -RESIZE_HANDLE_SIZE / 2,
                            width: RESIZE_HANDLE_SIZE,
                            height: RESIZE_HANDLE_SIZE,
                          }}
                          aria-label="Element größer oder kleiner ziehen"
                        >
                          <Plus className="h-3 w-3 rotate-45" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
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
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${miniMapMetrics.width} ${miniMapMetrics.height}`}
                  fill="none"
                >
                  {board.connections.map((connection) => {
                    const fromElement = elementMap.get(connection.fromElementId);
                    const toElement = elementMap.get(connection.toElementId);

                    if (!fromElement || !toElement) {
                      return null;
                    }

                    return (
                      <path
                        key={connection.id}
                        d={getConnectionPath(
                          {
                            ...fromElement,
                            x: fromElement.x * miniMapMetrics.scale,
                            y: fromElement.y * miniMapMetrics.scale,
                            width: fromElement.width * miniMapMetrics.scale,
                            height: fromElement.height * miniMapMetrics.scale,
                          },
                          {
                            ...toElement,
                            x: toElement.x * miniMapMetrics.scale,
                            y: toElement.y * miniMapMetrics.scale,
                            width: toElement.width * miniMapMetrics.scale,
                            height: toElement.height * miniMapMetrics.scale,
                          }
                        )}
                        stroke={connection.color ?? "#2854C5"}
                        strokeWidth={1.5}
                        opacity={0.55}
                      />
                    );
                  })}
                </svg>
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
