import { Download } from 'lucide-react';
import { PRESETS } from '../data/googleFontsCatalog';
import { PresetDefinition } from '../types/editor';

interface TopBarProps {
  activePresetId: string | null;
  onSelectPreset: (preset: PresetDefinition) => void;
  onOpenExport: () => void;
}

export function TopBar({
  activePresetId,
  onSelectPreset,
  onOpenExport,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 border-b border-[#251E23] bg-black px-5 flex items-center justify-between gap-8">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[#FAD6EA] text-xs select-none" aria-hidden="true">✦</span>
        <span className="font-pixel text-base sm:text-lg tracking-normal text-white whitespace-nowrap shrink-0">
          pixel<span className="text-[#FAD6EA]">type</span>
        </span>
      </div>

      <nav
        aria-label="Estilos iniciais"
        className="hidden md:flex items-center gap-6 overflow-x-auto"
      >
        {PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD6EA] rounded-sm ${
                isActive
                  ? 'text-[#FAD6EA]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {preset.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#FAD6EA]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-[#FAD6EA] hover:bg-[#FDE4F2] active:bg-[#F5BDD9] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD6EA]"
        >
          <Download className="w-4 h-4" />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
}
