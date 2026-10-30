import { Router, type IRouter } from "express";
import { db, notificationsTable, beneficiariesTable, financialTransactionsTable, agentsTable, auditLogsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";

const router: IRouter = Router();

async function logAudit(params: {
  action: string;
  performedBy: string;
  performerId?: number | null;
  targetType: string;
  targetId?: number | null;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogsTable).values({
      action: params.action,
      performedBy: params.performedBy,
      performerId: params.performerId ?? null,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      details: params.details ? JSON.stringify(params.details) : null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

async function verifyAgentPermission(
  agentId: number | undefined,
  requiredPerm: "canManageProfits" | "canManageFees" | "canPayFees" | "canSendNotifications"
): Promise<{ allowed: boolean; agent?: any; error?: string }> {
  if (!agentId) return { allowed: true };
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
  if (!agent) return { allowed: false, error: "الوكيل غير موجود" };
  if (agent.status !== "active") return { allowed: false, error: "حساب الوكيل مجمّد أو معطّل" };
  if (!agent[requiredPerm]) return { allowed: false, error: `ليس لدى الوكيل صلاحية لإتمام هذه العملية (${requiredPerm})` };
  return { allowed: true, agent };
}

async function logTransaction(
  beneficiaryId: number,
  type: string,
  amount: string,
  description: string,
) {
  await db.insert(financialTransactionsTable).values({
    beneficiaryId,
    type,
    amount,
    description,
  });
}

router.get("/beneficiaries/:id/notifications", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.beneficiaryId, id))
      .orderBy(notificationsTable.createdAt);
    res.json(rows.reverse());
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل الإشعارات" });
  }
});

router.get("/beneficiaries/:id/transactions", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.beneficiaryId, id))
      .orderBy(financialTransactionsTable.createdAt);
    res.json(rows.reverse());
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل سجل العمليات" });
  }
});

router.put("/notifications/:id/read", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "الإشعار غير موجود" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث الإشعار" });
  }
});

router.put("/notifications/read-all/:beneficiaryId", async (req, res): Promise<void> => {
  try {
    const beneficiaryId = Number(req.params.beneficiaryId);
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.beneficiaryId, beneficiaryId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث الإشعارات" });
  }
});

router.post("/beneficiaries/:id/add-profits", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { amount, editorAgentId } = req.body as { amount: number; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canManageProfits");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const currentProfits = parseInt(current.profits.replace(/,/g, ""), 10) || 0;
    const newProfits = currentProfits + amount;
    const formatted = newProfits.toLocaleString("en-US");

    const [updated] = await db
      .update(beneficiariesTable)
      .set({ profits: formatted })
      .where(eq(beneficiariesTable.id, id))
      .returning();

    const message = `تم إضافة أرباح جديدة إلى حسابكم\n\nقيمة الأرباح المضافة:\n${amount.toLocaleString("en-US")} ر.س\n\nإجمالي الأرباح الحالي:\n${formatted} ر.س`;
    await db.insert(notificationsTable).values({
      beneficiaryId: id,
      type: "profits_added",
      title: "إضافة أرباح جديدة",
      message,
      isRead: false,
    });

    await logTransaction(id, "add_profits", String(amount), `إضافة أرباح: ${amount.toLocaleString("en-US")} ر.س`);

    await logAudit({
      action: "add_profits",
      performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
      performerId: editorAgentId ?? null,
      targetType: "beneficiary",
      targetId: id,
      details: { amount, newProfits: formatted },
    });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إضافة الأرباح" });
  }
});

router.post("/beneficiaries/:id/add-fees", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { amount, editorAgentId } = req.body as { amount: number; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canManageFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const currentFees = parseInt(current.fees.replace(/,/g, ""), 10) || 0;
    const newFees = currentFees + amount;
    const formatted = newFees.toLocaleString("en-US");

    const [updated] = await db
      .update(beneficiariesTable)
      .set({ fees: formatted, withdrawalFeeStatus: "unpaid" })
      .where(eq(beneficiariesTable.id, id))
      .returning();

    await logTransaction(id, "add_fees", String(amount), `إضافة رسوم سحب: ${amount.toLocaleString("en-US")} ر.س`);

    await logAudit({
      action: "add_fees",
      performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
      performerId: editorAgentId ?? null,
      targetType: "beneficiary",
      targetId: id,
      details: { amount, newFees: formatted },
    });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إضافة الرسوم" });
  }
});

