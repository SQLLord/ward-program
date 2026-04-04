// src/components/MeetingItemRow.jsx
import React, { useState } from 'react';
import HymnLink from './HymnLink';
import ChildrensHymnLink from './ChildrensHymnLink'; // ← ADD
import { CHILDRENS_HYMNS, getChildrensHymnTitle } from '../data/childrensHymns';


// Returns array of variant keys for a base number e.g. '292' → ['292a','292b']
// Returns empty array if no variants, or [number] if exact match exists
function getChildrensHymnVariants(number) {
  if (!number) return [];
  const key = String(number).trim();
  if (CHILDRENS_HYMNS[key]) return [key]; // exact match — no variants needed
  // Look for 'a', 'b', 'c' variants
  const variants = ['a','b','c','d'].map(s => key + s).filter(k => CHILDRENS_HYMNS[k]);
  return variants;
}

// ── Summary line per item type ────────────────────────────────────────────────
function getMeetingSummary(item) {
  switch (item.type) {
    case 'openingHymn':
      return `🎵 Opening Hymn${item.number ? ` — #${item.number}` : ''}${item.title ? ` ${item.title}` : ''}`;
    case 'sacramentHymn':
      return `🎵 Sacrament Hymn${item.number ? ` — #${item.number}` : ''}${item.title ? ` ${item.title}` : ''}`;
    case 'closingHymn':
      return `🎵 Closing Hymn${item.number ? ` — #${item.number}` : ''}${item.title ? ` ${item.title}` : ''}`;
    case 'hymn':
      return `🎵 Hymn${item.number ? ` — #${item.number}` : ''}${item.title ? ` ${item.title}` : ''}`;
    case 'childrensHymn':
      return `🎶 Children's Song${item.number ? ` — #${item.number}` : ''}${item.title ? ` ${item.title}` : ''}`;
    case 'openingPrayer':
      return `🙏 Opening Prayer${item.name ? ` — ${item.name}` : ''}`;
    case 'closingPrayer':
      return `🙏 Closing Prayer${item.name ? ` — ${item.name}` : ''}`;
    case 'announce':
      return `📢 Announce — Announcements and Ward Business`;
    case 'sacramentAdmin':
      return `🍞 Sacrament — Blessing and Passing`;
    case 'speaker':
      return `🎤 Speaker${item.name ? ` — ${item.name}` : ''}${item.topic ? ` | ${item.topic}` : ''}`;
    case 'musical':
      return `🎼 Musical${item.performers ? ` — ${item.performers}` : ''}${item.piece ? ` | ${item.piece}` : ''}`;
    case 'baptism':
      return `💧 Baptism${item.personName ? ` — ${item.personName}` : ''}`;
    case 'confirmation':
      return `🕊️ Confirmation${item.personName ? ` — ${item.personName}` : ''}`;
    case 'customText':
      return item.text?.trim()
        ? `📝 Custom — "${item.text.trim().substring(0, 40)}${item.text.trim().length > 40 ? '…' : ''}"`
        : `📝 Custom — (spacing)`;
    default:
      return `📋 ${item.type}`;
  }
}

// ── Static types — no editable fields, never need expanding ──────────────────
const STATIC_TYPES = ['announce', 'sacramentAdmin'];


