/**
 * ページ単位のデータ取得（CMS docs/04 §12 の `queries`）。
 *
 * セクションごとに取得・検証し、失敗したセクションだけを欠けさせる。
 * 失敗は reportCmsError に送る（ページ全体は壊さない / CMS docs/04 §13）。
 */

import { CmsError, PreviewTokenError, type CmsClient } from "./client";
import { DEFAULT_PAGE_VISIBILITY, type OptionalPageKey, type PageVisibility } from "../../config/pages";
import type { DeliveryEntry } from "./contracts";
import {
  mapAbout,
  mapContactPage,
  mapFaq,
  mapHome,
  mapJobPosition,
  mapPageVisibility,
  mapMember,
  mapRecruit,
  mapService,
  mapServiceCase,
  mapServicePage,
  mapSiteInfo,
  mapTopic,
  mapTopicDetail,
  mapWork,
  mapWorkDetail,
  type MapError,
  type MapResult,
} from "./mapper";
import { TOPIC_CATEGORIES, WORK_TAGS } from "./schemas";
import type {
  AboutContent,
  ContactForm,
  ContactPageContent,
  Faq,
  HomeContent,
  JobPosition,
  Member,
  RecruitContent,
  RtBlock,
  Service,
  ServiceCase,
  SiteInfo,
  Topic,
  TopicCategory,
  TopicDetail,
  TopPageData,
  Work,
  WorkDetail,
  WorkTag,
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
    // プレビューの期限切れは一部を欠けさせずにページ全体で知らせる（middleware が表示する）
    if (err instanceof PreviewTokenError) throw err;
    report(`failed to load ${label}`, err);
    return fallback;
  }
}

export async function getTopPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<TopPageData> {
  const [siteInfo, home] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "ami_home", mapHome, report),
  ]);

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

  return { siteInfo, home, services, topics, members };
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

/**
 * 会社名・SEO の既定値と、ページの表示設定。site_info を取得できなければ null（ページ側でタイトルだけにする）。
 * ページの表示設定はどのページでもフッターに要るため、ここでまとめて読む。
 */
export async function getSiteInfo(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<SiteInfo | null> {
  const [info, pageVisibility] = await Promise.all([
    loadSingleton(client, "site_info", mapSiteInfo, report),
    getPageVisibility(client, report),
  ]);
  return info ? { ...info, pageVisibility } : null;
}

/**
 * ページの表示設定（ami_page_visibility / ADR-035）。まだ作られていない（404）・読めないときは既定（すべて非表示）。
 * 作られていないのは運用上ふつうのことなので報告しない。
 */
export async function getPageVisibility(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<PageVisibility> {
  try {
    const r = mapPageVisibility(await client.getSingleton("ami_page_visibility"));
    if (r.ok) return r.value;
    report("entry failed validation", r.error);
  } catch (err) {
    if (err instanceof PreviewTokenError) throw err;
    if (!(err instanceof CmsError && err.status === 404)) report("failed to load ami_page_visibility", err);
  }
  return DEFAULT_PAGE_VISIBILITY;
}

/** そのページを表示しているか。site_info が取れないときも、表示設定が無いときも非表示として扱う。 */
export function isPageVisible(siteInfo: Pick<SiteInfo, "pageVisibility"> | null, page: OptionalPageKey): boolean {
  return (siteInfo?.pageVisibility ?? DEFAULT_PAGE_VISIBILITY)[page];
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
  /** 地球の下の案内文（ami_service_page.lead） */
  lead: string | null;
  services: Service[];
  /** 事業（ami_services）の id → Case Study（表示順） */
  casesByService: Map<string, ServiceCase[]>;
}

/** SERVICE ページの Case Study の上限。 */
const SERVICE_CASES_LIMIT = 50;

export async function getServicePageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<ServicePageData> {
  const [siteInfo, page, cases, services] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "ami_service_page", mapServicePage, report),
    safely(
      "ami_service_cases",
      [],
      async () =>
        collect(
          (await client.getCollection("ami_service_cases", { sort: "sort_order", limit: SERVICE_CASES_LIMIT })).data,
          (e) => mapServiceCase(e, report),
          report,
        ),
      report,
    ),
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
  const casesByService = new Map<string, ServiceCase[]>();
  for (const c of cases) {
    if (!c.serviceId) continue;
    casesByService.set(c.serviceId, [...(casesByService.get(c.serviceId) ?? []), c]);
  }
  return { siteInfo, lead: page?.lead ?? null, services, casesByService };
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

/** TOPICS 一覧の「Pick UP!」に並べる上限。 */
const PICKUP_LIMIT = 5;

export interface TopicsArchiveData {
  siteInfo: SiteInfo | null;
  topics: Topic[];
  /** 「Pick UP!」（一覧の 1 ページ目・分類なしのときだけ取得する。新しい順） */
  pickups: Topic[];
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
  const showPickups = category === null && page === 1;
  const [siteInfo, list, pickups] = await Promise.all([
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
    showPickups
      ? safely(
          "ami_topics (pickup)",
          [],
          async () =>
            collect(
              (await client.getCollection("ami_topics", { sort: "-published_date", limit: PICKUP_LIMIT, filter: { pickup: "true" } })).data,
              mapTopic,
              report,
            ),
          report,
        )
      : Promise.resolve([]),
  ]);
  const totalPages = list?.meta.totalPages ?? 1;
  if (page > 1 && page > totalPages) return null;
  return { siteInfo, topics: list ? collect(list.data, mapTopic, report) : [], pickups, category, page, totalPages };
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
  /** 会社概要（代表・設立・資本金・事業内容） */
  about: AboutContent | null;
  /** 取得できなければ null（フォームを出さない）。 */
  form: ContactForm | null;
}

export async function getContactPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<ContactPageData> {
  const [siteInfo, contactPage, about, form] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "contact_page", (e) => mapContactPage(e, report), report),
    loadSingleton(client, "about", (e) => mapAbout(e, report), report),
    safely<ContactForm | null>("form " + CONTACT_FORM_KEY, null, () => client.getForm(CONTACT_FORM_KEY), report),
  ]);
  return { siteInfo, contactPage, about, form };
}

