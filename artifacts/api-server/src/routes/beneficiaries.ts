import { Router, type IRouter } from "express";
import {
  db,
  beneficiariesTable,
  agentsTable,
  depositMethodsTable,
  notificationsTable,
  financialTransactionsTable,
  userCustomPhasesTable,
} from "@workspace/db";
import { eq, getTableColumns, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "./agents";

const router: IRouter = Router();

function safeColumnsPublic() {
  const { passwordHash: _ph, plainPassword: _pp, ...rest } = getTableColumns(beneficiariesTable);
  return rest;
}

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

    const rows = await query;

    if (agentIdParam) {
      // Check if agent exists and has canViewBeneficiaries
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentIdParam)).limit(1);
      if (!agent || agent.status === "disabled") {
        res.status(403).json({ error: "حساب الوكيل غير مصرح أو معطل" });
        return;
      }
      if (agent.canViewBeneficiaries === false) {
        res.status(403).json({ error: "ليس لديك صلاحية لعرض المستفيدين" });
        return;
      }

      // Filter for specific agent based on agentIds array or agentId
      const filtered = rows.filter((r: any) => {
        const ids: number[] = Array.isArray(r.agentIds) && r.agentIds.length > 0
          ? r.agentIds.map(Number)
          : (r.agentId ? [Number(r.agentId)] : []);
        return ids.includes(agentIdParam);
      });
      res.json(filtered);
      return;
    }

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
    res.status(500).json({ error: "فشل تحميل المستفيد" });
  }
});

