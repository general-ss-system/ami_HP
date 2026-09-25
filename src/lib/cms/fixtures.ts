/**
 * CMS_MODE=fixture で使う仮データ。
 *
 * Delivery API の応答と**同じ形**（DeliveryEntry）で持ち、live と同じ mapper を通す。
 * 文言はデザイン（Figma top）から写したもの。名前・Topics は仮の内容。
 * 画像は public/fixtures/ に置いている。
 */

import type { DeliveryEntry, DeliveryMedia } from "./contracts";

const AT = "2026-09-25T00:00:00.000Z";

function media(id: string, file: string, width: number, height: number, alt: string | null): DeliveryMedia {
  const mimeType = file.endsWith(".png") ? "image/png" : "image/jpeg";
  return { id, url: `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/fixtures/${file}`, alt, width, height, mimeType };
}

function entry(id: string, slug: string | null, content: Record<string, unknown>): DeliveryEntry {
  return { id, slug, content, publishedAt: AT, updatedAt: AT };
}

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
    "株式会社amiは、",
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
    sort_order: 1,
  }),
  entry("fx-service-product", "product-development", {
    title: "商品開発事業",
    summary:
      "既存の枠では捉えきれない微細な熱量をキャッチし、コンセプトからプロダクト開発・プロモーションまで一気通貫でプロデュース。",
    image: media("fx-service-product-img", "business-product.png", 368, 1000, "ハート型のキーホルダー"),
    link: { label: "View more", href: "/service#product-development", target: "_self" },
    sort_order: 2,
  }),
];

const topicExcerpt = "当事者だから分かる潜在ニーズを言語化し、共感を設計。企画から撮影・編集・分析まで一気通貫で。";
const topicThumb = media("fx-topic-thumb", "topic-sample.jpg", 640, 961, "ハートのキーホルダーを手にするメンバー");

export const fixtureTopics: DeliveryEntry[] = [
  entry("fx-topic-1", "sample-news", {
    title: "タイトル",
    category: "news",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-20",
  }),
  entry("fx-topic-2", "sample-sns", {
    title: "商品開発事業",
    category: "sns",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-18",
  }),
  entry("fx-topic-3", "sample-column", {
    title: "タイトル",
    category: "column",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-15",
  }),
  entry("fx-topic-4", "sample-sns-2", {
    title: "商品開発事業",
    category: "sns",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-10",
  }),
];

export const fixtureMembers: DeliveryEntry[] = [1, 2, 3, 4, 5, 6].map((n) =>
  entry(`fx-member-${n}`, `member-${n}`, {
    name: "ここにお名前",
    role: "CEO / Influencer",
    portrait: media(`fx-member-${n}-img`, `member-${n}.png`, 480, 480, null),
    sort_order: n,
  }),
);
