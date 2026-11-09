import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPrefs } from "@/lib/prefs";
import { loadEmployeeRecord } from "@/lib/employee-record";
import { recordToXlsx } from "@/lib/export-xlsx";
import { recordToPdf } from "@/lib/export-pdf";

// GET /employees/<id>/export/xlsx  or  /pdf
// Admin only. Each download is written to the audit log; end of service requires both.
export async function GET(_req: Request, ctx: RouteContext<"/employees/[id]/export/[format]">) {
  const me = await requireAdmin();
  const { id, format } = await ctx.params;
  if (format !== "xlsx" && format !== "pdf") return new Response("Not found", { status: 404 });

  const { lang } = await getPrefs();
  const supabase = await createClient();
  const record = await loadEmployeeRecord(supabase, id, lang);
  if (!record) return new Response("Not found", { status: 404 });

  const body = format === "xlsx" ? await recordToXlsx(record, lang) : await recordToPdf(record, lang);

  await createAdminClient().from("audit_log").insert({
    actor_user_id: me.userId,
    action: `export_${format}`,
    table_name: "employees",
    record_id: id,
    new_data: { file_number: record.employee.file_number },
  });

  const file = `jahez-employee-${record.employee.file_number}.${format}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
