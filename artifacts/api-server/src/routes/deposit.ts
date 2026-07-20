import { Router, type IRouter } from "express";
import { db, depositMethodsTable, notificationsTable, beneficiariesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /beneficiaries/:id/deposit-methods — get deposit methods for a beneficiary
router.get("/beneficiaries/:id/deposit-methods", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(depositMethodsTable)
      .where(eq(depositMethodsTable.beneficiaryId, id))
      .limit(1);
    res.json(row ?? null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل بيانات الإيداع" });
  }
});

// PUT /beneficiaries/:id/deposit-methods — admin sets deposit methods
router.put("/beneficiaries/:id/deposit-methods", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body as {
      bankAccountName?: string;
      bankIban?: string;
      bankName?: string;
      usdtWalletAddress?: string;
      usdtNetwork?: string;
    };

    const [existing] = await db
      .select()
      .from(depositMethodsTable)
      .where(eq(depositMethodsTable.beneficiaryId, id))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(depositMethodsTable)
        .set({
          bankAccountName: body.bankAccountName ?? existing.bankAccountName,
          bankIban: body.bankIban ?? existing.bankIban,
          bankName: body.bankName ?? existing.bankName,
          usdtWalletAddress: body.usdtWalletAddress ?? existing.usdtWalletAddress,
          usdtNetwork: body.usdtNetwork ?? existing.usdtNetwork,
        })
        .where(eq(depositMethodsTable.beneficiaryId, id))
        .returning();
    } else {
      [row] = await db
        .insert(depositMethodsTable)
        .values({
          beneficiaryId: id,
          bankAccountName: body.bankAccountName ?? "",
          bankIban: body.bankIban ?? "",
          bankName: body.bankName ?? "",
          usdtWalletAddress: body.usdtWalletAddress ?? "",
          usdtNetwork: body.usdtNetwork ?? "",
        })
        .returning();
    }

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حفظ بيانات الإيداع" });
  }
});

// POST /beneficiaries/:id/deposit-request — beneficiary requests deposit info
router.post("/beneficiaries/:id/deposit-request", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { method } = req.body as { method: "bank" | "usdt" };

    const [beneficiary] = await db
      .select()
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.id, id))
      .limit(1);

    if (!beneficiary) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }

    const methodLabel = method === "bank" ? "إيداع بنكي" : "عملة USDT";

    // Notify admin (stored as a special notification type for admin awareness)
    await db.insert(notificationsTable).values({
      beneficiaryId: id,
      type: "deposit_request",
      title: `طلب إيداع جديد — ${methodLabel}`,
      message: `العميل ${beneficiary.name} (@${beneficiary.username}) يطلب بيانات الإيداع عبر ${methodLabel}.\n\nيرجى إرسال بيانات الإيداع المناسبة للعميل في أقرب وقت ممكن.`,
      isRead: false,
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إرسال طلب الإيداع" });
  }
});

export default router;