export function MeetingItemRow({ item, updateMeetingItem, removeMeetingItem, isNew }) {
  const [expanded, setExpanded] = useState(isNew ?? false);
  const isStatic = STATIC_TYPES.includes(item.type);
  const deleteCls = 'btn-danger w-8 h-8 p-0 min-w-[2rem] flex items-center justify-center text-xs';

  return (
    <div className="w-full">

      {/* ── Collapsed header — always visible ─────────────────────────── */}
      
        <div
          className={`flex items-center justify-between gap-2 px-2 py-1.5 transition
            ${!isStatic ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600/50 rounded-t-lg' : ''}
          `}
          onClick={() => { if (!isStatic) setExpanded(e => !e); }}
        >

        <span className="text-xs text-gray-600 dark:text-slate-300 truncate flex-1 min-w-0">
          {getMeetingSummary(item)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {/* Expand toggle — only for non-static types */}
          {!isStatic && (
            
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setExpanded(e => !e); }}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-600 dark:text-slate-300 transition shrink-0"
              title={expanded ? 'Collapse' : 'Expand to edit'}
            >
              {expanded ? '▲ Less' : '▼ Edit'}
            </button>

          )}
          
            <button
              onClick={e => { e.stopPropagation(); removeMeetingItem(item.id); }}
              className={deleteCls}
              title="Delete"
            >🗑️</button>

        </div>
      </div>

      {/* ── Expanded editor — shown only when expanded ─────────────────── */}
      {expanded && !isStatic && (
        <div className="px-2 pb-2 border-t border-slate-600/50 pt-2">

          {/* HYMN TYPES */}
          {['openingHymn', 'sacramentHymn', 'closingHymn', 'hymn'].includes(item.type) && (
            <div className="grid grid-cols-12 gap-1 items-center">
              <input
                value={item.number ?? ''}
                onChange={e => updateMeetingItem(item.id, 'number', e.target.value.trim())}
                className="input col-span-2 text-center px-2 text-xs"
                placeholder="#"
                maxLength={10}
              />
              <span className="col-span-7 text-xs text-slate-400 truncate">
                {item.title ?? 'Title auto-fills from hymn number'}
              </span>
              {item.number && item.title
                ? <div className="col-span-2"><HymnLink number={item.number} title={item.title} /></div>
                : <div className="col-span-2" />
              }
            </div>
          )}

          
          {/* ── CHILDREN'S HYMN TYPE ─────────────────────────────────── */}
          {item.type === 'childrensHymn' && (() => {
            const variants = getChildrensHymnVariants(item.number);
            const hasVariants = variants.length > 1;
            return (
              <div className="flex flex-col gap-1.5">
                {/* Number input row */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.number ?? ''}
                    onChange={e => updateMeetingItem(item.id, 'number', e.target.value.trim())}
                    className="input col-span-2 text-center px-2 text-xs"
                    placeholder="#"
                    maxLength={10}
                  />
                  <span className="col-span-7 text-xs text-gray-500 dark:text-slate-400 truncate">
                    {item.title ?? "Title auto-fills from children's song number"}
                  </span>
                  <div className="col-span-3 flex justify-end">
                    {item.number && item.title
                      ? <ChildrensHymnLink number={item.number} title={item.title} />
                      : <span className="text-xs text-gray-400">Enter # to get link</span>
                    }
                  </div>
                </div>

                {/* Variant picker — only shown when multiple versions exist */}
                {hasVariants && (
                  <div className="flex flex-col gap-1 pl-1">
                    <span className="text-xs text-amber-500 font-semibold">
                      ⚠️ Multiple versions for #{String(item.number ?? '').replace(/[abcd]$/, '')} — pick one:
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {variants.map(vk => (
                        <button
                          key={vk}
                          type="button"
                          onClick={() => {
                            updateMeetingItem(item.id, 'number', vk);
                            updateMeetingItem(item.id, 'title', CHILDRENS_HYMNS[vk].title);
                          }}
                          className={`text-xs px-2 py-1 rounded border transition ${
                            item.number === vk
                              ? 'bg-lds-blue text-white border-lds-blue'
                              : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-700 dark:text-slate-300 hover:border-lds-blue'
                          }`}
                        >
                          {vk} — {CHILDRENS_HYMNS[vk].title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          {/* PRAYER TYPES */}
          {['openingPrayer', 'closingPrayer'].includes(item.type) && (
            <input
              value={item.name ?? ''}
              onChange={e => updateMeetingItem(item.id, 'name', e.target.value)}
              className="input w-full text-xs"
              placeholder="Name"
              maxLength={150}
            />
          )}

          {/* SPEAKER */}
          {item.type === 'speaker' && (
            <div className="grid grid-cols-2 gap-1">
              <input
                value={item.name ?? ''}
                onChange={e => updateMeetingItem(item.id, 'name', e.target.value)}
                className="input text-xs"
                placeholder="Name"
                maxLength={150}
              />
              <input
                value={item.topic ?? ''}
                onChange={e => updateMeetingItem(item.id, 'topic', e.target.value)}
                className="input text-xs"
                placeholder="Topic"
                maxLength={500}
              />
            </div>
          )}

          {/* MUSICAL */}
          {item.type === 'musical' && (
            <div className="grid grid-cols-2 gap-1">
              <input
                value={item.performers ?? ''}
                onChange={e => updateMeetingItem(item.id, 'performers', e.target.value)}
                className="input text-xs"
                placeholder="Performers"
                maxLength={255}
              />
              <input
                value={item.piece ?? ''}
                onChange={e => updateMeetingItem(item.id, 'piece', e.target.value)}
                className="input text-xs"
                placeholder="Piece"
                maxLength={255}
              />
            </div>
          )}

          {/* BAPTISM */}
          {item.type === 'baptism' && (
            <div className="flex flex-col gap-1">
              <input
                value={item.personName ?? ''}
                onChange={e => updateMeetingItem(item.id, 'personName', e.target.value)}
                className="input w-full text-xs"
                placeholder="Person's name"
                maxLength={150}
              />
              <input
                value={item.performedBy ?? ''}
                onChange={e => updateMeetingItem(item.id, 'performedBy', e.target.value)}
                className="input w-full text-xs"
                placeholder="Performed by"
                maxLength={150}
              />
              <div className="grid grid-cols-2 gap-1">
                <input
                  value={item.witness1 ?? ''}
                  onChange={e => updateMeetingItem(item.id, 'witness1', e.target.value)}
                  className="input text-xs"
                  placeholder="Witness 1"
                  maxLength={150}
                />
                <input
                  value={item.witness2 ?? ''}
                  onChange={e => updateMeetingItem(item.id, 'witness2', e.target.value)}
                  className="input text-xs"
                  placeholder="Witness 2"
                  maxLength={150}
                />
              </div>
            </div>
          )}

          {/* CONFIRMATION */}
          {item.type === 'confirmation' && (
            <div className="flex flex-col gap-1">
              <input
                value={item.personName ?? ''}
                onChange={e => updateMeetingItem(item.id, 'personName', e.target.value)}
                className="input w-full text-xs"
                placeholder="Person's name"
                maxLength={150}
              />
              <input
                value={item.performedBy ?? ''}
                onChange={e => updateMeetingItem(item.id, 'performedBy', e.target.value)}
                className="input w-full text-xs"
                placeholder="Performed by"
                maxLength={150}
              />
            </div>
          )}

          {/* CUSTOM TEXT */}
          {item.type === 'customText' && (
            <div>
              <textarea
                value={item.text ?? ''}
                onChange={e => updateMeetingItem(item.id, 'text', e.target.value)}
                className="input w-full text-xs"
                placeholder="Type anything… leave blank to insert spacing"
                rows={2}
                maxLength={500}
              />
              {!item.text?.trim() && (
                <p className="text-xs text-amber-500 mt-0.5">
                  📐 Blank — will reserve 2 lines of space in PDF
                </p>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}