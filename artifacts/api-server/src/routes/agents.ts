import { Router, type IRouter } from "express";
import { db, agentsTable, beneficiariesTable, auditLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// Helper to log audit actions
export async function logAudit(
  actorUsername: string,
  actorRole: "admin" | "agent",
  action: string,
  targetType: string,
  targetId: string | number,
  details: string,
  result: "success" | "denied" | "failure" = "success",
  actorId?: number
) {
  try {
    await db.insert(auditLogsTable).values({
      actorId: actorId ?? null,
      actorUsername,
      actorRole,
      action,
      targetType,
      targetId: String(targetId),
      details,
      result,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn("[AuditLog] Failed to record audit log:", err);
  }
}

// 1. List all agents with assigned beneficiary count
router.get("/agents", async (req, res): Promise<void> => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);
    const allBeneficiaries = await db.select().from(beneficiariesTable);

    const result = agents.map((agent: typeof agentsTable.$inferSelect) => {
      // Calculate count for this agent based on multi-agent agentIds array or legacy agentId
      const count = allBeneficiaries.filter((b: any) => {
        const ids: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
          ? b.agentIds.map(Number)
          : (b.agentId ? [Number(b.agentId)] : []);
        return ids.includes(Number(agent.id));
      }).length;

      return {
        ...agent,
        currentBeneficiariesCount: count,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل قائمة الوكلاء" });
  }
});

// 2. Get single agent by ID
router.get("/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    const allBeneficiaries = await db.select().from(beneficiariesTable);
    const count = allBeneficiaries.filter((b: any) => {
      const ids: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
        ? b.agentIds.map(Number)
        : (b.agentId ? [Number(b.agentId)] : []);
      return ids.includes(id);
    }).length;

    res.json({
      ...agent,
      currentBeneficiariesCount: count,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل بيانات الوكيل" });
  }
});

// 3. Create new agent with granular permissions
router.post("/agents", async (req, res): Promise<void> => {
  try {
    const {
      username,
      password,
      name,
      maxBeneficiariesQuota,
      status,
      // Granular permissions
      canViewBeneficiaries,
      canAddBeneficiaries,
      canEditBeneficiaries,
      canDeleteBeneficiaries,
      canManageProfits,
      canManageFees,
      canPayFees,
      canManageFinancials,
      canManagePhases,
      canPayPhases,
      canSendNotifications,
      canViewAccountInfo,
      canEditAccountInfo,
    } = req.body;

    if (!username?.trim() || !password?.trim() || !name?.trim()) {
      res.status(400).json({ error: "اسم الوكيل، اسم المستخدم وكلمة المرور مطلوبة" });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.username, cleanUsername)).limit(1);
    if (existing) {
      res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل لوكيل آخر" });
      return;
    }

    const passwordHash = await bcrypt.hash(password.trim(), 12);

    const [newAgent] = await db
      .insert(agentsTable)
      .values({
        username: cleanUsername,
        passwordHash,
        plainPassword: password.trim(),
        name: name.trim(),
        status: status || "active",
        maxBeneficiariesQuota: Number(maxBeneficiariesQuota) || 5,
        canViewBeneficiaries: canViewBeneficiaries ?? true,
        canAddBeneficiaries: canAddBeneficiaries ?? false,
        canEditBeneficiaries: canEditBeneficiaries ?? false,
        canDeleteBeneficiaries: canDeleteBeneficiaries ?? false,
        canManageProfits: canManageProfits ?? false,
        canManageFees: canManageFees ?? false,
        canPayFees: canPayFees ?? false,
        canManageFinancials: canManageFinancials ?? false,
        canManagePhases: canManagePhases ?? false,
        canPayPhases: canPayPhases ?? false,
        canSendNotifications: canSendNotifications ?? false,
        canViewAccountInfo: canViewAccountInfo ?? true,
        canEditAccountInfo: canEditAccountInfo ?? false,
      })
      .returning();

    await logAudit(
      "Admin",
      "admin",
      "create_agent",
      "agent",
      newAgent.id,
      `إنشاء حساب الوكيل: ${newAgent.name} (@${newAgent.username})`
    );

    res.json(newAgent);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إنشاء حساب الوكيل" });
  }
});

// 4. Update agent with granular permissions
router.put("/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      username,
      password,
      name,
      maxBeneficiariesQuota,
      status,
      canViewBeneficiaries,
      canAddBeneficiaries,
      canEditBeneficiaries,
      canDeleteBeneficiaries,
      canManageProfits,
      canManageFees,
      canPayFees,
      canManageFinancials,
      canManagePhases,
      canPayPhases,
      canSendNotifications,
      canViewAccountInfo,
      canEditAccountInfo,
    } = req.body;

    const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    const updates: Record<string, any> = {};
    if (name) updates.name = name.trim();
    if (username) updates.username = username.trim().toLowerCase();
    if (password && password.trim().length >= 6) {
      updates.passwordHash = await bcrypt.hash(password.trim(), 12);
      updates.plainPassword = password.trim();
    }
    if (maxBeneficiariesQuota !== undefined) updates.maxBeneficiariesQuota = Number(maxBeneficiariesQuota);
    if (status) updates.status = status;

    // Granular permissions
    if (canViewBeneficiaries !== undefined) updates.canViewBeneficiaries = Boolean(canViewBeneficiaries);
    if (canAddBeneficiaries !== undefined) updates.canAddBeneficiaries = Boolean(canAddBeneficiaries);
    if (canEditBeneficiaries !== undefined) updates.canEditBeneficiaries = Boolean(canEditBeneficiaries);
    if (canDeleteBeneficiaries !== undefined) updates.canDeleteBeneficiaries = Boolean(canDeleteBeneficiaries);
    if (canManageProfits !== undefined) updates.canManageProfits = Boolean(canManageProfits);
    if (canManageFees !== undefined) updates.canManageFees = Boolean(canManageFees);
    if (canPayFees !== undefined) updates.canPayFees = Boolean(canPayFees);
    if (canManageFinancials !== undefined) updates.canManageFinancials = Boolean(canManageFinancials);
    if (canManagePhases !== undefined) updates.canManagePhases = Boolean(canManagePhases);
    if (canPayPhases !== undefined) updates.canPayPhases = Boolean(canPayPhases);
    if (canSendNotifications !== undefined) updates.canSendNotifications = Boolean(canSendNotifications);
    if (canViewAccountInfo !== undefined) updates.canViewAccountInfo = Boolean(canViewAccountInfo);
    if (canEditAccountInfo !== undefined) updates.canEditAccountInfo = Boolean(canEditAccountInfo);

    const [updated] = await db
      .update(agentsTable)
      .set(updates)
      .where(eq(agentsTable.id, id))
      .returning();

    await logAudit(
      "Admin",
      "admin",
      "update_agent",
      "agent",
      id,
      `تحديث بيانات وصلاحيات الوكيل: ${updated.name}`
    );

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث بيانات الوكيل" });
  }
});

