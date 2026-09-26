/**
 * CMS_MODE=fixture で使う仮データ。
 *
 * Delivery API の応答と**同じ形**（DeliveryEntry）で持ち、live と同じ mapper を通す。
 * 文言はデザイン（Figma top）から写したもの。名前・Topics は仮の内容。
 * 画像は public/fixtures/ に置いている。
 */

import type { DeliveryEntry, DeliveryMedia, PublicFormResponse } from "./contracts";

const AT = "2026-09-25T00:00:00.000Z";

// scripts/seed-local-cms.mjs（Node で直接読む）からも使うため、import.meta.env が無い場合は "/" とする。
const BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/+$/, "");

function media(id: string, file: string, width: number, height: number, alt: string | null): DeliveryMedia {
  const mimeType = file.endsWith(".png") ? "image/png" : "image/jpeg";
  return { id, url: `${BASE}/fixtures/${file}`, alt, width, height, mimeType };
}

function entry(id: string, slug: string | null, content: Record<string, unknown>): DeliveryEntry {
  return { id, slug, content, publishedAt: AT, updatedAt: AT };
}

// ---- rich_text（Lexical の JSON）を組み立てる小さな関数 ----
type Lex = Record<string, unknown>;
const text = (t: string, format = 0): Lex => ({ type: "text", text: t, format, detail: 0, mode: "normal", style: "", version: 1 });
const p = (...children: Lex[]): Lex => ({ type: "paragraph", children, direction: "ltr", format: "", indent: 0, version: 1 });
const h = (tag: "h2" | "h3", t: string): Lex => ({ type: "heading", tag, children: [text(t)], direction: "ltr", format: "", indent: 0, version: 1 });
const ul = (...items: string[]): Lex => ({
  type: "list",
  listType: "bullet",
  start: 1,
  tag: "ul",
  children: items.map((t, i) => ({ type: "listitem", value: i + 1, children: [text(t)], version: 1 })),
  version: 1,
});
const img = (m: DeliveryMedia): Lex => ({ type: "image", media: m, version: 1 });
const rich = (...children: Lex[]) => ({ root: { type: "root", children, direction: "ltr", format: "", indent: 0, version: 1 } });

export const fixtureHome: DeliveryEntry = entry("fx-home", null, {
  hero_images: [
    media("fx-hero-1", "hero-1.jpg", 840, 1092, "ソフトクリームを手に微笑むメンバー"),
    media("fx-hero-2", "hero-2.jpg", 720, 951, "橋の上で振り返るメンバー"),
    media("fx-hero-3", "hero-3.jpg", 640, 820, "頬杖をつくメンバー"),
  ],
  statement_lead: "何かに強く惹かれる瞬間。",
  statement_keywords: "憧れ。情熱。共鳴。熱望。",
  statement_title: "「トキメキ」",
  statement_body: [
    "人間の生活に不必要で不可欠な、それは、",
    "",
    "私たちに、「トキメキ」を与える。",
    "なにかを見て、ぐっと心が”アツ”くなる。",
    "",
    "思い出すだけで、未来がキラキラする。",
    "",
    "そのエネルギーさえあれば、",
    "",
    "ありえないくらいの速さで走り出せる。",
    "合同会社amiは、",
    "",
    "そんな「トキメキの発生点」を生み出す",
    "",
    "Z世代インフルエンサー・クリエイター集団です。",
  ].join("\n"),
  statement_highlight: "「トキメキの発生点」",
  statement_link: { label: "View more", href: "/about", target: "_self" },
  topics_limit: 4,
  contact_body: [
    "商品開発、SNSマーケティング、",
    "クリエイティブ制作など、",
    "まだアイデアが固まっていない段階でも",
    "お気軽にご相談ください。",
  ].join("\n"),
});

export const fixtureServices: DeliveryEntry[] = [
  entry("fx-service-sns", "sns-marketing", {
    title: "SNSマーケティング事業",
    summary: "当事者だから分かる潜在ニーズを言語化し、共感を設計。企画から撮影・編集・分析まで一気通貫で。",
    image: media("fx-service-sns-img", "business-sns.png", 483, 900, "SNS の投稿画面を表示したスマートフォン"),
    link: { label: "View more", href: "/service#sns-marketing", target: "_self" },
    body: rich(
      p(text("Z世代の当事者であるメンバーが、同世代の「いいな」「欲しい」をいちばん近くで感じ取り、企画に変えます。")),
      h("h3", "できること"),
      ul("SNSアカウントの運用代行・コンサルティング", "インフルエンサーを起用したプロモーションの企画", "ショート動画の企画・撮影・編集", "投稿データの分析と改善の提案"),
    ),
    sort_order: 1,
  }),
  entry("fx-service-product", "product-development", {
    title: "商品開発事業",
    summary:
      "既存の枠では捉えきれない微細な熱量をキャッチし、コンセプトからプロダクト開発・プロモーションまで一気通貫でプロデュース。",
    image: media("fx-service-product-img", "business-product.png", 368, 1000, "ハート型のキーホルダー"),
    link: { label: "View more", href: "/service#product-development", target: "_self" },
    body: rich(
      p(text("「こんなものがあったらトキメく」という小さな声を拾い上げ、かたちにします。")),
      h("h3", "できること"),
      ul("コンセプト設計・商品企画", "パッケージ・グッズのデザイン", "製造パートナーとの調整", "発売時のSNSプロモーション"),
    ),
    sort_order: 2,
  }),
];

