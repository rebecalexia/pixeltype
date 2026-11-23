import { FontItem } from '../types/editor';

const loadedGoogleFamilies = new Set<string>();
const pendingGoogleLoads = new Map<string, Promise<boolean>>();

function buildGoogleCssUrl(family: string, weights?: number[], hasItalic?: boolean): string {
  const encoded = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  if (!weights || weights.length === 0) {
    return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
  }
  const uniqueWeights = Array.from(new Set(weights)).sort((a, b) => a - b);
  if (hasItalic) {
    const tuples = [
      ...uniqueWeights.map((w) => `0,${w}`),
      ...uniqueWeights.map((w) => `1,${w}`),
    ];
    return `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@${tuples.join(';')}&display=swap`;
  }
  if (uniqueWeights.length === 1 && uniqueWeights[0] === 400) {
    return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
  }
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${uniqueWeights.join(';')}&display=swap`;
}

async function injectStylesheet(url: string): Promise<void> {
  const existing = document.querySelector(`link[data-font-url="${url}"]`);
  if (existing) return;

  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-font-url', url);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Falha ao carregar folha de estilo da fonte.'));
    document.head.appendChild(link);
  });
}

export async function loadGoogleFont(
  family: string,
  weights?: number[],
  hasItalic?: boolean,
  targetWeight = 400,
  targetItalic = false
): Promise<boolean> {
  const cleanFamily = family.trim();
  if (!cleanFamily) return false;

  const cacheKey = `${cleanFamily}::${targetWeight}::${targetItalic ? 'i' : 'n'}`;
  if (loadedGoogleFamilies.has(cacheKey)) {
    return true;
  }

  if (pendingGoogleLoads.has(cacheKey)) {
    return pendingGoogleLoads.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      let url = buildGoogleCssUrl(cleanFamily, weights, hasItalic);

      // For arbitrary Google Font names without known axes, probe full axis first then fallback to base
      if (!weights) {
        const probeUrl = buildGoogleCssUrl(cleanFamily, [400, 500, 600, 700], true);
        try {
          const resp = await fetch(probeUrl);
          if (resp.ok) {
            url = probeUrl;
          } else {
            const weightProbe = buildGoogleCssUrl(cleanFamily, [400, 700], false);
            const resp2 = await fetch(weightProbe);
            if (resp2.ok) {
              url = weightProbe;
            } else {
              const baseResp = await fetch(url);
              if (!baseResp.ok) {
                return false;
              }
            }
          }
        } catch {
          // If fetch fails due to network/proxy, try injecting directly
        }
      }

      await injectStylesheet(url);
      const styleStr = `${targetItalic ? 'italic' : 'normal'} ${targetWeight} 48px "${cleanFamily}"`;
      await Promise.race([
        document.fonts.load(styleStr),
        new Promise((res) => setTimeout(res, 2500)),
      ]);
      await document.fonts.ready;
      loadedGoogleFamilies.add(cacheKey);
      return true;
    } catch {
      return false;
    } finally {
      pendingGoogleLoads.delete(cacheKey);
    }
  })();

  pendingGoogleLoads.set(cacheKey, promise);
  return promise;
}

export async function loadLocalFontFile(file: File): Promise<FontItem> {
  const rawName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, '');
  const cleanName = rawName.replace(/[-_]+/g, ' ').trim() || 'Fonte Personalizada';

  const buffer = await file.arrayBuffer();
  const face = new FontFace(cleanName, buffer);
  const loaded = await face.load();
  document.fonts.add(loaded);
  await document.fonts.ready;

  return {
    family: cleanName,
    category: 'Display',
    source: 'local',
    weights: [400],
    hasItalic: false,
  };
}

export async function loadExternalFontUrl(
  rawUrl: string,
  customFamilyName?: string
): Promise<FontItem[]> {
  const url = rawUrl.trim();
  if (!url) {
    throw new Error('Informe uma URL válida.');
  }

  const cleanPath = url.split('?')[0].toLowerCase();
  const isDirectFontFile = /\.(woff2?|ttf|otf)$/i.test(cleanPath);

  if (isDirectFontFile) {
    const inferredName =
      customFamilyName?.trim() ||
      decodeURIComponent(cleanPath.split('/').pop() || 'External Font')
        .replace(/\.(woff2?|ttf|otf)$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();

    const face = new FontFace(inferredName, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
    await document.fonts.ready;

    return [
      {
        family: inferredName,
        category: 'Display',
        source: 'external-url',
        weights: [400],
        hasItalic: false,
        url,
      },
    ];
  }

  // External CSS stylesheet (Google Fonts CSS2, Fontshare, Bunny Fonts, CDN)
  await injectStylesheet(url);

  const detectedFamilies = new Set<string>();
  if (customFamilyName?.trim()) {
    detectedFamilies.add(customFamilyName.trim());
  }

  // Try extracting family names from URL query params (Google Fonts / Fontshare patterns)
  try {
    const parsed = new URL(url);
    const gfFamilies = parsed.searchParams.getAll('family');
    for (const f of gfFamilies) {
      const base = f.split(':')[0].replace(/\+/g, ' ').trim();
      if (base) detectedFamilies.add(base);
    }
    const fontshareFamilies = parsed.searchParams.getAll('f[]');
    for (const f of fontshareFamilies) {
      const base = f.split('@')[0].replace(/-/g, ' ').trim();
      if (base) {
        detectedFamilies.add(
          base.replace(/\b\w/g, (c) => c.toUpperCase())
        );
      }
    }
  } catch {
    // ignore URL parse error
  }

  // Try fetching CSS text to discover exact font-family declarations
  try {
    const res = await fetch(url);
    if (res.ok) {
      const cssText = await res.text();
      const matches = cssText.matchAll(/font-family:\s*['"]?([^'";]+)['"]?\s*;/gi);
      for (const m of matches) {
        const name = m[1].trim();
        if (name) detectedFamilies.add(name);
      }
    }
  } catch {
    // CORS prevented reading CSS text; rely on customFamilyName or URL params
  }

  if (detectedFamilies.size === 0) {
    throw new Error(
      'CSS carregado, mas não foi possível detectar o nome da fonte automaticamente. Preencha o campo "Nome da Família" acima.'
    );
  }

  const results: FontItem[] = [];
  for (const fam of detectedFamilies) {
    try {
      await Promise.race([
        document.fonts.load(`400 48px "${fam}"`),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    } catch {
      // continue
    }
    results.push({
      family: fam,
      category: 'Display',
      source: 'external-url',
      weights: [400],
      hasItalic: true,
      url,
    });
  }

  await document.fonts.ready;
  return results;
}
