import { Router, type IRouter } from "express";
import {
  db,
  customPhasesTable,
  userCustomPhasesTable,
  beneficiariesTable,
  notificationsTable,
  financialTransactionsTable,
  agentsTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { logAudit } from "./agents";

const router: IRouter = Router();

/* ── Global Phase Definitions ───────────────────────────────── */

router.get("/phases", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(customPhasesTable).orderBy(asc(customPhasesTable.sortOrder));
    const userPhases = await db.select().from(userCustomPhasesTable);

    // Compute active users count per phase
    const countMap = new Map<number, number>();
    for (const up of userPhases) {
      if (up.phaseId) {
        countMap.set(Number(up.phaseId), (countMap.get(Number(up.phaseId)) || 0) + 1);
      }
    }

    const enriched = rows.map((p: any) => ({
      ...p,
      status: p.status || (p.isFrozen ? "frozen" : "active"),
      isFrozen: Boolean(p.isFrozen || p.status === "frozen"),
      defaultAmount: p.defaultAmount || "0",
      description: p.description || "",
      usersCount: countMap.get(Number(p.id)) || 0,
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل المراحل" });
  }
});

router.post("/phases", async (req, res): Promise<void> => {
  try {
    const { name, description, defaultAmount, failureMessage, failureTitle, cardColor, sortOrder } = req.body as {
      name: string;
      description?: string;
      defaultAmount?: string;
      failureMessage: string;
      failureTitle?: string;
      cardColor?: string;
      sortOrder?: number;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ error: "اسم المرحلة مطلوب" });
      return;
    }

    const [row] = await db
      .insert(customPhasesTable)
      .values({
        name: name.trim(),
        description: description?.trim() || "",
        defaultAmount: defaultAmount || "0",
        failureMessage: failureMessage?.trim() || `عذراً، يجب إتمام مرحلة ${name.trim()} لمتابعة السحب.`,
        failureTitle: failureTitle?.trim() || null,
        cardColor: cardColor ?? null,
        status: "active",
        isFrozen: false,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    await logAudit("Admin", "admin", "create_phase", "phase", row.id, `إنشاء مرحلة مخصصة: ${row.name}`);

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إنشاء المرحلة" });
  }
});

router.put("/phases/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, description, defaultAmount, failureMessage, failureTitle, cardColor, sortOrder, status, isFrozen } = req.body as {
      name?: string;
      description?: string;
      defaultAmount?: string;
      failureMessage?: string;
      failureTitle?: string | null;
      cardColor?: string | null;
      sortOrder?: number;
      status?: string;
      isFrozen?: boolean;
    };

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (defaultAmount !== undefined) updates.defaultAmount = defaultAmount;
    if (failureMessage !== undefined) updates.failureMessage = failureMessage.trim();
    if (failureTitle !== undefined) updates.failureTitle = failureTitle ? failureTitle.trim() : null;
    if (cardColor !== undefined) updates.cardColor = cardColor;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (status !== undefined) updates.status = status;
    if (isFrozen !== undefined) {
      updates.isFrozen = isFrozen;
      updates.status = isFrozen ? "frozen" : "active";
    }

    const [row] = await db
      .update(customPhasesTable)
      .set(updates)
      .where(eq(customPhasesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "المرحلة غير موجودة" });
      return;
    }

    await logAudit("Admin", "admin", "update_phase", "phase", id, `تعديل بيانات المرحلة: ${row.name}`);

    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث المرحلة" });
  }
});

// Toggle Freeze / Unfreeze
router.patch("/phases/:id/toggle-freeze", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, id)).limit(1);
    if (!phase) {
      res.status(404).json({ error: "المرحلة غير موجودة" });
      return;
    }

    const nextFrozen = !phase.isFrozen && phase.status !== "frozen";
    const nextStatus = nextFrozen ? "frozen" : "active";

    const [updated] = await db
      .update(customPhasesTable)
      .set({
        isFrozen: nextFrozen,
        status: nextStatus,
      })
      .where(eq(customPhasesTable.id, id))
      .returning();

    await logAudit(
      "Admin",
      "admin",
      nextFrozen ? "freeze_phase" : "unfreeze_phase",
      "phase",
      id,
      `${nextFrozen ? "تجميد" : "إلغاء تجميد"} المرحلة: ${phase.name}`
    );

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تغيير حالة تجميد المرحلة" });
  }
});

// Get usage statistics before deleting
router.get("/phases/:id/usage", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userPhases = await db.select().from(userCustomPhasesTable).where(eq(userCustomPhasesTable.phaseId, id));
    const txs = await db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.type, `add_custom_phase_${id}`));

    res.json({
      phaseId: id,
      usersCount: userPhases.length,
      transactionsCount: txs.length,
      canSafelyDelete: userPhases.length === 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل استعلام استخدام المرحلة" });
  }
});

