/**
 * ページ単位のデータ取得（CMS docs/04 §12 の `queries`）。
 *
 * セクションごとに取得・検証し、失敗したセクションだけを欠けさせる。
 * 失敗は reportCmsError に送る（ページ全体は壊さない / CMS docs/04 §13）。
 */

import type { CmsClient } from "./client";
import type { DeliveryEntry } from "./contracts";
import { mapHome, mapMember, mapService, mapTopic, type MapError, type MapResult } from "./mapper";
import type { TopPageData } from "./types";

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
