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
/** 段落の中の改行（Lexical の linebreak）で区切った行。 */
const lines = (...rows: string[]): Lex => p(...rows.flatMap((r, i) => (i === 0 ? [text(r)] : [{ type: "linebreak", version: 1 }, text(r)])));
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
      p(text("私たちは、メンバー全員がZ世代であり、SNSを生活の一部として使いこなすデジタルネイティブ集団です。")),
      p(
        text(
          "既存のマーケティングデータだけでは見えてこない、当事者だからこそ分かる、潜在的なニーズの言語化と共感の設計を軸に、企画・撮影・編集からデータ分析までを一気通貫で実行します。",
        ),
      ),
    ),
    sort_order: 1,
    title_en: "SNS Marketing",
    photo: media("fx-service-sns-photo", "hero-2.jpg", 720, 951, "桃を手にほほえむメンバー"),
    accent: "blue",
  }),
  entry("fx-service-product", "product-development", {
    title: "商品開発事業",
    summary:
      "既存の枠では捉えきれない微細な熱量をキャッチし、コンセプトからプロダクト開発・プロモーションまで一気通貫でプロデュース。",
    image: media("fx-service-product-img", "business-product.png", 368, 1000, "ハート型のキーホルダー"),
    link: { label: "View more", href: "/service#product-development", target: "_self" },
    body: rich(
      p(
        text(
          "私たちは、Z世代のリアルなインサイトを起点に、「今、本当に求められているもの」を圧倒的なトレンド感度で具現化するクリエイティブユニットです。",
        ),
      ),
      p(
        text(
          "既存のマーケティングフレームワークでは捉えきれない微細な熱量をキャッチし、コンセプト立案からプロダクト開発、プロモーションまでを一気通貫でプロデュースします。",
        ),
      ),
    ),
    sort_order: 2,
    title_en: "Product development",
    photo: media("fx-service-product-photo", "topic-sample.jpg", 640, 961, "ハートのキーホルダーを手にするメンバー"),
    accent: "pink",
  }),
];

/** SERVICE ページの案内文（ami_service_page）。文言はデザインから */
export const fixtureServicePage: DeliveryEntry = entry("fx-service-page", null, {
  lead: ["Z世代のリアルなインサイトを起点に、", "商品開発とSNSマーケティングの２つの軸で", "トキメキあふれる体験と価値を生み出します。"].join("\n"),
});

const serviceRef = (slug: "product-development" | "sns-marketing") => ({
  id: slug === "product-development" ? "fx-service-product" : "fx-service-sns",
  model: "ami_services",
  slug,
});
const mediaAccount = { instagram: "@ricoyamada", x: "@ricoyamada", tiktok: "@ricoyamada" };
const snsLinks = {
  instagram: { label: mediaAccount.instagram, href: "https://www.instagram.com/", target: "_blank" },
  x: { label: mediaAccount.x, href: "https://x.com/", target: "_blank" },
  tiktok: { label: mediaAccount.tiktok, href: "https://www.tiktok.com/", target: "_blank" },
};
const tieUpPricing = ["タイアップ投稿|150,000円〜 / 1本|※企画、制作、投稿、分析レポートを含む。", "納期目安|ヒアリングから1ヶ月後ごろ"].join("\n");
const reels = (prefix: string) => [
  media(`${prefix}-1`, "hero-1.jpg", 840, 1092, "ショート動画の一場面"),
  media(`${prefix}-2`, "hero-2.jpg", 720, 951, "ショート動画の一場面"),
  media(`${prefix}-3`, "hero-3.jpg", 640, 820, "ショート動画の一場面"),
  media(`${prefix}-4`, "topic-sample.jpg", 640, 961, "ショート動画の一場面"),
];