router.post("/beneficiaries/:id/pay-fees", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { paidAmount, editorAgentId } = req.body as { paidAmount?: number | string; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canPayFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const paidAt = new Date();
    const currentNum = parseFloat(String(current.fees).replace(/,/g, "")) || 0;
    const paidNum = paidAmount !== undefined && paidAmount !== null ? parseFloat(String(paidAmount).replace(/,/g, "")) : currentNum;

    if (isNaN(paidNum) || paidNum <= 0) {
      res.status(400).json({ error: "يرجى إدخال مبلغ سداد صحيح" });
      return;
    }

    if (paidNum < currentNum) {
      // Partial payment
      const remainingNum = Math.max(0, currentNum - paidNum);
      const formattedRemaining = remainingNum.toLocaleString("en-US");
      const formattedPaid = paidNum.toLocaleString("en-US");

      const [updated] = await db
        .update(beneficiariesTable)
        .set({ fees: formattedRemaining, withdrawalFeeStatus: "partial", withdrawalFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = `عزيزي المستثمر / ${current.name} 💳 تم استلام دفعة سداد بمبلغ ${formattedPaid} ر.س لرسوم السحب.\n\nالمبلغ المتبقي المطلوب عليكم لاستكمال العملية هو ${formattedRemaining} ر.س.`;
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "fees_paid_partial",
        title: "إشعار سداد جزئي - رسوم السحب",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_withdrawal_fees_partial", String(paidNum), `سداد جزئي لرسوم السحب: تم سداد ${formattedPaid} ر.س (المتبقي: ${formattedRemaining} ر.س)`);

      await logAudit({
        action: "pay_withdrawal_fees_partial",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: paidNum, remaining: remainingNum },
      });

      res.json(updated);
    } else {
      // Full payment
      const formattedPaid = currentNum.toLocaleString("en-US");
      const [updated] = await db
        .update(beneficiariesTable)
        .set({ fees: "0", withdrawalFeeStatus: "paid", withdrawalFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = "تم سداد كامل رسوم السحب الخاصة بحسابكم بنجاح.\n\nسيتم تحرير الحساب وتفعيل السحب خلال 24 ساعة.";
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "fees_paid",
        title: "تم سداد رسوم السحب بالكامل",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_withdrawal_fees", String(currentNum), `تأكيد سداد رسوم السحب بالكامل: ${formattedPaid} ر.س`);

      await logAudit({
        action: "pay_withdrawal_fees_full",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: currentNum },
      });

      res.json(updated);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل سداد الرسوم" });
  }
});

router.post("/beneficiaries/:id/add-liberation-fee", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { amount, editorAgentId } = req.body as { amount: number; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canManageFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const formatted = Number(amount).toLocaleString("en-US");
    const [updated] = await db
      .update(beneficiariesTable)
      .set({ liberationFee: formatted, liberationFeeStatus: "unpaid" })
      .where(eq(beneficiariesTable.id, id))
      .returning();

    await logTransaction(id, "add_liberation_fee", String(amount), `إضافة رسوم تحرير الأرباح: ${formatted} ر.س`);

    await logAudit({
      action: "add_liberation_fee",
      performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
      performerId: editorAgentId ?? null,
      targetType: "beneficiary",
      targetId: id,
      details: { amount },
    });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إضافة رسوم التحرير" });
  }
});

router.post("/beneficiaries/:id/pay-liberation-fee", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { paidAmount, editorAgentId } = req.body as { paidAmount?: number | string; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canPayFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const paidAt = new Date();
    const currentNum = parseFloat(String(current.liberationFee).replace(/,/g, "")) || 0;
    const paidNum = paidAmount !== undefined && paidAmount !== null ? parseFloat(String(paidAmount).replace(/,/g, "")) : currentNum;

    if (isNaN(paidNum) || paidNum <= 0) {
      res.status(400).json({ error: "يرجى إدخال مبلغ سداد صحيح" });
      return;
    }

    if (paidNum < currentNum) {
      // Partial payment
      const remainingNum = Math.max(0, currentNum - paidNum);
      const formattedRemaining = remainingNum.toLocaleString("en-US");
      const formattedPaid = paidNum.toLocaleString("en-US");

      const [updated] = await db
        .update(beneficiariesTable)
        .set({ liberationFee: formattedRemaining, liberationFeeStatus: "partial", liberationFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = `عزيزي العميل / ${current.name} 🚨 تم استلام دفعة سداد بمبلغ ${formattedPaid} ر.س لرسوم تحرير الأرباح ✅\n\nالمبلغ المتبقي المطلوب عليكم لاستكمال تحرير الأرباح هو ${formattedRemaining} ر.س.`;
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "liberation_fee_paid_partial",
        title: "إشعار سداد جزئي - رسوم تحرير الأرباح",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_liberation_fee_partial", String(paidNum), `سداد جزئي لرسوم تحرير الأرباح: تم سداد ${formattedPaid} ر.س (المتبقي: ${formattedRemaining} ر.س)`);

      await logAudit({
        action: "pay_liberation_fee_partial",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: paidNum, remaining: remainingNum },
      });

      res.json(updated);
    } else {
      // Full payment
      const formattedPaid = currentNum.toLocaleString("en-US");
      const [updated] = await db
        .update(beneficiariesTable)
        .set({ liberationFee: "0", liberationFeeStatus: "paid", liberationFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = `عزيز العميل / ${current.name} 🚨 تم تأكيد سداد كامل رسوم تحرير الأرباح بنجاح ✅\n يرجى الإنتظار سوف يقوم النظام\n بتحرير الأرباح خلال أقل من 24 ساعة\nويتم تحرير أرباحك بنجاح ✅`;
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "liberation_fee_paid",
        title: "تم تأكيد سداد رسوم تحرير الأرباح بالكامل",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_liberation_fee", String(currentNum), `تأكيد سداد رسوم تحرير الأرباح بالكامل: ${formattedPaid} ر.س`);

      await logAudit({
        action: "pay_liberation_fee_full",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: currentNum },
      });

      res.json(updated);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تأكيد سداد رسوم التحرير" });
  }
});

router.post("/beneficiaries/:id/add-transaction-fee", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { amount, editorAgentId } = req.body as { amount: number; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canManageFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const formatted = Number(amount).toLocaleString("en-US");
    const [updated] = await db
      .update(beneficiariesTable)
      .set({ transactionFee: formatted, transactionFeeStatus: "unpaid" })
      .where(eq(beneficiariesTable.id, id))
      .returning();

    await logTransaction(id, "add_transaction_fee", String(amount), `إضافة مبلغ المعاملة: ${formatted} ر.س`);

    await logAudit({
      action: "add_transaction_fee",
      performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
      performerId: editorAgentId ?? null,
      targetType: "beneficiary",
      targetId: id,
      details: { amount },
    });

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إضافة مبلغ المعاملة" });
  }
});

router.post("/beneficiaries/:id/pay-transaction-fee", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { paidAmount, editorAgentId } = req.body as { paidAmount?: number | string; editorAgentId?: number };

    const perm = await verifyAgentPermission(editorAgentId, "canPayFees");
    if (!perm.allowed) { res.status(403).json({ error: perm.error }); return; }

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    const paidAt = new Date();
    const currentNum = parseFloat(String(current.transactionFee).replace(/,/g, "")) || 0;
    const paidNum = paidAmount !== undefined && paidAmount !== null ? parseFloat(String(paidAmount).replace(/,/g, "")) : currentNum;

    if (isNaN(paidNum) || paidNum <= 0) {
      res.status(400).json({ error: "يرجى إدخال مبلغ سداد صحيح" });
      return;
    }

    if (paidNum < currentNum) {
      // Partial payment
      const remainingNum = Math.max(0, currentNum - paidNum);
      const formattedRemaining = remainingNum.toLocaleString("en-US");
      const formattedPaid = paidNum.toLocaleString("en-US");

      const [updated] = await db
        .update(beneficiariesTable)
        .set({ transactionFee: formattedRemaining, transactionFeeStatus: "partial", transactionFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = `عزيزي العميل / ${current.name} 🚨 تم استلام دفعة سداد بمبلغ ${formattedPaid} ر.س لمبلغ المعاملة ✅\n\nالمبلغ المتبقي المطلوب لاستكمال تحويل الأرباح هو ${formattedRemaining} ر.س.`;
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "transaction_fee_paid_partial",
        title: "إشعار سداد جزئي - مبلغ المعاملة",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_transaction_fee_partial", String(paidNum), `سداد جزئي لمبلغ المعاملة: تم سداد ${formattedPaid} ر.س (المتبقي: ${formattedRemaining} ر.س)`);

      await logAudit({
        action: "pay_transaction_fee_partial",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: paidNum, remaining: remainingNum },
      });

      res.json(updated);
    } else {
      // Full payment
      const formattedPaid = currentNum.toLocaleString("en-US");
      const [updated] = await db
        .update(beneficiariesTable)
        .set({ transactionFee: "0", transactionFeeStatus: "paid", transactionFeePaidAt: paidAt })
        .where(eq(beneficiariesTable.id, id))
        .returning();

      const message = `عزيز العميل / ${current.name} 🚨 تم تأكيد دفع كامل معاملة تأكيد تحويل الأرباح بنجاح ✅\n يرجى الإنتظار سوف يقوم النظام\n بإتمام عملية سحب الأرباح خلال أقل من 24 ساعة\nويتم سحب أرباحك بنجاح ✅\nنشكر تفهمكم و تعاونكم معنا`;
      await db.insert(notificationsTable).values({
        beneficiaryId: id,
        type: "transaction_fee_paid",
        title: "تم تأكيد دفع مبلغ المعاملة بالكامل",
        message,
        isRead: false,
      });

      await logTransaction(id, "pay_transaction_fee", String(currentNum), `تأكيد سداد مبلغ المعاملة بالكامل: ${formattedPaid} ر.س`);

      await logAudit({
        action: "pay_transaction_fee_full",
        performedBy: perm.agent ? `وكيل: ${perm.agent.name}` : "مدير النظام",
        performerId: editorAgentId ?? null,
        targetType: "beneficiary",
        targetId: id,
        details: { paidAmount: currentNum },
      });

      res.json(updated);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تأكيد سداد مبلغ المعاملة" });
  }
});

router.delete("/transactions/:id/undo", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const [tx] = await db
      .select()
      .from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.id, id))
      .limit(1);

    if (!tx) { res.status(404).json({ error: "العملية غير موجودة" }); return; }

    const [current] = await db
      .select()
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.id, tx.beneficiaryId))
      .limit(1);

    if (!current) { res.status(404).json({ error: "المستفيد غير موجود" }); return; }

    type BeneficiaryUpdate = {
      profits?: string;
      fees?: string;
      withdrawalFeeStatus?: string;
      withdrawalFeePaidAt?: Date | null;
      liberationFee?: string;
      liberationFeeStatus?: string;
      liberationFeePaidAt?: Date | null;
      transactionFee?: string;
      transactionFeeStatus?: string;
      transactionFeePaidAt?: Date | null;
    };

    let updateData: BeneficiaryUpdate = {};

    switch (tx.type) {
      case "add_profits": {
        const amt = parseFloat(tx.amount) || 0;
        const cur = parseInt(current.profits.replace(/,/g, ""), 10) || 0;
        const next = Math.max(0, cur - amt);
        updateData = { profits: next.toLocaleString("en-US") };
        break;
      }
      case "add_fees": {
        const amt = parseFloat(tx.amount) || 0;
        const cur = parseInt(current.fees.replace(/,/g, ""), 10) || 0;
        const next = Math.max(0, cur - amt);
        updateData = { fees: next === 0 ? "0" : next.toLocaleString("en-US") };
        break;
      }
      case "pay_withdrawal_fees": {
        updateData = {
          withdrawalFeeStatus: "unpaid",
          withdrawalFeePaidAt: null,
          fees: tx.amount,
        };
        break;
      }
      case "add_liberation_fee": {
        updateData = { liberationFee: "0", liberationFeeStatus: "unpaid" };
        break;
      }
      case "pay_liberation_fee": {
        updateData = { liberationFeeStatus: "unpaid", liberationFeePaidAt: null };
        break;
      }
      case "add_transaction_fee": {
        updateData = { transactionFee: "0", transactionFeeStatus: "unpaid" };
        break;
      }
      case "pay_transaction_fee": {
        updateData = { transactionFeeStatus: "unpaid", transactionFeePaidAt: null };
        break;
      }
    }

    let updatedBeneficiary = current;
    if (Object.keys(updateData).length > 0) {
      const [updated] = await db
        .update(beneficiariesTable)
        .set(updateData)
        .where(eq(beneficiariesTable.id, tx.beneficiaryId))
        .returning();
      updatedBeneficiary = updated;
    }

    await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, id));

    const notifTypeMap: Record<string, string> = {
      add_profits: "profits_added",
      pay_withdrawal_fees: "fees_paid",
      pay_liberation_fee: "liberation_fee_paid",
      pay_transaction_fee: "transaction_fee_paid",
    };

    const notifType = notifTypeMap[tx.type];
    if (notifType) {
      const [latestNotif] = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.beneficiaryId, tx.beneficiaryId),
            eq(notificationsTable.type, notifType),
            eq(notificationsTable.isRead, false),
          ),
        )
        .orderBy(desc(notificationsTable.createdAt))
        .limit(1);

      if (latestNotif) {
        await db.delete(notificationsTable).where(eq(notificationsTable.id, latestNotif.id));
      }
    }

    res.json({ beneficiary: updatedBeneficiary });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل التراجع عن العملية" });
  }
});

export default router;
