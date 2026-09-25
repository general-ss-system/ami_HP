/**
 * サイト内の絶対パスに、公開先のベースパスを付ける。
 *
 * 本番（Cloudflare）はドメイン直下（base = "/"）、GitHub Pages のプレビューは "/ami_HP/" の下に置かれる。
 * サイト内リンクはすべてこの関数を通し、どちらでも正しく動くようにする。
 */
export function withBase(path: string): string {
  // 外部 URL・メール・電話はそのまま
  if (!path.startsWith("/")) return path;
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}