// 5. Freeze / Unfreeze agent
router.patch("/agents/:id/toggle-status", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    const nextStatus = agent.status === "active" ? "frozen" : "active";
    const [updated] = await db
      .update(agentsTable)
      .set({ status: nextStatus })
      .where(eq(agentsTable.id, id))
      .returning();

    await logAudit(
      "Admin",
      "admin",
      nextStatus === "frozen" ? "freeze_agent" : "unfreeze_agent",
      "agent",
      id,
      `تغيير حالة الوكيل إلى: ${nextStatus === "frozen" ? "مجمد" : "نشط"}`
    );

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تغيير حالة الوكيل" });
  }
});

// 6. Delete agent
router.delete("/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    // Clean up agent reference from beneficiaries without deleting beneficiaries
    const allBeneficiaries = await db.select().from(beneficiariesTable);
    const allAgents = await db.select().from(agentsTable);
    const aMap = new Map<number, string>();
    for (const a of allAgents) aMap.set(Number(a.id), a.name);

    for (const b of allBeneficiaries) {
      let ids: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
        ? b.agentIds.map(Number)
        : (b.agentId ? [Number(b.agentId)] : []);

      if (ids.includes(id)) {
        ids = ids.filter((aid) => aid !== id);
        const names = ids.map((aid) => aMap.get(aid)).filter(Boolean) as string[];
        await db
          .update(beneficiariesTable)
          .set({
            agentIds: ids,
            agentNames: names,
            agentId: ids[0] ?? null,
            agentName: names.length > 0 ? names.join("، ") : null,
          })
          .where(eq(beneficiariesTable.id, b.id));
      }
    }

    await db.delete(agentsTable).where(eq(agentsTable.id, id));

    await logAudit(
      "Admin",
      "admin",
      "delete_agent",
      "agent",
      id,
      `حذف الوكيل: ${agent.name} وإلغاء ارتباطه بالمستفيدين`
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف الوكيل" });
  }
});

