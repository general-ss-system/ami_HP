/**
 * 環境変数から CMS クライアントを組み立てる。
 *
 * `astro:env` に依存する部分をここに分け、client.ts / queries.ts を単体テストできるようにしている。
 */

import { CMS_BASE_URL, CMS_DELIVERY_KEY, CMS_MODE, CMS_SITE_KEY } from "astro:env/server";
import { createCmsClient, type CmsClient } from "./client";
import { createFixtureClient } from "./fixture-client";

export type CmsMode = "fixture" | "live";

export function getCmsMode(): CmsMode {
  return CMS_MODE;
}

/** fixture なら仮データ、live なら Delivery API。live で設定が欠けていれば設定ミスとして落とす。 */
/**
 * フォームの送信先（Form API）。ブラウザから直接送る。
 * fixture では null（送信せずに完了まで進める、制作中の確認用）。
 */
export function getFormSubmissionEndpoint(formKey: string): string | null {
  if (CMS_MODE === "fixture") return null;
  if (!CMS_BASE_URL || !CMS_SITE_KEY) {
    throw new Error("CMS_MODE=live requires CMS_BASE_URL and CMS_SITE_KEY");
  }
  const base = CMS_BASE_URL.replace(/\/+$/, "");
  return `${base}/api/v1/forms/${encodeURIComponent(CMS_SITE_KEY)}/${encodeURIComponent(formKey)}/submissions`;
}

export function getCmsClient(): CmsClient {
  if (CMS_MODE === "fixture") return createFixtureClient();
  if (!CMS_BASE_URL || !CMS_SITE_KEY || !CMS_DELIVERY_KEY) {
    throw new Error("CMS_MODE=live requires CMS_BASE_URL, CMS_SITE_KEY and CMS_DELIVERY_KEY");
  }
  return createCmsClient({ baseUrl: CMS_BASE_URL, siteKey: CMS_SITE_KEY, deliveryKey: CMS_DELIVERY_KEY });
}