export interface PrivacyPageData {
  siteInfo: SiteInfo | null;
  /** contact_page.privacy_note（CONTACT のフォームに出す文章と同じもの）。空なら []。 */
  privacyNote: RtBlock[];
}

/** プライバシーポリシー。本文は CONTACT と同じ contact_page.privacy_note を使う。 */
export async function getPrivacyPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<PrivacyPageData> {
  const [siteInfo, contactPage] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "contact_page", (e) => mapContactPage(e, report), report),
  ]);
  return { siteInfo, privacyNote: contactPage?.privacyNote ?? [] };
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

/** FAQ ページに並べる上限。 */
const FAQ_LIMIT = 100;

export interface FaqPageData {
  siteInfo: SiteInfo | null;
  /** 表示順（sort_order の昇順）。 */
  faqs: Faq[];
}

export async function getFaqPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<FaqPageData> {
  const [siteInfo, faqs] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "faq",
      [],
      async () =>
        collect((await client.getCollection("faq", { sort: "sort_order", limit: FAQ_LIMIT })).data, (e) => mapFaq(e, report), report),
      report,
    ),
  ]);
  return { siteInfo, faqs };
}

// ---------------------------------------------------------------------------
// RECRUIT
// ---------------------------------------------------------------------------

/** RECRUIT ページに並べる職種の上限。 */
const JOB_POSITIONS_LIMIT = 50;

export interface RecruitPageData {
  siteInfo: SiteInfo | null;
  recruit: RecruitContent | null;
  /** 募集中の職種（is_open が false のものは除く）。新しい順。 */
  positions: JobPosition[];
}

export async function getRecruitPageData(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<RecruitPageData> {
  const [siteInfo, recruit, positions] = await Promise.all([
    getSiteInfo(client, report),
    loadSingleton(client, "recruit", (e) => mapRecruit(e, report), report),
    safely(
      "job_positions",
      [],
      async () =>
        collect(
          (await client.getCollection("job_positions", { sort: "-publishedAt", limit: JOB_POSITIONS_LIMIT })).data,
          (e) => mapJobPosition(e, report),
          report,
        ),
      report,
    ),
  ]);
  return { siteInfo, recruit, positions: positions.filter((p) => p.isOpen) };
}

// ---------------------------------------------------------------------------
// WORKS
// ---------------------------------------------------------------------------

export const WORKS_PER_PAGE = 12;

export function isWorkTag(value: string | undefined): value is WorkTag {
  return (WORK_TAGS as readonly string[]).includes(value ?? "");
}

export interface WorksArchiveData {
  siteInfo: SiteInfo | null;
  works: Work[];
  tag: WorkTag | null;
  page: number;
  totalPages: number;
}

/** WORKS 一覧（公開日の新しい順）。page が範囲外なら null（404 にする）。 */
export async function getWorksArchive(
  client: CmsClient,
  options: { tag: WorkTag | null; page: number },
  report: CmsErrorReporter = reportCmsError,
): Promise<WorksArchiveData | null> {
  const { tag, page } = options;
  const [siteInfo, list] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "works",
      null,
      () =>
        client.getCollection("works", {
          sort: "-published_date",
          limit: WORKS_PER_PAGE,
          page,
          filter: tag ? { tags: tag } : undefined,
        }),
      report,
    ),
  ]);
  const totalPages = list?.meta.totalPages ?? 1;
  if (page > 1 && page > totalPages) return null;
  return { siteInfo, works: list ? collect(list.data, mapWork, report) : [], tag, page, totalPages };
}

export interface WorkDetailData {
  siteInfo: SiteInfo | null;
  work: WorkDetail;
  /** 下に並べるほかの実績（この実績を除く）。 */
  others: Work[];
}

/** WORKS 詳細。無い・非公開なら null（404 にする）。 */
export async function getWorkDetail(
  client: CmsClient,
  slug: string,
  report: CmsErrorReporter = reportCmsError,
): Promise<WorkDetailData | null> {
  const entry = await client.getEntry("works", slug);
  if (!entry) return null;
  const r = mapWorkDetail(entry, report);
  if (!r.ok) {
    report("entry failed validation", r.error);
    return null;
  }
  const [siteInfo, others] = await Promise.all([
    getSiteInfo(client, report),
    safely(
      "works",
      [],
      async () => collect((await client.getCollection("works", { sort: "-published_date", limit: 4 })).data, mapWork, report),
      report,
    ),
  ]);
  return { siteInfo, work: r.value, others: others.filter((w) => w.id !== r.value.id).slice(0, 3) };
}

/** 静的書き出し（GitHub Pages のプレビュー）用: すべての実績。 */
export async function getAllWorks(client: CmsClient, report: CmsErrorReporter = reportCmsError): Promise<Work[]> {
  const out: Work[] = [];
  for (let page = 1; ; page++) {
    const res = await client.getCollection("works", { sort: "-published_date", limit: 100, page });
    out.push(...collect(res.data, mapWork, report));
    if (page >= res.meta.totalPages) return out;
  }
}