/** SERVICE ページの Case Study（ami_service_cases）。文言はデザインの見本（仮） */
export const fixtureServiceCases: DeliveryEntry[] = [
  entry("fx-case-chamini", null, {
    service: serviceRef("product-development"),
    label: "コスメブランド",
    title: "「Chamini」",
    main_image: media("fx-case-chamini-main", "business-product.png", 368, 1000, "ハート型のキーホルダー"),
    body: rich(
      lines(
        "現役大学生6名によるプロデュースチームが、コンセプト立案からプロダクト開発、SNSプロモーションまでを一貫して手掛けました。",
        "2026年3月のローンチ直後から大きな反響を呼び、戦略的なマーケティングと確かなプロダクト力で、市場に新たな価値を提示しました。",
      ),
    ),
    points: rich(
      h("h3", "戦略的プロセスエコノミー"),
      p(
        text(
          "SNSアカウント「可愛くなりたい青学生」を起点に、開発過程からファンを巻き込むプロセスエコノミーを展開。運用開始から半年足らずで総フォロワー数10,000人を突破しました。",
        ),
      ),
      h("h3", "マーケット実績"),
      p(text("発売からわずか10日で累計販売個数10,000個を達成。")),
      h("h3", "展開"),
      lines("国内最大手の総合ディスカウントストアにて全国展開", "（一部店舗除く）"),
    ),
    gallery: [
      media("fx-case-chamini-g1", "topic-sample.jpg", 640, 961, "商品の写真"),
      media("fx-case-chamini-g2", "hero-1.jpg", 840, 1092, "商品を使うようす"),
      media("fx-case-chamini-g3", "hero-2.jpg", 720, 951, "商品を手にするメンバー"),
      media("fx-case-chamini-g4", "hero-3.jpg", 640, 820, "商品を使うようす"),
      media("fx-case-chamini-g5", "hero-1.jpg", 840, 1092, "商品を手にするメンバー"),
    ],
    sort_order: 1,
  }),
  entry("fx-case-aogaku", null, {
    service: serviceRef("sns-marketing"),
    label: "自社メディア",
    title: "難攻不落の青学生",
    ...snsLinks,
    body: rich(
      lines("等身大の大学生の日常を切り取った、", "ライフスタイル特化型アカウント。"),
      lines(
        "運用開始から約半年で総フォロワー数10,000人を突破。",
        "ターゲット目線でのコーデ動画やTips動画により、",
        "「共感」をベースとした高エンゲージメントなコミュニティを構築。",
      ),
    ),
    pricing: tieUpPricing,
    gallery: reels("fx-case-aogaku"),
    sort_order: 2,
  }),
  entry("fx-case-kawaao", null, {
    service: serviceRef("sns-marketing"),
    label: "自社メディア",
    title: "かわあお",
    ...snsLinks,
    body: rich(
      p(text("美容・コスメに特化した、共創型マーケティングメディア。")),
      lines(
        "運用開始から約半年で総フォロワー数20,000人を突破。",
        "自社コスメブランド「chamini」の開発過程をゼロから公開。",
        "視聴者を開発パートナーとして位置づけ、",
        "コメント欄を通じて意見を反映させる「共創型プロデュース」を実現。",
        "発売前からの熱狂的なファン形成に成功しました。",
      ),
    ),
    pricing: tieUpPricing,
    gallery: reels("fx-case-kawaao"),
    sort_order: 3,
  }),
  entry("fx-case-consulting", null, {
    service: serviceRef("sns-marketing"),
    label: "SNS Consulting",
    title: "SNSコンサルティング・クリエイティブ制作",
    body: rich(
      p(
        text(
          "自社メディアで実証された「伸びるロジック」と「当事者の感性」をクライアント企業の課題に適用。企画からデータ分析までを一気通貫でサポートし、ブランドのファン化を促進します。",
        ),
      ),
    ),
    points: rich(
      h("h3", "事例"),
      lines(
        "・10代向け人気ファッション誌における公式SNSのコンテンツ制作",
        "（企画・撮影・ディレクション）",
        "・国内最大手ヘアケアメーカーのプロモーション用クリエイティブ制作",
        "　および運用支援",
      ),
    ),
    pricing: ["企画|150,000円〜 / 1本", "企画＋制作|300,000円〜 / 1本", "納期目安|ヒアリングから1ヶ月後ごろ"].join("\n"),
    gallery: [media("fx-case-consulting-1", "hero-2.jpg", 720, 951, "制作したショート動画の一場面")],
    sort_order: 4,
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

/** デザイン（TOPICS 詳細）の記事。Pick UP! にも出す。 */
const brandMovieBody = rich(
  h("h2", "トキメキは、つくれる。"),
  p(text("このたび、私たちの新しいブランドムービー「トキメキは、つくれる。」を公開しました。")),
  lines("日々の暮らしの中にある、ふと心が動く瞬間。", "誰かとの出会いや、新しいものとの出会い。", "そんな小さな「トキメキ」を、私たちはもっと自由につくっていきたい。"),
  p(text("今回のブランドムービーでは、何気ない日常の中に生まれる感情の変化を切り取りながら、私たちが大切にしている「新しい価値を生み出すこと」を表現しています。")),
  h("h3", "ブランドムービーについて"),
  img(media("fx-topic-movie-img", "topic-sample.jpg", 640, 961, "ブランドムービーの一場面")),
  p(text("映像では、さまざまなシーンを通して「日常の中にある小さな変化」を描いています。")),
  lines("何気ない瞬間が少し特別に見えたり、", "新しいアイデアが誰かの行動を変えたり。"),
  lines("「こんなものがあったら面白い」", "「やってみたい」", "「なんだかワクワクする」"),
  p(text("そんな気持ちが生まれるきっかけを、映像ならではの表現で届けています。")),
  p(text("ぜひ、音や映像の細かな表現にも注目しながらご覧ください。")),
  h("h3", "これからも、新しいトキメキを。"),
  p(text("私たちはこれからも、既存の価値にとらわれず、新しいアイデアや表現を通して、世の中に新しい体験を届けていきます。")),
  p(text("一人ひとりの「やってみたい」という気持ちを大切にしながら、まだ見たことのない「トキメキ」を、これからもつくっていきます。")),
  p(text("ぜひブランドムービーをご覧ください。そして、私たちのこれからの挑戦にもご期待ください。")),
);

export const fixtureTopics: DeliveryEntry[] = [
  entry("fx-topic-0", "brand-movie", {
    title: "新ブランドムービー「トキメキは、つくれる。」を公開しました",
    category: "news",
    thumbnail: topicThumb,
    excerpt: "新しいブランドムービーを公開しました。\n日常の中にある「ちょっとしたトキメキ」を、\n私たちらしいクリエイティブで表現しています。",
    published_date: "2026-09-24",
    body: brandMovieBody,
    pickup: true,
  }),
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
    pickup: true,
  }),
  entry("fx-topic-3", "sample-column", {
    title: "タイトル",
    category: "column",
    thumbnail: topicThumb,
    excerpt: topicExcerpt,
    published_date: "2026-09-15",
    body: topicBody,
    pickup: true,
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

const memberPhotos = [
  media("fx-member-photo-1", "hero-1.jpg", 840, 1092, "プロフィール写真（正面）"),
  media("fx-member-photo-2", "hero-2.jpg", 720, 951, "プロフィール写真（屋外）"),
  media("fx-member-photo-3", "hero-3.jpg", 640, 820, "プロフィール写真（頬杖）"),
  media("fx-member-photo-4", "topic-sample.jpg", 640, 961, "プロフィール写真（キーホルダーを手に）"),
];

/** MEMBER（9 人）。ドット絵のアイコンは 6 種類を繰り返す。プロフィールはデザインの見本の値（仮） */
export const fixtureMembers: DeliveryEntry[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
  entry(`fx-member-${n}`, `member-${n}`, {
    name: n === 1 ? "山田 莉子" : "ここにお名前",
    role: "CEO / Influencer",
    portrait: media(`fx-member-${((n - 1) % 6) + 1}-img`, `member-${((n - 1) % 6) + 1}.png`, 480, 480, null),
    profile:
      "学生時代からSNSを中心に発信活動をスタートし、現在はモデル・俳優として活動。自然体で親しみやすいキャラクターを活かし、広告や映像作品、SNSコンテンツなど幅広いジャンルで活躍している。今後さらなる活動の幅を広げることが期待される注目の若手タレント。",
    sort_order: n,
    birthday: "1998-06-12",
    hometown: "東京都",
    height: "165cm",
    mbti: "ENFP",
    personal_color: "ブルベ夏",
    instagram: { label: "@ricoyamada", href: "https://www.instagram.com/", target: "_blank" },
    x: { label: "@ricoyamada", href: "https://x.com/", target: "_blank" },
    tiktok: { label: "@ricoyamada", href: "https://www.tiktok.com/", target: "_blank" },
    photos: memberPhotos,
  }),
);

// ---------------------------------------------------------------------------
// 会社情報・ABOUT・CONTACT（CMS の汎用モデル）。実際の値は未定のため仮の値
// ---------------------------------------------------------------------------

export const fixtureSiteInfo: DeliveryEntry = entry("fx-site-info", null, {
  company_name: "合同会社ami",
  address: "東京都〇〇区〇〇 0-0-0（仮）",
  phone: "03-0000-0000（仮）",
  email: "info@example.com（仮）",
  instagram_url: { label: "Instagram", href: "https://www.instagram.com/", target: "_blank" },
  x_url: { label: "X", href: "https://x.com/", target: "_blank" },
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
  lead: ["商品開発、SNSマーケティング、", "クリエイティブ制作など、", "まだアイデアが固まっていない段階でも", "お気軽にご相談ください。"].join("\n"),
  privacy_note: rich(
    p(text("ここに個人情報の取り扱いについての文章が入ります（以下は仮の文章です）。")),
    p(text("合同会社ami（以下「当社」）は、お預かりする個人情報を適切に取り扱うため、以下のとおり定めます。")),
    h("h2", "1. 取得する情報"),
    p(text("お問い合わせの際に入力いただいた、お名前・会社名・メールアドレス・お問い合わせ内容を取得します。")),
    h("h2", "2. 利用の目的"),
    ul("お問い合わせへの回答・ご連絡のため", "ご依頼いただいた業務の遂行のため"),
    h("h2", "3. 第三者への提供"),
    p(text("法令に基づく場合を除き、ご本人の同意なく第三者に提供することはありません。")),
    h("h2", "4. 開示・訂正・削除のご依頼"),
    p(text("ご本人から個人情報の開示・訂正・削除のご依頼があった場合は、本人確認のうえ速やかに対応します。")),
    h("h2", "5. お問い合わせ窓口"),
    p(text("個人情報の取り扱いに関するお問い合わせは、お問い合わせフォームよりご連絡ください。")),
  ),
  consent_label: "プライバシーポリシーに同意する",
});

/** Form API の応答（GET /api/v1/forms/{siteKey}/ami_contact）と同じ形。定義は CMS の ami_contact に合わせる。 */
export const fixtureContactForm: PublicFormResponse["form"] = {
  key: "ami_contact",
  name: "お問い合わせ",
  acceptingSubmissions: true,
  consentRequired: true,
  consentTextVersion: "fixture",
  fields: [
    { key: "name", label: "お名前", type: "text", required: true, helpText: "例）山田太郎", options: null, maxLength: 100 },
    { key: "company", label: "会社名", type: "text", required: false, helpText: "例）株式会社〇〇", options: null, maxLength: 100 },
    { key: "email", label: "メールアドレス", type: "email", required: true, helpText: "例）example@mail.com", options: null, maxLength: null },
    { key: "message", label: "お問い合わせ内容", type: "textarea", required: true, helpText: null, options: null, maxLength: 2000 },
  ],
};

// ---------------------------------------------------------------------------
// WORKS（CMS の汎用モデル works）。内容は仮
// ---------------------------------------------------------------------------

const workBody = rich(
  p(text("ここに実績の紹介文が入ります。"), text("どんな課題に、どう取り組んだか", 1), text("を書きます。")),
  h("h2", "取り組んだこと"),
  ul("ターゲットへのインタビューとコンセプト設計", "SNS での発信の企画・撮影・編集", "発売後の反応の分析と改善"),
  h("h2", "結果"),
  p(text("ここに成果が入ります（例: 投稿の保存数、販売数など）。")),
);

function work(n: number, content: Record<string, unknown>): DeliveryEntry {
  return entry(`fx-work-${n}`, `sample-work-${n}`, { body: workBody, ...content });
}

export const fixtureWorks: DeliveryEntry[] = [
  work(1, {
    title: "コスメブランドの SNS プロモーション（仮）",
    client_name: "株式会社〇〇（仮）",
    summary: "Z世代向けの新商品の発売にあわせ、ショート動画とインフルエンサーの投稿を企画しました。",
    published_date: "2026-09-10",
    tags: ["movie", "branding"],
    thumbnail: media("fx-work-1-thumb", "hero-1.jpg", 840, 1092, "新商品を手にするメンバー"),
    gallery: [
      media("fx-work-1-g1", "hero-1.jpg", 840, 1092, "撮影のようす"),
      media("fx-work-1-g2", "hero-2.jpg", 720, 951, "屋外での撮影"),
      media("fx-work-1-g3", "hero-3.jpg", 640, 820, "完成した投稿の一場面"),
    ],
    external_url: { label: "キャンペーンサイト", href: "https://www.example.com/", target: "_blank" },
  }),
  work(2, {
    title: "オリジナルキーホルダーの商品開発（仮）",
    client_name: "自社商品",
    summary: "「持ち歩けるトキメキ」をテーマに、ハート型のキーホルダーを企画・デザインしました。",
    published_date: "2026-08-28",
    tags: ["graphic", "branding"],
    thumbnail: media("fx-work-2-thumb", "topic-sample.jpg", 640, 961, "ハートのキーホルダーを手にするメンバー"),
    gallery: [
      media("fx-work-2-g1", "business-product.png", 368, 1000, "ハート型のキーホルダー"),
      media("fx-work-2-g2", "topic-sample.jpg", 640, 961, "商品を手にするメンバー"),
    ],
  }),
  work(3, {
    title: "アパレルブランドの Web サイト制作（仮）",
    client_name: "〇〇株式会社（仮）",
    summary: "ブランドの世界観を伝える特設サイトを、撮影から制作まで担当しました。",
    published_date: "2026-08-05",
    tags: ["web"],
    thumbnail: media("fx-work-3-thumb", "hero-2.jpg", 720, 951, "橋の上で振り返るメンバー"),
  }),
  work(4, {
    title: "飲食店の SNS アカウント運用（仮）",
    client_name: "〇〇カフェ（仮）",
    summary: "毎週の投稿の企画・撮影と、フォロワーの反応の分析を続けています。",
    published_date: "2026-07-20",
    tags: ["movie"],
    thumbnail: media("fx-work-4-thumb", "hero-3.jpg", 640, 820, "頬杖をつくメンバー"),
  }),
  work(5, {
    title: "イベントのキービジュアル制作（仮）",
    client_name: "〇〇実行委員会（仮）",
    summary: "ドット絵のモチーフを使ったキービジュアルと告知用の画像を制作しました。",
    published_date: "2026-06-30",
    tags: ["graphic"],
    thumbnail: media("fx-work-5-thumb", "business-sns.png", 483, 900, "SNS の投稿画面を表示したスマートフォン"),
  }),
];

// ---------------------------------------------------------------------------
// RECRUIT（CMS の汎用モデル recruit / job_positions）。内容は仮
// ---------------------------------------------------------------------------

export const fixtureRecruit: DeliveryEntry = entry("fx-recruit", null, {
  message_title: "いっしょに「トキメキ」をつくる仲間を探しています。",
  message_body: rich(
    p(text("ここに採用メッセージが入ります（以下は仮の文章です）。")),
    p(text("amiは、Z世代のインフルエンサー・クリエイターが集まるチームです。"), text("好きなものを、好きなだけ語れること", 1), text("がいちばんの才能だと考えています。")),
    p(text("経験の有無は問いません。あなたの「好き」を、次のトキメキにしてみませんか。")),
  ),
  main_image: media("fx-recruit-img", "hero-3.jpg", 640, 820, "頬杖をつくメンバー"),
  gallery: [
    media("fx-recruit-g1", "hero-1.jpg", 840, 1092, "撮影の合間のようす"),
    media("fx-recruit-g2", "hero-2.jpg", 720, 951, "屋外での撮影"),
    media("fx-recruit-g3", "topic-sample.jpg", 640, 961, "商品を手にするメンバー"),
  ],
});

function job(n: number, slug: string, content: Record<string, unknown>): DeliveryEntry {
  const at = `2026-09-${String(20 - n).padStart(2, "0")}T00:00:00.000Z`;
  return { id: `fx-job-${n}`, slug, content, publishedAt: at, updatedAt: at };
}

export const fixtureJobPositions: DeliveryEntry[] = [
  job(1, "sns-planner", {
    title: "SNSプランナー（仮）",
    employment_type: "full_time",
    location: "東京（リモート可）",
    summary: "企業アカウントの企画から撮影・分析までを担当します。",
    description: rich(
      h("h3", "仕事内容"),
      ul("SNS アカウントの企画・投稿の設計", "撮影・編集のディレクション", "投稿の反応の分析と改善の提案"),
      h("h3", "求める人物像"),
      p(text("SNS が好きで、流行りのものを自分の言葉で説明できる方。")),
    ),
    is_open: true,
  }),
  job(2, "creator-intern", {
    title: "クリエイター（インターン）（仮）",
    employment_type: "intern",
    location: "東京",
    summary: "ショート動画の撮影・編集を、メンバーと一緒に進めます。",
    description: rich(
      h("h3", "仕事内容"),
      ul("ショート動画の撮影・編集", "企画会議への参加"),
      h("h3", "応募の条件"),
      p(text("週 2 日以上、3 か月以上続けられる方。")),
    ),
    is_open: true,
  }),
  job(3, "designer", {
    title: "グラフィックデザイナー（仮）",
    employment_type: "contract",
    summary: "募集を締め切った職種の例（ページには出ない）。",
    description: rich(p(text("募集は終了しました。"))),
    is_open: false,
  }),
];

// ---------------------------------------------------------------------------
// FAQ（CMS の汎用モデル faq）。内容は仮
// ---------------------------------------------------------------------------

const faq = (n: number, question: string, ...answer: Lex[]): DeliveryEntry =>
  entry(`fx-faq-${n}`, null, { question, answer: rich(...answer), sort_order: n });

export const fixtureFaqs: DeliveryEntry[] = [
  faq(1, "まだ内容が決まっていなくても相談できますか？（仮）", p(text("はい。アイデアの段階からお気軽にご相談ください。ここに回答が入ります。"))),
  faq(2, "どのような業務をお願いできますか？（仮）", p(text("主に次の業務をお受けしています。")), ul("SNS アカウントの企画・運用", "インフルエンサーの起用・キャスティング", "商品の企画・開発")),
  faq(3, "費用はどのくらいかかりますか？（仮）", p(text("内容や期間によって変わります。ご相談の内容をうかがってから、お見積もりをお送りします。"))),
  faq(4, "依頼してから公開までの期間は？（仮）", p(text("企画から公開まで、目安として 1〜2 か月ほどいただいています。"))),
];
