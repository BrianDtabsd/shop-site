import React, { useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { CONTROL_GROUPS, controlsInGroup, appliesToSurface } from '../theme/controls';

/**
 * Studio "Look" tab.
 *
 * One continuous panel: gallery → surface/mode → grouped controls → footer.
 * Controls are rendered from the registry in theme/controls.js rather than
 * hand-written per setting, so every control gets modified-state and reset for
 * free, and adding a setting is a registry entry.
 *
 * Controls that do not apply to the active surface render DISABLED with their
 * reason — never removed. A panel that changes shape when you flip a switch is
 * what made the old editor feel like separate templates.
 */

function Label({ children }) {
  return (
    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </span>
  );
}

function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className={`flex bg-slate-800 rounded-lg p-1 ${disabled ? 'opacity-40' : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-2 rounded-md transition-colors text-sm ${
            value === opt.value
              ? 'bg-blue-500 text-white'
              : disabled
                ? 'cursor-not-allowed'
                : 'hover:bg-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ options, value, onChange, disabled, allowCustom }) {
  return (
    <div className={disabled ? 'opacity-40' : ''}>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`w-8 h-8 rounded-full border-2 transition-transform ${
              value === opt.value
                ? 'border-white scale-110'
                : 'border-transparent hover:scale-105'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
            style={{ backgroundColor: opt.value }}
          />
        ))}
        {allowCustom ? (
          <label
            className={`w-8 h-8 rounded-full border-2 border-dashed border-slate-600 grid place-items-center ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-slate-400'
            }`}
            title="Custom color"
          >
            <input
              type="color"
              disabled={disabled}
              value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <span className="text-[13px] leading-none text-slate-400">+</span>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function ControlRow({ control, surface, value, modified, onChange, onReset }) {
  const applicable = appliesToSurface(control, surface);
  const disabled = !applicable;

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Label>{control.label}</Label>
        <div className="flex items-center gap-2">
          {control.type === 'range' && control.format && applicable ? (
            <span className="text-[11px] text-slate-300">{control.format(Number(value))}</span>
          ) : null}
          {modified && applicable ? (
            <button
              type="button"
              onClick={onReset}
              title="Reset to preset value"
              className="text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
            >
              modified ✕
            </button>
          ) : null}
        </div>
      </div>

      {control.type === 'segmented' ? (
        <Segmented
          options={control.options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      ) : null}

      {control.type === 'swatch' ? (
        <Swatches
          options={control.options}
          value={value}
          onChange={onChange}
          disabled={disabled}
          allowCustom={control.allowCustom}
        />
      ) : null}

      {control.type === 'range' ? (
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(value)}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-blue-500 disabled:cursor-not-allowed"
        />
      ) : null}

      {control.type === 'text' ? (
        <input
          type="text"
          value={value || ''}
          disabled={disabled}
          placeholder={control.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed"
        />
      ) : null}

      {control.type === 'color' ? (
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#888888'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded bg-slate-800 border border-slate-700 disabled:cursor-not-allowed"
        />
      ) : null}

      {control.type === 'toggle' ? (
        <label
          className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input
            type="checkbox"
            checked={value !== false}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-[11px] text-slate-300">Enabled</span>
        </label>
      ) : null}

      {disabled ? (
        <p className="mt-1 text-[10px] text-amber-300/70 leading-snug">{control.reason}</p>
      ) : control.help ? (
        <p className="mt-1 text-[10px] text-slate-500 leading-snug">{control.help}</p>
      ) : null}
    </div>
  );
}

function LookCard({ title, subtitle, swatches, fontFamily, active, onSelect, onDelete }) {
  return (
    <div
      className={`relative rounded-lg border transition-colors ${
        active ? 'border-blue-400/60 bg-blue-500/15' : 'border-white/10 bg-slate-900/40'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-lg"
      >
        <span className="text-sm font-semibold text-white block truncate" style={{ fontFamily }}>
          {title}
        </span>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug line-clamp-2">{subtitle}</p>
        ) : null}
        <div className="mt-2 flex gap-1.5">
          {swatches.map((hex, i) => (
            <span
              key={`${hex}-${i}`}
              className="h-3.5 w-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          title="Delete this saved look"
          className="absolute top-1.5 right-1.5 text-[10px] text-slate-500 hover:text-rose-300 px-1"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

export default function LookEditor() {
  const {
    look,
    values,
    meta,
    modified,
    isModified,
    setOverride,
    resetControl,
    resetOverrides,
    applyPreset,
    setSurface,
    setMode,
    savedLooks,
    saveCurrentAsLook,
    applySavedLook,
    deleteSavedLook,
    exportLook,
    importLook,
    resetTheme,
    foundationPresetList,
  } = useTheme();

  const [saveName, setSaveName] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

  const surface = meta.surface;
  const mode = meta.mode;

  const handleExport = () => {
    const blob = exportLook(meta.presetName);
    navigator.clipboard?.writeText(blob).catch(() => {});
    setImportError('');
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importLook(String(reader.result));
      setImportError(result.ok ? '' : result.error);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* ── Gallery: built-ins and your saved looks, one list ── */}
      <div>
        <Label>Look</Label>
        <div className="mt-2 space-y-2">
          {foundationPresetList.map((preset) => {
            const preview = preset[mode];
            return (
              <LookCard
                key={preset.id}
                title={preset.name}
                subtitle={preset.blurb}
                fontFamily={preset.fonts.display}
                swatches={[preview.canvas, preview.surface, preview.ink, preview.accent]}
                active={look.presetId === preset.id}
                onSelect={() => applyPreset(preset.id)}
              />
            );
          })}
        </div>

        {savedLooks.length ? (
          <>
            <p className="mt-4 mb-2 text-[10px] uppercase tracking-wider text-slate-500">
              Your looks
            </p>
            <div className="space-y-2">
              {savedLooks.map((entry) => {
                const preset = foundationPresetList.find((p) => p.id === entry.presetId);
                const preview = preset ? preset[entry.mode] : null;
                return (
                  <LookCard
                    key={entry.id}
                    title={entry.name}
                    subtitle={`Based on ${preset?.name || entry.presetId} · ${entry.surface} · ${entry.mode}`}
                    fontFamily={preset?.fonts.display}
                    swatches={
                      preview
                        ? [
                            entry.overrides.pageColor || preview.canvas,
                            preview.surface,
                            preview.ink,
                            entry.overrides.accent || preview.accent,
                          ]
                        : []
                    }
                    active={false}
                    onSelect={() => applySavedLook(entry.id)}
                    onDelete={() => deleteSavedLook(entry.id)}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* ── Surface / Mode: they re-skin every preview above ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Surface</Label>
          <div className="mt-1.5">
            <Segmented
              options={[
                { label: 'Glass', value: 'glass' },
                { label: 'Foundation', value: 'foundation' },
              ]}
              value={surface}
              onChange={setSurface}
            />
          </div>
        </div>
        <div>
          <Label>Mode</Label>
          <div className="mt-1.5">
            <Segmented
              options={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </div>
      </div>
      <p className="-mt-3 text-[10px] text-slate-500 leading-relaxed">
        Both surfaces share the same themes. Glass adds translucent panels; Foundation is
        matte editorial paper.
      </p>

      {/* ── Customize: every group, always present ── */}
      {CONTROL_GROUPS.map((group) => {
        const controls = controlsInGroup(group.id);
        if (!controls.length) return null;
        return (
          <div key={group.id}>
            <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 border-b border-white/5 pb-1.5">
              {group.label}
            </p>
            <div className="space-y-4">
              {controls.map((control) => (
                <ControlRow
                  key={control.id}
                  control={control}
                  surface={surface}
                  value={values[control.id]}
                  modified={isModified(control.id)}
                  onChange={(v) => setOverride(control.id, v)}
                  onReset={() => resetControl(control.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Footer ── */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {modified.length
              ? `${modified.length} change${modified.length === 1 ? '' : 's'} from ${meta.presetName}`
              : `Matching ${meta.presetName}`}
          </span>
          {modified.length ? (
            <button
              type="button"
              onClick={resetOverrides}
              className="text-[10px] uppercase tracking-wider rounded px-2 py-1 bg-white/5 text-slate-200 hover:bg-white/10"
            >
              Reset all
            </button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this look"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            disabled={!saveName.trim()}
            onClick={() => {
              if (saveCurrentAsLook(saveName)) setSaveName('');
            }}
            className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-400"
          >
            Save
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            title="Copy this look's JSON to the clipboard"
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-200 hover:bg-white/10"
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-200 hover:bg-white/10"
          >
            Import…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
        {importError ? (
          <p className="text-[10px] text-rose-300">{importError}</p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset Look to defaults?')) resetTheme();
          }}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-200 hover:bg-white/10"
        >
          Restore look defaults
        </button>
      </div>
    </div>
  );
}
