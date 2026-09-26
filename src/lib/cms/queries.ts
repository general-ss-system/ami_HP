/**
 * ページ単位のデータ取得（CMS docs/04 §12 の `queries`）。
 *
 * セクションごとに取得・検証し、失敗したセクションだけを欠けさせる。
 * 失敗は reportCmsError に送る（ページ全体は壊さない / CMS docs/04 §13）。
 */

import type { CmsClient } from "./client";
import type { DeliveryEntry } from "./contracts";
import {
  mapAbout,
  mapContactPage,
  mapHome,
  mapMember,
  mapService,
  mapSiteInfo,
  mapTopic,
  mapTopicDetail,
  type MapError,
  type MapResult,
} from "./mapper";
import { TOPIC_CATEGORIES } from "./schemas";
import type {
  AboutContent,
  ContactForm,
  ContactPageContent,
  HomeContent,
  Member,
  Service,
  SiteInfo,
  Topic,
  TopicCategory,
  TopicDetail,
  TopPageData,
} from "./types";

export type CmsErrorReporter = (message: string, detail: unknown) => void;

/** 本番では Workers のログ（observability）に出る。エラー追跡サービスを入れたらここを差し替える。 */
export const reportCmsError: CmsErrorReporter = (message, detail) => {
  console.error(`[cms] ${message}`, detail);
};

function collect<T>(entries: DeliveryEntry[], map: (e: DeliveryEntry) => MapResult<T>, report: CmsErrorReporter): T[] {
  const out: T[] = [];
  for (const e of entries) {
    const r = map(e);
    if (r.ok) out.push(r.value);
    else report("entry failed validation", r.error satisfies MapError);
  }
  return out;
}

async function safely<T>(label: string, fallback: T, run: () => Promise<T>, report: CmsErrorReporter): Promise<T> {
  try {
    return await run();
  } catch (err) {
    report(`failed to load ${label}`, err);
    return fallback;
  }
}

export async function getTopPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<TopPageData> {
  const home = await safely(
    "ami_home",
    null,
    async () => {
      const r = mapHome(await client.getSingleton("ami_home"));
      if (r.ok) return r.value;
      report("entry failed validation", r.error);
      return null;
    },
    report,
  );

  const topicsLimit = home?.topicsLimit;

  const [services, topics, members] = await Promise.all([
    safely(
      "ami_services",
      [],
      async () => collect((await client.getCollection("ami_services", { sort: "sort_order", limit: 10 })).data, mapService, report),
      report,
    ),
    safely(
      "ami_topics",
      [],
      async () =>
        collect(
          (await client.getCollection("ami_topics", { sort: "-published_date", limit: topicsLimit ?? 4 })).data,
          mapTopic,
          report,
        ),
      report,
    ),
    safely(
      "members",
      [],
      async () => collect((await client.getCollection("members", { sort: "sort_order", limit: 6 })).data, mapMember, report),
      report,
    ),
  ]);

  return { home, services, topics, members };
}

// ---------------------------------------------------------------------------
// 下層ページ
// ---------------------------------------------------------------------------

/** 一覧 1 ページあたりの件数。 */
export const TOPICS_PER_PAGE = 12;
/** MEMBER ページに並べる上限。 */
const MEMBERS_LIMIT = 50;
/** CONTACT ページのフォーム（CMS の Form 定義の key）。 */
export const CONTACT_FORM_KEY = "ami_contact";

async function loadSingleton<T>(
  client: CmsClient,
  modelKey: string,
  map: (e: DeliveryEntry) => MapResult<T>,
  report: CmsErrorReporter,
): Promise<T | null> {
  return safely(
    modelKey,
    null,
    async () => {
      const r = map(await client.getSingleton(modelKey));
      if (r.ok) return r.value;
      report("entry failed validation", r.error);
      return null;
    },
    report,
  );
}

/** 会社名・SEO の既定値。取得できなければ null（ページ側でタイトルだけにする）。 */
export function getSiteInfo(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<SiteInfo | null> {
  return loadSingleton(client, "site_info", mapSiteInfo, report);
}

export interface AboutPageData {
  siteInfo: SiteInfo | null;
  home: HomeContent | null;
  about: AboutContent | null;
}

export async function getAboutPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<AboutPageData> {
  const [siteInfo, home, about] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "ami_home", mapHome, report),
    loadSingleton(client, "about", (e) => mapAbout(e, report), report),
  ]);
  return { siteInfo, home, about };
}

