import { useCallback, useRef, useState } from "react";

/**
 * Перетаскивание для переупорядочивания списка на pointer-событиях
 * (pointerdown / pointermove / pointerup).
 *
 * Почему не нативный HTML5 drag-and-drop:
 *  - нативный DnD капризен и по-разному ведёт себя в разных браузерах
 *    (Firefox требует setData, Safari игнорирует часть событий, dragover
 *     читает stale state из-за асинхронного рендера React);
 *  - pointer-события работают одинаково во всех браузерах и на тач-устройствах.
 *
 * Цель под курсором определяется через document.elementFromPoint + closest(),
 * поэтому состояние React не участвует в логике — никаких stale-замыканий.
 *
 * @param {object}   opts
 * @param {string}   opts.itemSelector  CSS-селектор элемента списка (напр. ".funnel__row")
 * @param {string}   opts.idAttr        data-атрибут с id элемента (напр. "data-funnel-id")
 * @param {(dragId: string, targetId: string) => void} opts.onReorder
 * @param {number}   [opts.threshold=4] порог в px, после которого начинается drag
 * @returns {{ dragId: string|null, overId: string|null,
 *            onHandlePointerDown: (e: PointerEvent, id: string) => void }}
 */
export function usePointerReorder({
  itemSelector,
  idAttr,
  onReorder,
  threshold = 4,
}) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const stateRef = useRef(null);

  const onHandlePointerDown = useCallback(
    (e, id) => {
      // только основная кнопка мыши / одиночный тач
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      stateRef.current = {
        dragId: String(id),
        overId: String(id),
        startX: e.clientX,
        startY: e.clientY,
        active: false,
      };

      const onMove = (ev) => {
        const st = stateRef.current;
        if (!st) return;

        if (!st.active) {
          const dx = Math.abs(ev.clientX - st.startX);
          const dy = Math.abs(ev.clientY - st.startY);
          if (dx < threshold && dy < threshold) return;
          st.active = true;
          setDragId(st.dragId);
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }

        ev.preventDefault();
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const target = el?.closest?.(itemSelector);
        const nextOver = target?.getAttribute(idAttr) || null;
        if (nextOver !== st.overId) {
          st.overId = nextOver;
          setOverId(nextOver);
        }
      };

      const finish = () => {
        const st = stateRef.current;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        stateRef.current = null;
        setDragId(null);
        setOverId(null);
        if (st?.active && st.dragId && st.overId && st.dragId !== st.overId) {
          onReorder(st.dragId, st.overId);
        }
      };

      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", finish);
    },
    [itemSelector, idAttr, onReorder, threshold]
  );

  return { dragId, overId, onHandlePointerDown };
}
