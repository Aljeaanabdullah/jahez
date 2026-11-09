import "server-only";
import ExcelJS from "exceljs";
import type { Lang } from "./i18n";
import { detailRows, recordLabels, type EmployeeRecord } from "./employee-record";

/** Excel workbook: details, punches and requests sheets (right-to-left in Arabic). */
export async function recordToXlsx(record: EmployeeRecord, lang: Lang): Promise<Buffer> {
  const L = recordLabels(lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jahez";
  const view = [{ rightToLeft: lang === "ar" }];
  const header = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
  };

  const info = wb.addWorksheet(L.info, { views: view });
  info.columns = [
    { header: L.info, width: 24 },
    { header: "", width: 48 },
  ];
  header(info);
  detailRows(record, lang).forEach((r) => info.addRow(r));
  info.addRow([L.exportedAt, record.exportedAt]);

  const punches = wb.addWorksheet(L.punches, { views: view });
  punches.columns = (Object.keys(L.punchCols) as (keyof typeof L.punchCols)[]).map((k) => ({
    header: L.punchCols[k],
    key: k,
    width: k === "reason" ? 30 : 16,
  }));
  header(punches);
  record.punches.forEach((p) => punches.addRow(p));

  const requests = wb.addWorksheet(L.requests, { views: view });
  requests.columns = (Object.keys(L.requestCols) as (keyof typeof L.requestCols)[]).map((k) => ({
    header: L.requestCols[k],
    key: k,
    width: k === "reason" ? 40 : 18,
  }));
  header(requests);
  record.requests.forEach((r) => requests.addRow(r));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
