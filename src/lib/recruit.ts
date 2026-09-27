/**
 * RECRUIT の表示用の値。
 */

import type { EmploymentType } from "./cms/types";

/** 雇用形態の表示名（CMS の job_positions.employment_type の選択肢の label と同じ）。 */
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "アルバイト",
  intern: "インターン",
};
