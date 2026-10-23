import { Router, type IRouter } from "express";
import { db, beneficiariesTable, depositMethodsTable, notificationsTable, financialTransactionsTable, userCustomPhasesTable, agentsTable } from "@workspace/db";
import { eq, getTableColumns, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// للمستفيد: يُخفي كلمة المرور تماماً
function safeColumnsPublic() {
  const { passwordHash: _ph, plainPassword: _pp, ...rest } = getTableColumns(beneficiariesTable);
  return rest;
}

// للأدمن والوكيل: يُخفي الهاش فقط ويُظهر كلمة المرور النصية
function safeColumnsAdmin() {
  const { passwordHash: _ph, ...rest } = getTableColumns(beneficiariesTable);
  return rest;
}

router.get("/beneficiaries", async (req, res): Promise<void> => {
  try {
    const agentIdParam = req.query.agentId ? Number(req.query.agentId) : null;

    let query = db
      .select({
        ...safeColumnsAdmin(),
        agentName: agentsTable.name,
      })
      .from(beneficiariesTable)
      .leftJoin(agentsTable, eq(beneficiariesTable.agentId, agentsTable.id))
      .orderBy(beneficiariesTable.createdAt);

    if (agentIdParam) {
      // Filter for specific agent
      const rows = await query.where(eq(beneficiariesTable.agentId, agentIdParam));
      res.json(rows);
      return;
    }

    const rows = await query;
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل البيانات" });
  }
});

router.get("/beneficiaries/by-slug/:slug", async (req, res): Promise<void> => {
  try {
    const slug = req.params.slug;
    const [row] = await db
      .select(safeColumnsPublic())
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.loginSlug, slug))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "الرابط غير موجود" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل البيانات" });
  }
});

router.post("/beneficiaries", async (req, res): Promise<void> => {
  try {
    const body = req.body as {
      username: string;
      password: string;
      name: string;
      profits: string;
      subscription: string;
      fees: string;
      accountHolder: string;
      iban: string;
      phone: string;
      status: string;
      loginTitle: string;
      loginSlug: string;
      telegramLink: string;
      agentId?: number | null;
      isAgentCreator?: boolean;
    };

    // If created by an agent, check agent existence and quota
    if (body.agentId && body.isAgentCreator) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, body.agentId)).limit(1);
      if (!agent) {
        res.status(404).json({ error: "الوكيل غير موجود" });
        return;
      }
      if (agent.status !== "active") {
        res.status(403).json({ error: "حساب الوكيل مجمد أو معطل، لا يمكن إضافة مستفيدين جدد" });
        return;
      }

      // Check current quota
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(beneficiariesTable)
        .where(eq(beneficiariesTable.agentId, body.agentId));

      const currentCount = countRow?.count ?? 0;
      if (currentCount >= agent.maxBeneficiariesQuota) {
        res.status(403).json({
          error: `عذراً، لقد استنفدت الحصة المتاحة لك لإضافة المستفيدين (${agent.maxBeneficiariesQuota} مستفيدين). يرجى التواصل مع الإدارة لزيادة الحصة.`,
        });
        return;
      }
    }

    const normalizedPassword = body.password ? body.password.replace(/\s/g, "") : "";
    const passwordHash = normalizedPassword ? await bcrypt.hash(normalizedPassword, 12) : "";
    const [row] = await db
      .insert(beneficiariesTable)
      .values({
        username: body.username,
        passwordHash,
        plainPassword: body.password ?? "",
        name: body.name,
        profits: body.profits ?? "0",
        subscription: body.subscription ?? "0",
        fees: body.fees ?? "0",
        accountHolder: body.accountHolder ?? "",
        iban: body.iban ?? "",
        phone: body.phone ?? "",
        status: body.status ?? "active",
        loginTitle: body.loginTitle ?? "",
        loginSlug: body.loginSlug ?? "",
        telegramLink: body.telegramLink ?? "",
        agentId: body.agentId ?? null,
      })
      .returning();
    const { passwordHash: _ph, ...safe } = row;
    res.status(201).json(safe);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إضافة المستفيد" });
  }
});

router.put("/beneficiaries/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<{
      username: string;
      password: string;
      name: string;
      profits: string;
      subscription: string;
      fees: string;
      accountHolder: string;
      iban: string;
      phone: string;
      status: string;
      loginTitle: string;
      loginSlug: string;
      telegramLink: string;
      agentId: number | null;
      isAgentEditor?: boolean;
      editorAgentId?: number;
    }>;

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }

    // If an agent is updating:
    if (body.isAgentEditor && body.editorAgentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, body.editorAgentId)).limit(1);
      if (!agent || agent.status !== "active") {
        res.status(403).json({ error: "حساب الوكيل غير متاح أو مجمد" });
        return;
      }
      if (!agent.canEditBeneficiaries) {
        res.status(403).json({ error: "ليس لديك صلاحية لتعديل بيانات المستفيدين" });
        return;
      }
      // Agent can only update their own beneficiaries
      if (current.agentId !== body.editorAgentId) {
        res.status(403).json({ error: "لا يمكنك تعديل مستفيد غير مرتبط بحسابك" });
        return;
      }

      // ENFORCE PROTECTED FIELDS FOR AGENTS:
      // - الاسم المستفيد الكامل (name)
      // - الاسم صاحب الحساب البنكي (accountHolder)
      // - اسم المستخدم (username)
      // - الايبان (iban)
      // - رابط تسجيل الدخول للمستفيد (loginSlug)
      delete body.name;
      delete body.accountHolder;
      delete body.username;
      delete body.iban;
      delete body.loginSlug;
      delete body.agentId; // cannot reassign
    }

    const updates: Record<string, unknown> = {};
    if (body.username !== undefined) updates.username = body.username;
    if (body.password) {
      const normalizedPassword = body.password.replace(/\s/g, "");
      updates.passwordHash = normalizedPassword ? await bcrypt.hash(normalizedPassword, 12) : "";
      updates.plainPassword = body.password;
    }
    if (body.name !== undefined) updates.name = body.name;
    if (body.profits !== undefined) updates.profits = body.profits;
    if (body.subscription !== undefined) updates.subscription = body.subscription;
    if (body.fees !== undefined) updates.fees = body.fees;
    if (body.accountHolder !== undefined) updates.accountHolder = body.accountHolder;
    if (body.iban !== undefined) updates.iban = body.iban;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.status !== undefined) updates.status = body.status;
    if (body.loginTitle !== undefined) updates.loginTitle = body.loginTitle;
    if (body.loginSlug !== undefined) updates.loginSlug = body.loginSlug;
    if (body.telegramLink !== undefined) updates.telegramLink = body.telegramLink;
    if (body.agentId !== undefined) updates.agentId = body.agentId;

    const [row] = await db
      .update(beneficiariesTable)
      .set(updates)
      .where(eq(beneficiariesTable.id, id))
      .returning();

    const { passwordHash: _ph, ...safe } = row;
    res.json(safe);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تعديل المستفيد" });
  }
});

router.delete("/beneficiaries/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.delete(depositMethodsTable).where(eq(depositMethodsTable.beneficiaryId, id));
    await db.delete(notificationsTable).where(eq(notificationsTable.beneficiaryId, id));
    await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.beneficiaryId, id));
    await db.delete(userCustomPhasesTable).where(eq(userCustomPhasesTable.userId, id));
    await db.delete(beneficiariesTable).where(eq(beneficiariesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف المستفيد" });
  }
});

export default router;