const topicBody = rich(
  p(text("ここに記事の本文が入ります。"), text("本文は CMS のリッチテキストで入力します。", 1)),
  p(text("段落や見出し、リスト、画像、リンクを使えます。")),
  h("h2", "見出しが入ります"),
  p(text("当事者だから分かる潜在ニーズを言語化し、共感を設計。企画から撮影・編集・分析まで一気通貫で。")),
  ul("リストの項目が入ります", "リストの項目が入ります", "リストの項目が入ります"),
  img(media("fx-topic-body-img", "topic-sample.jpg", 640, 961, "ハートのキーホルダーを手にするメンバー")),
  h("h3", "小見出しが入ります"),
  p(
    text("詳しくは"),
    { type: "link", url: "/service", rel: null, target: null, title: null, children: [text("SERVICE")], direction: "ltr", format: "", indent: 0, version: 1 },
    text("をご覧ください。"),
  ),
);

const topicExcerpt = "当事者だから分かる潜在ニーズを言語化し、共感を設計。企画から撮影・編集・分析まで一気通貫で。";
const topicThumb = media("fx-topic-thumb", "topic-sample.jpg", 640, 961, "ハートのキーホルダーを手にするメンバー");

export const fixtureTopics: DeliveryEntry[] = [
  entry("fx-topic-1", "sample-news", {
    title: "タイトル",
    category: "news",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-20",
    body: topicBody,
  }),
  entry("fx-topic-2", "sample-sns", {
    title: "商品開発事業",
    category: "sns",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-18",
    body: topicBody,
  }),
  entry("fx-topic-3", "sample-column", {
    title: "タイトル",
    category: "column",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-15",
    body: topicBody,
  }),
  entry("fx-topic-4", "sample-sns-2", {
    title: "商品開発事業",
    category: "sns",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-10",
    body: topicBody,
  }),
  entry("fx-topic-5", "sample-news-2", {
    title: "タイトル",
    category: "news",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-01",
    body: topicBody,
  }),
  entry("fx-topic-6", "sample-column-2", {
    title: "タイトル",
    category: "column",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-08-25",
    body: topicBody,
  }),
  entry("fx-topic-7", "sample-sns-3", {
    title: "外部サイトの記事",
    category: "sns",
    thumbnail: topicThumb,
    excerpt: "外部リンクを設定した記事は、カードから直接そのページを開きます。",
    published_date: "2026-08-18",
    external_url: { label: "外部サイト", href: "https://www.example.com/", target: "_blank" },
  }),
];

export const fixtureMembers: DeliveryEntry[] = [1, 2, 3, 4, 5, 6].map((n) =>
  entry(`fx-member-${n}`, `member-${n}`, {
    name: "ここにお名前",
    role: "CEO / Influencer",
    portrait: media(`fx-member-${n}-img`, `member-${n}.png`, 480, 480, null),
    profile: "ここに紹介文が入ります。\n得意なことや、活動しているジャンルなどを 2〜3 行で紹介します。",
    sort_order: n,
  }),
);

// ---------------------------------------------------------------------------
// 会社情報・ABOUT・CONTACT（CMS の汎用モデル）。実際の値は未定のため仮の値
// ---------------------------------------------------------------------------

export const fixtureSiteInfo: DeliveryEntry = entry("fx-site-info", null, {
  company_name: "合同会社ami",
  address: "東京都〇〇区〇〇 0-0-0（仮）",
  default_title: "合同会社ami",
  title_template: "%s | 合同会社ami",
  default_description: "「トキメキの発生点」を生み出す Z世代インフルエンサー・クリエイター集団。",
  default_og_image: null,
});

export const fixtureAbout: DeliveryEntry = entry("fx-about", null, {
  lead: "Z世代の「トキメキ」を、いちばん近くで。",
  body: rich(
    p(text("ここに代表メッセージや、会社の想いが入ります。")),
    p(text("合同会社amiは、Z世代のインフルエンサー・クリエイターが集まり、同世代の心が動く瞬間をつくる会社です。")),
    p(text("SNSでの発信と商品づくりの両方から、「トキメキの発生点」を生み出していきます。")),
  ),
  main_image: media("fx-about-img", "hero-2.jpg", 720, 951, "橋の上で振り返るメンバー"),
  representative: "ここにお名前（仮）",
  established: "20XX年X月（仮）",
  capital: "〇〇万円（仮）",
  business_summary: "SNSマーケティング事業\n商品開発事業",
});

export const fixtureContactPage: DeliveryEntry = entry("fx-contact-page", null, {
  lead: [
    "商品開発、SNSマーケティング、クリエイティブ制作など、",
    "まだアイデアが固まっていない段階でもお気軽にご相談ください。",
  ].join("\n"),
  privacy_note: rich(
    p(text("ここに個人情報の取り扱いについての文章が入ります。")),
    p(text("お預かりした個人情報は、お問い合わせへの回答のためにのみ利用し、ご本人の同意なく第三者に提供することはありません。")),
  ),
  consent_label: "個人情報の取り扱いに同意する",
});

/** Form API の応答（GET /api/v1/forms/{siteKey}/ami_contact）と同じ形。定義は CMS の ami_contact に合わせる。 */
export const fixtureContactForm: PublicFormResponse["form"] = {
  key: "ami_contact",
  name: "お問い合わせ",
  acceptingSubmissions: true,
  consentRequired: true,
  consentTextVersion: "fixture",
  fields: [
    { key: "name", label: "お名前", type: "text", required: true, helpText: null, options: null, maxLength: 100 },
    { key: "company", label: "会社名", type: "text", required: false, helpText: null, options: null, maxLength: 100 },
    { key: "email", label: "メールアドレス", type: "email", required: true, helpText: null, options: null, maxLength: null },
    { key: "message", label: "お問い合わせ内容", type: "textarea", required: true, helpText: null, options: null, maxLength: 2000 },
  ],
};