router.delete("/phases/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, id)).limit(1);
    if (!phase) {
      res.status(404).json({ error: "المرحلة غير موجودة" });
      return;
    }

    // Safety check: soft-delete or remove associations safely
    await db.delete(userCustomPhasesTable).where(eq(userCustomPhasesTable.phaseId, id));
    await db.delete(customPhasesTable).where(eq(customPhasesTable.id, id));

    await logAudit("Admin", "admin", "delete_phase", "phase", id, `حذف المرحلة: ${phase.name}`);

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف المرحلة" });
  }
});

/* ── Per-user Phase Visibility & Operations ─────────────────── */

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
    if (!row) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث الظهور" });
  }
});

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
    const { visible, agentId } = req.body as { visible: boolean; agentId?: number };

    // Check if phase is frozen
    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, phaseId)).limit(1);
    if (phase && (phase.isFrozen || phase.status === "frozen")) {
      res.status(400).json({ error: "هذه المرحلة مجمّدة حالياً ولا يمكن تعديل ظهورها للمستفيد" });
      return;
    }

    if (agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
      if (!agent || agent.status !== "active" || agent.canManagePhases === false) {
        res.status(403).json({ error: "ليس لديك صلاحية لإدارة المراحل" });
        return;
      }
    }

    const existing = await db
      .select()
      .from(userCustomPhasesTable)
      .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      [row] = await db
        .insert(userCustomPhasesTable)
        .values({ userId, phaseId, visible, amount: phase?.defaultAmount || "0", status: "unpaid" })
        .returning();
    } else {
      [row] = await db
        .update(userCustomPhasesTable)
        .set({ visible })
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
    const { amount, agentId } = req.body as { amount: number; agentId?: number };

    // Check if phase is frozen
    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, phaseId)).limit(1);
    if (!phase) {
      res.status(404).json({ error: "المرحلة غير موجودة" });
      return;
    }
    if (phase.isFrozen || phase.status === "frozen") {
      res.status(400).json({ error: "هذه المرحلة مجمّدة حالياً ولا يمكن تعديل مبالغها" });
      return;
    }

    if (agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
      if (!agent || agent.status !== "active" || (agent.canManagePhases === false && !agent.canManageFinancials)) {
        res.status(403).json({ error: "ليس لديك صلاحية لتعديل مبالغ المراحل" });
        return;
      }
    }

    const formatted = Number(amount).toLocaleString("en-US");

    const existing = await db
      .select()
      .from(userCustomPhasesTable)
      .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      [row] = await db
        .insert(userCustomPhasesTable)
        .values({ userId, phaseId, amount: formatted, status: "unpaid", visible: false })
        .returning();
    } else {
      [row] = await db
        .update(userCustomPhasesTable)
        .set({ amount: formatted, status: "unpaid" })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();
    }

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
    const { paidAmount, agentId } = req.body as { paidAmount?: number | string; agentId?: number };

    // Check if phase is frozen
    const [phase] = await db.select().from(customPhasesTable).where(eq(customPhasesTable.id, phaseId)).limit(1);
    if (!phase) {
      res.status(404).json({ error: "المرحلة غير موجودة" });
      return;
    }
    if (phase.isFrozen || phase.status === "frozen") {
      res.status(400).json({ error: "هذه المرحلة مجمّدة حالياً ولا يمكن تسديد مبالغها" });
      return;
    }

    if (agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
      if (!agent || agent.status !== "active" || (agent.canPayPhases === false && !agent.canManageFinancials)) {
        res.status(403).json({ error: "ليس لديك صلاحية لسداد مبالغ المراحل" });
        return;
      }
    }

    const existing = await db
      .select()
      .from(userCustomPhasesTable)
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

    const remainder = Math.max(0, currentNum - paidNum);
    const paidAt = new Date();

    let updatedRow;
    if (remainder === 0) {
      [updatedRow] = await db
        .update(userCustomPhasesTable)
        .set({ status: "paid", paidAt })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();
    } else {
      const formattedRemainder = remainder.toLocaleString("en-US");
      [updatedRow] = await db
        .update(userCustomPhasesTable)
        .set({ amount: formattedRemainder, status: "partial" })
        .where(and(eq(userCustomPhasesTable.userId, userId), eq(userCustomPhasesTable.phaseId, phaseId)))
        .returning();
    }

    const [beneficiary] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, userId)).limit(1);

    if (phase && beneficiary) {
      const paidFormatted = paidNum.toLocaleString("en-US");
      await db.insert(financialTransactionsTable).values({
        beneficiaryId: userId,
        type: `pay_custom_phase_${phaseId}`,
        amount: String(paidNum),
        description: `سداد ${phase.name}: ${paidFormatted} ر.س`,
      });

      await db.insert(notificationsTable).values({
        userId,
        beneficiaryId: userId,
        title: `تم سداد رسوم ${phase.name} بنجاح`,
        message: `تم تأكيد سداد مبلغ ${paidFormatted} ر.س لـ ${phase.name}.`,
        isRead: false,
      });
    }

    res.json(updatedRow);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل سداد المرحلة" });
  }
});

export default router;