export interface ServicePageData {
  siteInfo: SiteInfo | null;
  services: Service[];
}

export async function getServicePageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<ServicePageData> {
  const [siteInfo, services] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "ami_services",
      [],
      async () =>
        collect(
          (await client.getCollection("ami_services", { sort: "sort_order", limit: 20 })).data,
          (e) => mapService(e, report),
          report,
        ),
      report,
    ),
  ]);
  return { siteInfo, services };
}

export interface MemberPageData {
  siteInfo: SiteInfo | null;
  members: Member[];
}

export async function getMemberPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<MemberPageData> {
  const [siteInfo, members] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "members",
      [],
      async () => collect((await client.getCollection("members", { sort: "sort_order", limit: MEMBERS_LIMIT })).data, mapMember, report),
      report,
    ),
  ]);
  return { siteInfo, members };
}

export function isTopicCategory(value: string | undefined): value is TopicCategory {
  return (TOPIC_CATEGORIES as readonly string[]).includes(value ?? "");
}

export interface TopicsArchiveData {
  siteInfo: SiteInfo | null;
  topics: Topic[];
  category: TopicCategory | null;
  page: number;
  totalPages: number;
}

/** TOPICS 一覧。page が範囲外なら null（404 にする）。 */
export async function getTopicsArchive(
  client: CmsClient,
  options: { category: TopicCategory | null; page: number },
  report: CmsErrorReporter = reportCmsError,
): Promise<TopicsArchiveData | null> {
  const { category, page } = options;
  const [siteInfo, list] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "ami_topics",
      null,
      () =>
        client.getCollection("ami_topics", {
          sort: "-published_date",
          limit: TOPICS_PER_PAGE,
          page,
          filter: category ? { category } : undefined,
        }),
      report,
    ),
  ]);
  const totalPages = list?.meta.totalPages ?? 1;
  if (page > 1 && page > totalPages) return null;
  return { siteInfo, topics: list ? collect(list.data, mapTopic, report) : [], category, page, totalPages };
}

export interface TopicDetailData {
  siteInfo: SiteInfo | null;
  topic: TopicDetail;
  /** 下に並べる新着（この記事を除く）。 */
  recent: Topic[];
}

/** TOPICS 詳細。無い・非公開・外部リンクの記事は null（404 にする）。 */
export async function getTopicDetail(
  client: CmsClient,
  slug: string,
  report: CmsErrorReporter = reportCmsError,
): Promise<TopicDetailData | null> {
  const entry = await client.getEntry("ami_topics", slug);
  if (!entry) return null;
  const r = mapTopicDetail(entry, report);
  if (!r.ok) {
    report("entry failed validation", r.error);
    return null;
  }
  if (r.value.externalLink) return null;

  const [siteInfo, recent] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "ami_topics",
      [],
      async () => collect((await client.getCollection("ami_topics", { sort: "-published_date", limit: 4 })).data, mapTopic, report),
      report,
    ),
  ]);
  return { siteInfo, topic: r.value, recent: recent.filter((t) => t.id !== r.value.id).slice(0, 3) };
}

/** 静的書き出し（GitHub Pages のプレビュー）用: すべての記事。 */
export async function getAllTopics(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<Topic[]> {
  const out: Topic[] = [];
  for (let page = 1; ; page++) {
    const res = await client.getCollection("ami_topics", { sort: "-published_date", limit: 100, page });
    out.push(...collect(res.data, mapTopic, report));
    if (page >= res.meta.totalPages) return out;
  }
}

export interface ContactPageData {
  siteInfo: SiteInfo | null;
  contactPage: ContactPageContent | null;
  /** 取得できなければ null（フォームを出さない）。 */
  form: ContactForm | null;
}

export async function getContactPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<ContactPageData> {
  const [siteInfo, contactPage, form] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "contact_page", (e) => mapContactPage(e, report), report),
    safely<ContactForm | null>("form " + CONTACT_FORM_KEY, null, () => client.getForm(CONTACT_FORM_KEY), report),
  ]);
  return { siteInfo, contactPage, form };
}
