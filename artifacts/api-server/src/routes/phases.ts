import { Router, type IRouter } from "express";
import { db, customPhasesTable, userCustomPhasesTable, beneficiariesTable, notificationsTable, financialTransactionsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router: IRouter = Router();

/* ── Global Phase Definitions ───────────────────────────────── */

router.get("/phases", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(customPhasesTable).orderBy(asc(customPhasesTable.sortOrder));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل المراحل" });
  }
});

router.post("/phases", async (req, res): Promise<void> => {
  try {
    const { name, failureMessage, failureTitle, cardColor, sortOrder } = req.body as {
      name: string;
      failureMessage: string;
      failureTitle?: string;
      cardColor?: string;
      sortOrder?: number;
    };
    if (!name || !failureMessage) {
      res.status(400).json({ error: "الاسم ورسالة الفشل مطلوبان" });
      return;
    }
    const [row] = await db.insert(customPhasesTable).values({
      name,
      failureMessage,
      failureTitle: failureTitle ?? null,
      cardColor: cardColor ?? null,
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إنشاء المرحلة" });
  }
});

router.put("/phases/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, failureMessage, failureTitle, cardColor, sortOrder } = req.body as {
      name?: string;
      failureMessage?: string;
      failureTitle?: string | null;
      cardColor?: string | null;
      sortOrder?: number;
    };
    const [row] = await db.update(customPhasesTable)
      .set({ name, failureMessage, failureTitle, cardColor, sortOrder })
      .where(eq(customPhasesTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "المرحلة غير موجودة" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث المرحلة" });
  }
});

router.delete("/phases/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.delete(userCustomPhasesTable).where(eq(userCustomPhasesTable.phaseId, id));
    await db.delete(customPhasesTable).where(eq(customPhasesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف المرحلة" });
  }
});

/* ── Per-user Phase Visibility (phases 2 & 3) ───────────────── */

router.patch("/beneficiaries/:id/phase-visibility", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { phase1Visible, phase2Visible, phase3Visible } = req.body as {
      phase1Visible?: boolean;
      phase2Visible?: boolean;
      phase3Visible?: boolean;
    };
    const updateData: Record<string, any> = {};
    if (phase1Visible !== undefined) updateData.phase1Visible = phase1Visible;
    if (phase2Visible !== undefined) updateData.phase2Visible = phase2Visible;
    if (phase3Visible !== undefined) updateData.phase3Visible = phase3Visible;
    const [row] = await db.update(beneficiariesTable).set(updateData).where(eq(beneficiariesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث الظهور" });
  }
});

/* ── Per-user Custom Phase Data ─────────────────────────────── */

router.get("/beneficiaries/:id/custom-phases", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const rows = await db.select().from(userCustomPhasesTable).where(eq(userCustomPhasesTable.userId, userId));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل بيانات المراحل" });
  }
});

router.patch("/beneficiaries/:id/custom-phases/:phaseId/visibility", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const phaseId = Number(req.params.phaseId);
    const { visible } = req.body as { visible: boolean };

    const existing = await db.select().from(userCustomPhasesTable)
      .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      [row] = await db.insert(userCustomPhasesTable).values({ userId, phaseId, visible, amount: "0", status: "unpaid" }).returning();
    } else {
      [row] = await db.update(userCustomPhasesTable).set({ visible })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();
    }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث ظهور المرحلة" });
  }
});

router.post("/beneficiaries/:id/custom-phases/:phaseId/set-amount", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const phaseId = Number(req.params.phaseId);
    const { amount } = req.body as { amount: number };
    const formatted = Number(amount).toLocaleString("en-US");

    const existing = await db.select().from(userCustomPhasesTable)
      .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      [row] = await db.insert(userCustomPhasesTable).values({ userId, phaseId, amount: formatted, status: "unpaid", visible: false }).returning();
    } else {
      [row] = await db.update(userCustomPhasesTable).set({ amount: formatted, status: "unpaid" })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();
    }

    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, phaseId)).limit(1);
    const [beneficiary] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, userId)).limit(1);

    if (phase && beneficiary) {
      await db.insert(financialTransactionsTable).values({
        beneficiaryId: userId,
        type: `add_custom_phase_${phaseId}`,
        amount: String(amount),
        description: `إضافة ${phase.name}: ${formatted} ر.س`,
      });
    }

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث مبلغ المرحلة" });
  }
});

router.post("/beneficiaries/:id/custom-phases/:phaseId/pay", async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const phaseId = Number(req.params.phaseId);
    const { paidAmount } = req.body as { paidAmount?: number | string };
    const paidAt = new Date();

    const existing = await db.select().from(userCustomPhasesTable)
      .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "لا توجد بيانات للمرحلة" });
      return;
    }

    const currentNum = parseFloat(String(existing[0].amount).replace(/,/g, "")) || 0;
    const paidNum = paidAmount !== undefined && paidAmount !== null ? parseFloat(String(paidAmount).replace(/,/g, "")) : currentNum;

    if (isNaN(paidNum) || paidNum <= 0) {
      res.status(400).json({ error: "يرجى إدخال مبلغ سداد صحيح" });
      return;
    }

    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, phaseId)).limit(1);
    const [beneficiary] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, userId)).limit(1);

    if (paidNum < currentNum) {
      // Partial payment
      const remainingNum = Math.max(0, currentNum - paidNum);
      const formattedRemaining = remainingNum.toLocaleString("en-US");
      const formattedPaid = paidNum.toLocaleString("en-US");

      const [row] = await db.update(userCustomPhasesTable).set({ amount: formattedRemaining, status: "partial", paidAt })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();

      if (phase && beneficiary) {
        const title = `إشعار سداد جزئي - ${phase.name}`;
        const message = `عزيزي المستثمر / ${beneficiary.name}، تم استلام دفعة سداد بمبلغ ${formattedPaid} ر.س لـ ${phase.name}.\n\nالمبلغ المتبقي المطلوب عليكم لاستكمال المرحلة هو ${formattedRemaining} ر.س.`;
        await db.insert(notificationsTable).values({
          beneficiaryId: userId,
          type: "phase_fee_paid_partial",
          title,
          message,
          isRead: false,
        });
        await db.insert(financialTransactionsTable).values({
          beneficiaryId: userId,
          type: `pay_custom_phase_${phaseId}_partial`,
          amount: String(paidNum),
          description: `سداد جزئي لـ ${phase.name}: تم سداد ${formattedPaid} ر.س (المتبقي: ${formattedRemaining} ر.س)`,
        });
      }

      res.json(row);
    } else {
      // Full payment
      const formattedPaid = currentNum.toLocaleString("en-US");
      const [row] = await db.update(userCustomPhasesTable).set({ amount: "0", status: "paid", paidAt })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();

      if (phase && beneficiary) {
        const title = phase.failureTitle ?? `تم تأكيد سداد كامل ${phase.name}`;
        const message = `عزيز العميل / ${beneficiary.name} ✅ ${title}\nيرجى الإنتظار سوف يقوم النظام بمعالجة طلبك خلال أقل من 24 ساعة`;
        await db.insert(notificationsTable).values({
          beneficiaryId: userId,
          type: "transaction_fee_paid",
          title,
          message,
          isRead: false,
        });
        await db.insert(financialTransactionsTable).values({
          beneficiaryId: userId,
          type: `pay_custom_phase_${phaseId}`,
          amount: String(currentNum),
          description: `تأكيد سداد ${phase.name} بالكامل: ${formattedPaid} ر.س`,
        });
      }

      res.json(row);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تأكيد السداد" });
  }
});

export default router;
