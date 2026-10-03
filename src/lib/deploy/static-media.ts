/**
 * 静的に書き出したサイト（Xserver 向け / CMS docs/05 ADR-031）の中の CMS の画像を、サイトの /media/ に置き換える。
 *
 * 画像は CMS（workers.dev）から配信できるが、閲覧のたびに Workers の無料枠を使い、CMS が止まると画像も消える。
 * ビルドのときに取り込んで Xserver から配信し、公開サイトを CMS に依存させない。
 * 画像・本文中の画像・OGP など出所を問わず扱えるよう、部品ごとではなく書き出した文書をまとめて書き換える。
 * scripts/deploy.mjs から Node で直接読み込むため、このファイルは他のモジュールを import しない。
 */

/** 取り込んだ画像を置くサイト内の場所。 */
export const LOCAL_MEDIA_PREFIX = "/media/";

/** CMS の画像の保存キー（storage_key）として受け付ける形。パスの外へ出る値（..）や空白を通さない。 */
const MEDIA_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mediaPattern(cmsMediaBase: string): RegExp {
  // 属性値・JSON・CSS の区切りで止める
  return new RegExp(`${escapeRegExp(cmsMediaBase.replace(/\/+$/, ""))}/([^"'\\s)<>?#]+)`, "g");
}

/** 文書に含まれる CMS の画像の保存キーを返す（重複なし）。形の不正なものは除く。 */
export function collectMediaKeys(text: string, cmsMediaBase: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(mediaPattern(cmsMediaBase))) {
    const key = m[1]!;
    if (MEDIA_KEY.test(key)) keys.add(key);
  }
  return [...keys];
}

/**
 * CMS の画像の URL をサイトの /media/ に書き換える。
 * OGP・Twitter カードの画像（meta の content）はサイトの絶対URLにし、それ以外はサイト内のパスにする。
 */
export function rewriteMediaUrls(text: string, cmsMediaBase: string, siteOrigin: string): string {
  const pattern = mediaPattern(cmsMediaBase);
  const absolute = text.replace(
    /(<meta\b[^>]*\bcontent=")([^"]*)(")/g,
    (_m, before: string, value: string, after: string) =>
      before + value.replace(pattern, (_u, key: string) => (MEDIA_KEY.test(key) ? `${siteOrigin}${LOCAL_MEDIA_PREFIX}${key}` : _u)) + after,
  );
  return absolute.replace(pattern, (u, key: string) => (MEDIA_KEY.test(key) ? `${LOCAL_MEDIA_PREFIX}${key}` : u));
}

/** Xserver（Apache）向けの .htaccess。404 ページと、取り込んだ画像の長めのキャッシュ。 */
export function apacheConfig(): string {
  return [
    "# scripts/deploy.mjs が書き出す（手で編集しない）",
    "ErrorDocument 404 /404.html",
    "",
    "<IfModule mod_headers.c>",
    "  # 取り込んだ CMS の画像と、ビルドで名前にハッシュが付くファイルは変わらないので長く持たせる",
    '  <If "%{REQUEST_URI} =~ m#^/(media|_astro)/#">',
    '    Header set Cache-Control "public, max-age=31536000, immutable"',
    "  </If>",
    "</IfModule>",
    "",
  ].join("\n");
}