// 7. Multi-agent assignment from Agent view (Assign / Unassign multiple beneficiaries to this agent)
router.post("/agents/:id/assign-beneficiaries", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { beneficiaryIds } = req.body as { beneficiaryIds: number[] };

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    const allAgents = await db.select().from(agentsTable);
    const aMap = new Map<number, string>();
    for (const a of allAgents) aMap.set(Number(a.id), a.name);

    const allBeneficiaries = await db.select().from(beneficiariesTable);
    const selectedSet = new Set((beneficiaryIds || []).map(Number));

    for (const b of allBeneficiaries) {
      const bId = Number(b.id);
      let currentIds: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
        ? b.agentIds.map(Number)
        : (b.agentId ? [Number(b.agentId)] : []);

      const wasAssigned = currentIds.includes(id);
      const shouldBeAssigned = selectedSet.has(bId);

      if (shouldBeAssigned && !wasAssigned) {
        // Add agent id (avoid duplicates)
        currentIds = Array.from(new Set([...currentIds, id]));
        const names = currentIds.map((aid) => aMap.get(aid)).filter(Boolean) as string[];
        await db
          .update(beneficiariesTable)
          .set({
            agentIds: currentIds,
            agentNames: names,
            agentId: currentIds[0] ?? null,
            agentName: names.length > 0 ? names.join("، ") : null,
          })
          .where(eq(beneficiariesTable.id, bId));
      } else if (!shouldBeAssigned && wasAssigned) {
        // Remove agent id without removing other agents
        currentIds = currentIds.filter((aid) => aid !== id);
        const names = currentIds.map((aid) => aMap.get(aid)).filter(Boolean) as string[];
        await db
          .update(beneficiariesTable)
          .set({
            agentIds: currentIds,
            agentNames: names,
            agentId: currentIds[0] ?? null,
            agentName: names.length > 0 ? names.join("، ") : null,
          })
          .where(eq(beneficiariesTable.id, bId));
      }
    }

    await logAudit(
      "Admin",
      "admin",
      "assign_beneficiaries_to_agent",
      "agent",
      id,
      `تحديث قائمة المستفيدين للوكيل: ${agent.name} (إجمالي المسندين: ${selectedSet.size})`
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تعيين المستفيدين للوكيل" });
  }
});

// 8. Direct multi-agent assignment for a single beneficiary
router.post("/beneficiaries/:id/assign-agents", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { agentIds } = req.body as { agentIds: number[] };

    const [b] = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.id, id)).limit(1);
    if (!b) {
      res.status(404).json({ error: "المستفيد غير موجود" });
      return;
    }

    const allAgents = await db.select().from(agentsTable);
    const aMap = new Map<number, string>();
    for (const a of allAgents) aMap.set(Number(a.id), a.name);

    // Filter out duplicates and invalid IDs
    const cleanIds: number[] = Array.from(new Set((agentIds || []).map(Number))).filter((aid) => aMap.has(aid));
    const names = cleanIds.map((aid) => aMap.get(aid)).filter(Boolean) as string[];

    const [updated] = await db
      .update(beneficiariesTable)
      .set({
        agentIds: cleanIds,
        agentNames: names,
        agentId: cleanIds[0] ?? null,
        agentName: names.length > 0 ? names.join("، ") : null,
      })
      .where(eq(beneficiariesTable.id, id))
      .returning();

    await logAudit(
      "Admin",
      "admin",
      "assign_agents_to_beneficiary",
      "beneficiary",
      id,
      `إسناد المستفيد (${b.name}) إلى الوكلاء: [${names.join("، ") || "إلغاء الإسناد"}]`
    );

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إسناد الوكلاء للمستفيد" });
  }
});

// 9. Agent changes their own password
router.post("/agents/:id/change-password", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { newPassword, currentPassword } = req.body as { newPassword?: string; currentPassword?: string };

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      return;
    }

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    if (currentPassword) {
      const match = await bcrypt.compare(currentPassword, agent.passwordHash);
      if (!match) {
        res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 12);
    await db
      .update(agentsTable)
      .set({ passwordHash, plainPassword: newPassword.trim() })
      .where(eq(agentsTable.id, id));

    await logAudit(agent.username, "agent", "change_password", "agent", id, "تغيير كلمة المرور الشخصية");

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تغيير كلمة المرور" });
  }
});

// 10. Audit logs list
router.get("/audit-logs", async (req, res): Promise<void> => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} DESC`).limit(100);
    res.json(logs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل سجل التدقيق" });
  }
});

export default router;
