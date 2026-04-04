// src/components/DraggableList.jsx
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// ── SortableItem ──────────────────────────────────────────────────────────────
function SortableItem({ id, index, total, onMoveUp, onMoveDown, children }) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex rounded-lg border mb-2 overflow-hidden transition
        bg-white dark:bg-slate-700
        border-gray-200 dark:border-slate-600
        hover:border-lds-blue/50 dark:hover:border-blue-400
        ${isDragging ? 'shadow-lg' : ''}
      `}
    >
      {/* ── Left strip: drag handle + arrow buttons ─────────────────── */}
      <div className="flex flex-col items-center
        bg-gray-100 dark:bg-slate-600
        border-r border-gray-200 dark:border-slate-500
        rounded-l-lg w-8 shrink-0"
      >
        {/* ▲ Up */}
        <button
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          type="button"
          title="Move up"
          className="w-full flex items-center justify-center py-2
            hover:bg-blue-100 dark:hover:bg-slate-500
            disabled:opacity-20 disabled:cursor-not-allowed transition
            text-gray-400 dark:text-slate-300 text-sm leading-none"
        >▲</button>

        {/* Drag handle */}
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing px-1 py-2
            text-gray-400 dark:text-slate-400
            hover:text-blue-500 dark:hover:text-blue-400
            text-base leading-none select-none"
          title="Drag to reorder"
        >⠿</div>

        {/* ▼ Down */}
        <button
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          type="button"
          title="Move down"
          className="w-full flex items-center justify-center py-2
            hover:bg-blue-100 dark:hover:bg-slate-500
            disabled:opacity-20 disabled:cursor-not-allowed transition
            text-gray-400 dark:text-slate-300 text-sm leading-none"
        >▼</button>
      </div>

      {/* ── Card content ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

// ── DraggableList ─────────────────────────────────────────────────────────────
export default function DraggableList({ items, onReorder, renderItem, newItemId }) {
  // ↑ newItemId — ID of the most recently added item, passed from parent

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    onReorder(arrayMove(items, index, index - 1));
  };

  const handleMoveDown = (index) => {
    if (index === items.length - 1) return;
    onReorder(arrayMove(items, index, index + 1));
  };

  if (!items || items.length === 0) {
    return <div className="text-slate-400 text-sm py-2">No items</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
      autoScroll={{
        enabled: true,
        threshold: { x: 0, y: 0.15 },
        acceleration: 12,
        interval: 5,
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              id={item.id}
              index={index}
              total={items.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            >
              {/* Pass isNew down so row components can auto-expand */}
              {renderItem(item, index, item.id === newItemId)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}