import React, { useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Globe,
  Italic,
  Link2,
  Loader2,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { GOOGLE_FONTS_CATALOG } from '../data/googleFontsCatalog';
import { EditorState, FontCategory, FontItem, TextAlign } from '../types/editor';
import {
  loadExternalFontUrl,
  loadGoogleFont,
  loadLocalFontFile,
} from '../utils/fontLoader';

interface TypographyPanelProps {
  state: EditorState;
  customFonts: FontItem[];
  onChange: (patch: Partial<EditorState>) => void;
  onAddCustomFont: (font: FontItem) => void;
  onFontReady: () => void;
}

const CATEGORIES: FontCategory[] = [
  'Todas',
  'Caligrafia',
  'Serifa',
  'Gótica',
  'Display',
  'Sem Serifa',
  'Monoespaçada',
];

export function TypographyPanel({
  state,
  customFonts,
  onChange,
  onAddCustomFont,
  onFontReady,
}: TypographyPanelProps) {
  const [sourceTab, setSourceTab] = useState<'google' | 'local' | 'url'>('google');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FontCategory>('Todas');
  const [loadingFamily, setLoadingFamily] = useState<string | null>(null);
  const [fontError, setFontError] = useState<string | null>(null);

  // External URL form
  const [externalUrl, setExternalUrl] = useState('');
  const [externalFamilyName, setExternalFamilyName] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  // Local upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const filteredGoogleFonts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GOOGLE_FONTS_CATALOG.filter((f) => {
      const catMatch = selectedCategory === 'Todas' || f.category === selectedCategory;
      const textMatch = !q || f.family.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [searchQuery, selectedCategory]);

  const exactCatalogMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return GOOGLE_FONTS_CATALOG.some((f) => f.family.toLowerCase() === q);
  }, [searchQuery]);

  const activeFontMeta = useMemo(() => {
    return (
      customFonts.find((f) => f.family === state.fontFamily) ||
      GOOGLE_FONTS_CATALOG.find((f) => f.family === state.fontFamily)
    );
  }, [customFonts, state.fontFamily]);

  const handleSelectGoogleFont = async (font: FontItem) => {
    setFontError(null);
    setLoadingFamily(font.family);
    const weights = font.weights || [400];
    const nextWeight = weights.includes(state.fontWeight)
      ? state.fontWeight
      : weights[0];
    const nextItalic = font.hasItalic ? state.fontItalic : false;

    const ok = await loadGoogleFont(
      font.family,
      font.weights,
      font.hasItalic,
      nextWeight,
      nextItalic
    );
    setLoadingFamily(null);
    if (!ok) {
      setFontError(`Não foi possível carregar "${font.family}" do Google Fonts.`);
      return;
    }
    onChange({
      fontFamily: font.family,
      fontSource: 'google',
      fontWeight: nextWeight,
      fontItalic: nextItalic,
    });
    onFontReady();
  };

  const handleLoadArbitraryGoogleFont = async () => {
    const name = searchQuery.trim();
    if (!name) return;
    setFontError(null);
    setLoadingFamily(name);
    const ok = await loadGoogleFont(name, undefined, undefined, 400, false);
    setLoadingFamily(null);
    if (!ok) {
      setFontError(
        `Fonte "${name}" não encontrada no Google Fonts. Verifique a grafia exata.`
      );
      return;
    }
    const newItem: FontItem = {
      family: name,
      category: 'Display',
      source: 'google',
      weights: [400, 700],
      hasItalic: true,
    };
    onAddCustomFont(newItem);
    onChange({
      fontFamily: name,
      fontSource: 'google',
      fontWeight: 400,
      fontItalic: false,
    });
    onFontReady();
  };

  const handleFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFontError(null);
    for (const file of Array.from(files)) {
      try {
        const font = await loadLocalFontFile(file);
        onAddCustomFont(font);
        onChange({
          fontFamily: font.family,
          fontSource: 'local',
          fontWeight: 400,
          fontItalic: false,
        });
        onFontReady();
      } catch {
        setFontError(`Erro ao ler o arquivo "${file.name}". Use .ttf, .otf, .woff ou .woff2.`);
      }
    }
  };

  const handleImportExternalUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalUrl.trim()) return;
    setFontError(null);
    setIsImportingUrl(true);
    try {
      const imported = await loadExternalFontUrl(externalUrl, externalFamilyName);
      for (const f of imported) {
        onAddCustomFont(f);
      }
      if (imported[0]) {
        onChange({
          fontFamily: imported[0].family,
          fontSource: 'external-url',
          fontWeight: 400,
          fontItalic: false,
        });
        onFontReady();
      }
      setExternalUrl('');
      setExternalFamilyName('');
    } catch (err) {
      setFontError(
        err instanceof Error ? err.message : 'Falha ao importar URL da fonte.'
      );
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handleWeightOrItalicChange = async (weight: number, italic: boolean) => {
    if (state.fontSource === 'google') {
      setLoadingFamily(state.fontFamily);
      await loadGoogleFont(
        state.fontFamily,
        activeFontMeta?.weights,
        activeFontMeta?.hasItalic,
        weight,
        italic
      );
      setLoadingFamily(null);
    }
    onChange({ fontWeight: weight, fontItalic: italic });
    onFontReady();
  };

  const availableWeights = activeFontMeta?.weights || [400, 700];

  return (
    <aside className="w-full lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#251E23] bg-[#09090B] flex flex-col overflow-hidden">
      <div className="p-4 space-y-5 overflow-y-auto studio-scroll flex-1">
        {/* Text Input */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="text-editor-input"
              className="text-xs font-semibold text-neutral-200"
            >
              Texto
            </label>
            <span className="text-[11px] font-mono-tabular text-neutral-500">
              {state.text.length} chars
            </span>
          </div>
          <textarea
            id="text-editor-input"
            rows={2}
            value={state.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Digite sua tipografia..."
            className="w-full rounded-md bg-black border border-[#26262C] px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FAD6EA] resize-y min-h-[62px]"
          />
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Font Source Selector */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-200">
              Biblioteca de Fontes
            </h2>
            <span className="text-[11px] text-[#FAD6EA] truncate max-w-[140px]">
              {state.fontFamily}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-black border border-[#222228]">
            <button
              type="button"
              onClick={() => setSourceTab('google')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                sourceTab === 'google'
                  ? 'bg-[#1D1D22] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('local')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                sourceTab === 'local'
                  ? 'bg-[#1D1D22] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Arquivo</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('url')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                sourceTab === 'url'
                  ? 'bg-[#1D1D22] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>URL</span>
            </button>
          </div>

          {fontError && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-2.5 py-2">
              {fontError}
            </p>
          )}

          {/* Google Fonts Tab */}
          {sourceTab === 'google' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !exactCatalogMatch) {
                      handleLoadArbitraryGoogleFont();
                    }
                  }}
                  placeholder="Buscar ou digitar fonte do Google..."
                  className="w-full rounded-md bg-black border border-[#26262C] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FAD6EA]"
                />
              </div>

              {!exactCatalogMatch && searchQuery.trim().length > 1 && (
                <button
                  type="button"
                  onClick={handleLoadArbitraryGoogleFont}
                  disabled={loadingFamily !== null}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-[#FAD6EA] bg-[#FAD6EA]/10 hover:bg-[#FAD6EA]/20 border border-[#FAD6EA]/40 rounded-md transition-colors cursor-pointer"
                >
                  {loadingFamily === searchQuery.trim() ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">
                    Carregar &ldquo;{searchQuery.trim()}&rdquo; do Google Fonts
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1 overflow-x-auto pb-1 studio-scroll">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#FAD6EA] text-black font-semibold'
                        : 'bg-[#121216] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="max-h-[210px] overflow-y-auto studio-scroll border border-[#222228] rounded-md bg-black divide-y divide-[#18181D]">
                {filteredGoogleFonts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-neutral-500">
                    Nenhuma fonte na lista local. Pressione Enter para buscar direto no Google Fonts.
                  </div>
                ) : (
                  filteredGoogleFonts.map((font) => {
                    const isSelected = state.fontFamily === font.family;
                    const isLoading = loadingFamily === font.family;
                    return (
                      <button
                        key={font.family}
                        type="button"
                        onClick={() => handleSelectGoogleFont(font)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FAD6EA]/12 text-white'
                            : 'text-neutral-300 hover:bg-[#121216]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-medium truncate">
                            {font.family}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {font.category}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FAD6EA]" />
                          ) : isSelected ? (
                            <Check className="w-3.5 h-3.5 text-[#FAD6EA]" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Local Font File Tab */}
          {sourceTab === 'local' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#FAD6EA] bg-[#FAD6EA]/10'
                    : 'border-[#2E2E36] bg-black hover:border-[#FAD6EA]/60'
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-[#FAD6EA]" />
                <p className="text-xs font-medium text-white">
                  Clique ou arraste sua fonte
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Suporta .TTF, .OTF, .WOFF e .WOFF2
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesUpload(e.target.files)}
                />
              </div>

              {customFonts.filter((f) => f.source === 'local').length > 0 && (
                <div className="border border-[#222228] rounded-md bg-black divide-y divide-[#18181D]">
                  {customFonts
                    .filter((f) => f.source === 'local')
                    .map((font) => (
                      <button
                        key={font.family}
                        type="button"
                        onClick={() => {
                          onChange({
                            fontFamily: font.family,
                            fontSource: 'local',
                          });
                          onFontReady();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs cursor-pointer ${
                          state.fontFamily === font.family
                            ? 'bg-[#FAD6EA]/12 text-white'
                            : 'text-neutral-300 hover:bg-[#121216]'
                        }`}
                      >
                        <span className="truncate">{font.family}</span>
                        {state.fontFamily === font.family && (
                          <Check className="w-3.5 h-3.5 text-[#FAD6EA] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* External Font URL Tab */}
          {sourceTab === 'url' && (
            <form onSubmit={handleImportExternalUrl} className="space-y-2.5">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">
                  URL do CSS ou arquivo (.woff2, .ttf, Fontshare, CDN)
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  className="w-full rounded-md bg-black border border-[#26262C] px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FAD6EA]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">
                  Nome da Família (opcional para CSS)
                </label>
                <input
                  type="text"
                  value={externalFamilyName}
                  onChange={(e) => setExternalFamilyName(e.target.value)}
                  placeholder="Ex: Clash Display"
                  className="w-full rounded-md bg-black border border-[#26262C] px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FAD6EA]"
                />
              </div>
              <button
                type="submit"
                disabled={isImportingUrl || !externalUrl.trim()}
                className="w-full py-1.5 px-3 rounded-md bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isImportingUrl ? 'Importando...' : 'Importar Fonte Externa'}
              </button>

              {customFonts.filter((f) => f.source !== 'local').length > 0 && (
                <div className="border border-[#222228] rounded-md bg-black divide-y divide-[#18181D]">
                  {customFonts
                    .filter((f) => f.source !== 'local')
                    .map((font) => (
                      <button
                        key={font.family}
                        type="button"
                        onClick={() => {
                          onChange({
                            fontFamily: font.family,
                            fontSource: font.source,
                          });
                          onFontReady();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs cursor-pointer ${
                          state.fontFamily === font.family
                            ? 'bg-[#FAD6EA]/12 text-white'
                            : 'text-neutral-300 hover:bg-[#121216]'
                        }`}
                      >
                        <span className="truncate">{font.family}</span>
                        {state.fontFamily === font.family && (
                          <Check className="w-3.5 h-3.5 text-[#FAD6EA] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              )}
            </form>
          )}
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Typographic Geometry */}
        <section className="space-y-3.5">
          <h2 className="text-xs font-semibold text-neutral-200">
            Ajustes Tipográficos
          </h2>

          {/* Weight & Italic */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-neutral-400 mb-1">
                Peso
              </label>
              <select
                value={state.fontWeight}
                onChange={(e) =>
                  handleWeightOrItalicChange(
                    Number(e.target.value),
                    state.fontItalic
                  )
                }
                className="w-full rounded-md bg-black border border-[#26262C] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FAD6EA]"
              >
                {availableWeights.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() =>
                  handleWeightOrItalicChange(state.fontWeight, !state.fontItalic)
                }
                title="Alternar itálico"
                className={`h-[30px] px-2.5 rounded-md border flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  state.fontItalic
                    ? 'bg-[#FAD6EA] border-[#FAD6EA] text-black font-semibold'
                    : 'bg-black border-[#26262C] text-neutral-300 hover:text-white'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                <span>Itálico</span>
              </button>
            </div>
          </div>

          {/* Alignment */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Alinhamento</span>
            <div className="flex items-center gap-1 bg-black border border-[#222228] rounded-md p-0.5">
              {(
                [
                  { id: 'left', icon: AlignLeft },
                  { id: 'center', icon: AlignCenter },
                  { id: 'right', icon: AlignRight },
                ] as { id: TextAlign; icon: typeof AlignLeft }[]
              ).map((item) => {
                const Icon = item.icon;
                const active = state.textAlign === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange({ textAlign: item.id })}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#222228] text-[#FAD6EA]'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Tamanho da Fonte</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.fontSize} px
              </span>
            </div>
            <input
              type="range"
              min={32}
              max={280}
              step={2}
              value={state.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Letter Spacing */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Espaçamento (Tracking)</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.letterSpacing > 0 ? `+${state.letterSpacing}` : state.letterSpacing} px
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={40}
              step={0.5}
              value={state.letterSpacing}
              onChange={(e) =>
                onChange({ letterSpacing: Number(e.target.value) })
              }
              className="w-full studio-slider"
            />
          </div>

          {/* Line Height */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Entrelinha</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.lineHeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.75}
              max={2.0}
              step={0.05}
              value={state.lineHeight}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Pre-Stroke / Hairline Preservation */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Espessura Pré-Pixel</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.preStroke > 0 ? `+${state.preStroke.toFixed(1)}` : state.preStroke.toFixed(1)} px
              </span>
            </div>
            <input
              type="range"
              min={-1.5}
              max={3.5}
              step={0.1}
              value={state.preStroke}
              onChange={(e) => onChange({ preStroke: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Padding */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Margem da Grade</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.padding} cél.
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={32}
              step={1}
              value={state.padding}
              onChange={(e) => onChange({ padding: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
