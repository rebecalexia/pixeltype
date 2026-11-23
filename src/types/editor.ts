export type FontCategory =
  | 'Todas'
  | 'Caligrafia'
  | 'Serifa'
  | 'Display'
  | 'Sem Serifa'
  | 'Gótica'
  | 'Monoespaçada';

export type FontSource = 'google' | 'local' | 'external-url';

export interface FontItem {
  family: string;
  category: Exclude<FontCategory, 'Todas'>;
  source: FontSource;
  weights?: number[];
  hasItalic?: boolean;
  url?: string;
}

export type QuantizationMode = 'threshold' | 'levels' | 'bayer4' | 'floyd';

export type PixelShape = 'square' | 'rounded' | 'led' | 'diamond';

export type FillMode = 'solid' | 'gradient';

export type EffectMode = 'none' | 'shadow' | 'outline';

export type BackgroundMode = 'transparent' | 'solid' | 'mosaic' | 'image';

export type MosaicGradientType = 'organic' | 'radial' | 'linear' | 'conic';

export type BgBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'duotone';

export type TextureType = 'none' | 'bayer' | 'scanlines' | 'grid';

export type MotionMode = 'drift' | 'pulse' | 'rotate' | 'flicker';

export type TextAlign = 'left' | 'center' | 'right';

export type AspectRatioPreset =
  | 'auto'
  | '1:1'
  | '4:5'
  | '4:3'
  | '3:2'
  | '16:9'
  | '9:16';

export type BgImageFit = 'cover' | 'contain';

export interface EditorState {
  text: string;
  fontFamily: string;
  fontSource: FontSource;
  fontWeight: number;
  fontItalic: boolean;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: TextAlign;
  preStroke: number; // -1.5 to +3.5 px pre-dilation before pixelation
  padding: number; // grid cells around text
  aspectRatio: AspectRatioPreset;

  // Pixelation engine
  pixelSize: number; // grid cell size in render space (2..24)
  threshold: number; // 0.05..0.95
  quantizationMode: QuantizationMode;
  levelsCount: number; // 2..8 for 'levels' mode
  pixelShape: PixelShape;
  pixelGap: number; // 0..0.45 fraction of cell
  textGrain: number; // 0..100 pixel grain erosion on typography

  // Color & Effects
  fillMode: FillMode;
  color: string;
  gradientColorEnd: string;
  gradientAngle: number;
  effectMode: EffectMode;
  effectColor: string;

  // Background, Uploaded Image Pixelation, Gradient Blending, Grain & Motion
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  mosaicBlockRatio: number; // relative size of background pixels (0.25..6)
  mosaicGradientType: MosaicGradientType;
  mosaicPosX: number; // 0..1 focal point X
  mosaicPosY: number; // 0..1 focal point Y
  mosaicAngle: number; // 0..360 gradient angle
  mosaicScale: number; // 0.4..2.4 spread/contrast scale
  mosaicColorA: string;
  mosaicColorB: string;
  mosaicColorC: string;
  mosaicUseThirdColor: boolean;
  mosaicSeed: number;

  // Uploaded Background Image & Pixel Manipulation + Gradient Blending
  mosaicImageDataUrl: string | null;
  bgImageFit: BgImageFit;
  bgImageScale: number; // 0.1..3.0 (10%..300%)
  bgImageOffsetX: number; // -100..100%
  bgImageOffsetY: number; // -100..100%
  bgImageContrast: number; // 0.5..2.0
  bgImageBrightness: number; // -50..50
  bgImageGrayscale: boolean;
  bgImageLevels: number; // 0 = smooth, 2..16 = quantized/posterized color bands
  bgBlendMode: BgBlendMode;
  bgGradientMix: number; // 0..100% blend of gradient over uploaded image

  bgGrain: number; // 0..100 film/pixel grain noise
  bgTexture: TextureType;
  bgTextureIntensity: number; // 0..100

  // Motion
  motionEnabled: boolean;
  motionMode: MotionMode;
  motionSpeed: number; // 0.2..3.0

  // Export defaults
  exportScale: number;
  exportTransparent: boolean;
}

export interface PixelMatrix {
  cols: number;
  rows: number;
  /** Quantized alpha coverage per cell [0..1] */
  cells: Float32Array;
  /** Optional effect (shadow/outline) mask: 1 = effect cell */
  effectCells: Uint8Array;
  /** Active non-zero foreground pixel count */
  activeCount: number;
  /** Reference oversampled canvas for "Comparar Original" peek */
  sourceCanvas: HTMLCanvasElement;
}

export interface PresetDefinition {
  id: string;
  label: string;
  state: Partial<EditorState>;
}
