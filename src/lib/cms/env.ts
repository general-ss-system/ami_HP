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
export function getCmsClient(): CmsClient {
  if (CMS_MODE === "fixture") return createFixtureClient();
  if (!CMS_BASE_URL || !CMS_SITE_KEY || !CMS_DELIVERY_KEY) {
    throw new Error("CMS_MODE=live requires CMS_BASE_URL, CMS_SITE_KEY and CMS_DELIVERY_KEY");
  }
  return createCmsClient({ baseUrl: CMS_BASE_URL, siteKey: CMS_SITE_KEY, deliveryKey: CMS_DELIVERY_KEY });
}