router.post("/beneficiaries", async (req, res): Promise<void> => {
  try {
    const body = req.body as {
      username: string;
      password?: string;
      name: string;
      profits?: string;
      subscription?: string;
      fees?: string;
      accountHolder?: string;
      iban?: string;
      phone?: string;
      status?: string;
      loginTitle: string;
      loginSlug: string;
      telegramLink: string;
      agentId?: number | null;
      agentIds?: number[];
      isAgentCreator?: boolean;
    };

    if (!body.username || !body.username.trim()) {
      res.status(400).json({ error: "اسم المستخدم مطلوب" });
      return;
    }
    if (!body.name || !body.name.trim()) {
      res.status(400).json({ error: "اسم المستفيد الكامل مطلوب" });
      return;
    }

    // Resolve agents
    const allAgents = await db.select().from(agentsTable);
    const aMap = new Map<number, string>();
    for (const a of allAgents) aMap.set(Number(a.id), a.name);

    let initialAgentIds: number[] = [];
    if (Array.isArray(body.agentIds) && body.agentIds.length > 0) {
      initialAgentIds = Array.from(new Set(body.agentIds.map(Number))).filter((aid) => aMap.has(aid));
    } else if (body.agentId) {
      initialAgentIds = [Number(body.agentId)].filter((aid) => aMap.has(aid));
    }

    // If created by an agent, check agent existence, quota, and canAddBeneficiaries permission
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
      if (agent.canAddBeneficiaries === false) {
        res.status(403).json({ error: "ليس لديك صلاحية لإضافة مستفيدين جدد" });
        return;
      }

      // Check current quota
      const allBeneficiaries = await db.select().from(beneficiariesTable);
      const currentCount = allBeneficiaries.filter((b: any) => {
        const ids: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
          ? b.agentIds.map(Number)
          : (b.agentId ? [Number(b.agentId)] : []);
        return ids.includes(Number(body.agentId));
      }).length;

      if (currentCount >= agent.maxBeneficiariesQuota) {
        res.status(403).json({
          error: `عذراً، لقد استنفدت الحصة المتاحة لك لإضافة المستفيدين (${agent.maxBeneficiariesQuota} مستفيدين). يرجى التواصل مع الإدارة لزيادة الحصة.`,
        });
        return;
      }

      if (!initialAgentIds.includes(Number(body.agentId))) {
        initialAgentIds.push(Number(body.agentId));
      }
    }

    const initialAgentNames = initialAgentIds.map((aid) => aMap.get(aid)).filter(Boolean) as string[];

    const cleanUsername = body.username.trim();
    const normalizedPassword = body.password ? body.password.replace(/\s/g, "") : "";
    const passwordHash = normalizedPassword ? await bcrypt.hash(normalizedPassword, 12) : "";

    const [row] = await db
      .insert(beneficiariesTable)
      .values({
        username: cleanUsername,
        passwordHash,
        plainPassword: body.password ?? "",
        name: body.name.trim(),
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
        agentId: initialAgentIds[0] ?? null,
        agentIds: initialAgentIds,
        agentNames: initialAgentNames,
        agentName: initialAgentNames.length > 0 ? initialAgentNames.join("، ") : null,
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "فشل حفظ بيانات المستفيد في قاعدة البيانات" });
      return;
    }

    await logAudit(
      body.isAgentCreator ? `Agent#${body.agentId}` : "Admin",
      body.isAgentCreator ? "agent" : "admin",
      "create_beneficiary",
      "beneficiary",
      row.id,
      `إضافة المستفيد: ${row.name} (@${row.username})`
    );

    const { passwordHash: _ph, ...safe } = row;
    res.status(201).json(safe);
  } catch (err: any) {
    req.log.error(err);
    const msg = String(err?.message || err?.cause?.message || err || "");
    const code = err?.code || err?.cause?.code;
    if (code === "23505" || msg.includes("unique") || msg.includes("duplicate key") || msg.includes("beneficiaries_username_unique")) {
      res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر" });
      return;
    }
    res.status(500).json({ error: err?.message || "فشل إضافة المستفيد" });
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
      agentIds: number[];
      isAgentEditor?: boolean;
      editorAgentId?: number;
    }>;

    const [current] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }

    // Check if an agent is updating
    if (body.isAgentEditor && body.editorAgentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, body.editorAgentId)).limit(1);
      if (!agent || agent.status !== "active") {
        res.status(403).json({ error: "حساب الوكيل غير متاح أو مجمد" });
        return;
      }

      // Check if this beneficiary is assigned to this agent (multi-agent check)
      const currentAgentIds: number[] = Array.isArray(current.agentIds) && current.agentIds.length > 0
        ? current.agentIds.map(Number)
        : (current.agentId ? [Number(current.agentId)] : []);

      if (!currentAgentIds.includes(body.editorAgentId)) {
        res.status(403).json({ error: "لا يمكنك تعديل مستفيد غير مرتبط بحسابك" });
        return;
      }

      // Check permission to edit general data
      if (agent.canEditBeneficiaries === false && !body.profits && !body.fees) {
        res.status(403).json({ error: "ليس لديك صلاحية لتعديل بيانات المستفيدين" });
        return;
      }

      // Check financial permissions
      if (body.profits !== undefined && !agent.canManageProfits && !agent.canManageFinancials) {
        res.status(403).json({ error: "ليس لديك صلاحية لإدارة الأرباح" });
        return;
      }

      if (body.fees !== undefined && !agent.canManageFees && !agent.canManageFinancials) {
        res.status(403).json({ error: "ليس لديك صلاحية لإدارة الرسوم" });
        return;
      }

      // ENFORCE PROTECTED FIELDS FOR AGENTS:
      delete body.name;
      delete body.accountHolder;
      delete body.username;
      delete body.iban;
      delete body.loginSlug;
      delete body.agentId; // cannot reassign
      delete body.agentIds;
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

    // Handle agent assignment update if provided by Admin
    if (body.agentIds !== undefined) {
      const allAgents = await db.select().from(agentsTable);
      const aMap = new Map<number, string>();
      for (const a of allAgents) aMap.set(Number(a.id), a.name);

      const cleanIds: number[] = Array.from(new Set((body.agentIds || []).map(Number))).filter((aid) => aMap.has(aid));
      const names = cleanIds.map((aid) => aMap.get(aid)).filter(Boolean) as string[];

      updates.agentIds = cleanIds;
      updates.agentNames = names;
      updates.agentId = cleanIds[0] ?? null;
      updates.agentName = names.length > 0 ? names.join("، ") : null;
    } else if (body.agentId !== undefined) {
      if (body.agentId === null) {
        updates.agentIds = [];
        updates.agentNames = [];
        updates.agentId = null;
        updates.agentName = null;
      } else {
        const [a] = await db.select().from(agentsTable).where(eq(agentsTable.id, body.agentId)).limit(1);
        updates.agentIds = [body.agentId];
        updates.agentNames = a ? [a.name] : [];
        updates.agentId = body.agentId;
        updates.agentName = a ? a.name : null;
      }
    }

    const [row] = await db
      .update(beneficiariesTable)
      .set(updates)
      .where(eq(beneficiariesTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }

    await logAudit(
      body.isAgentEditor ? `Agent#${body.editorAgentId}` : "Admin",
      body.isAgentEditor ? "agent" : "admin",
      "update_beneficiary",
      "beneficiary",
      id,
      `تحديث بيانات المستفيد: ${row.name}`
    );

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
    const agentId = req.query.agentId ? Number(req.query.agentId) : null;

    if (agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
      if (!agent || agent.status !== "active") {
        res.status(403).json({ error: "حساب الوكيل غير متاح أو مجمد" });
        return;
      }
      if (agent.canDeleteBeneficiaries === false) {
        res.status(403).json({ error: "ليس لديك صلاحية لحذف المستفيدين" });
        return;
      }

      const [target] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
      if (!target) {
        res.status(404).json({ error: "المستفيد غير موجود" });
        return;
      }
      const ids: number[] = Array.isArray(target.agentIds) && target.agentIds.length > 0
        ? target.agentIds.map(Number)
        : (target.agentId ? [Number(target.agentId)] : []);
      if (!ids.includes(agentId)) {
        res.status(403).json({ error: "لا يمكنك حذف مستفيد غير مرتبط بحسابك" });
        return;
      }
    }

    const [deleted] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);

    await db.delete(depositMethodsTable).where(eq(depositMethodsTable.beneficiaryId, id));
    await db.delete(notificationsTable).where(eq(notificationsTable.beneficiaryId, id));
    await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.beneficiaryId, id));
    await db.delete(userCustomPhasesTable).where(eq(userCustomPhasesTable.userId, id));
    await db.delete(beneficiariesTable).where(eq(beneficiariesTable.id, id));

    await logAudit(
      agentId ? `Agent#${agentId}` : "Admin",
      agentId ? "agent" : "admin",
      "delete_beneficiary",
      "beneficiary",
      id,
      `حذف المستفيد: ${deleted?.name || id}`
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف المستفيد" });
  }
});

export default router;
