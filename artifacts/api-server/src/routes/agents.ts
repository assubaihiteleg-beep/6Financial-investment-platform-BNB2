import { Router, type IRouter } from "express";
import { db, agentsTable, beneficiariesTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

const router: IRouter = Router();

// 1. List all agents with assigned beneficiary count
router.get("/agents", async (req, res): Promise<void> => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);

    // Get count of beneficiaries for each agent
    const counts = await db
      .select({
        agentId: beneficiariesTable.agentId,
        count: sql<number>`count(*)::int`,
      })
      .from(beneficiariesTable)
      .where(sql`${beneficiariesTable.agentId} IS NOT NULL`)
      .groupBy(beneficiariesTable.agentId);

    const countMap = new Map<number, number>();
    for (const c of counts) {
      if (c.agentId) countMap.set(c.agentId, c.count);
    }

    const result = agents.map((agent: typeof agentsTable.$inferSelect) => ({
      ...agent,
      currentBeneficiariesCount: countMap.get(agent.id) ?? 0,
    }));

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

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.agentId, id));

    res.json({
      ...agent,
      currentBeneficiariesCount: countRow?.count ?? 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحميل بيانات الوكيل" });
  }
});

// 3. Create new agent
router.post("/agents", async (req, res): Promise<void> => {
  try {
    const {
      username,
      password,
      name,
      maxBeneficiariesQuota,
      canEditBeneficiaries,
      canManagePhases,
      canManageFinancials,
      status,
    } = req.body as {
      username?: string;
      password?: string;
      name?: string;
      maxBeneficiariesQuota?: number;
      canEditBeneficiaries?: boolean;
      canManagePhases?: boolean;
      canManageFinancials?: boolean;
      status?: string;
    };

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
        canEditBeneficiaries: canEditBeneficiaries ?? true,
        canManagePhases: canManagePhases ?? false,
        canManageFinancials: canManageFinancials ?? false,
      })
      .returning();

    res.json(newAgent);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل إنشاء حساب الوكيل" });
  }
});

// 4. Update agent
router.put("/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      username,
      password,
      name,
      maxBeneficiariesQuota,
      canEditBeneficiaries,
      canManagePhases,
      canManageFinancials,
      status,
    } = req.body as {
      username?: string;
      password?: string;
      name?: string;
      maxBeneficiariesQuota?: number;
      canEditBeneficiaries?: boolean;
      canManagePhases?: boolean;
      canManageFinancials?: boolean;
      status?: string;
    };

    const [current] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    const updateData: Partial<typeof agentsTable.$inferInsert> = {};

    if (name?.trim()) updateData.name = name.trim();
    if (status) updateData.status = status;
    if (maxBeneficiariesQuota !== undefined) updateData.maxBeneficiariesQuota = Number(maxBeneficiariesQuota);
    if (canEditBeneficiaries !== undefined) updateData.canEditBeneficiaries = Boolean(canEditBeneficiaries);
    if (canManagePhases !== undefined) updateData.canManagePhases = Boolean(canManagePhases);
    if (canManageFinancials !== undefined) updateData.canManageFinancials = Boolean(canManageFinancials);

    if (username?.trim() && username.trim().toLowerCase() !== current.username) {
      const cleanUsername = username.trim().toLowerCase();
      const [existing] = await db.select().from(agentsTable).where(eq(agentsTable.username, cleanUsername)).limit(1);
      if (existing) {
        res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل لوكيل آخر" });
        return;
      }
      updateData.username = cleanUsername;
    }

    if (password?.trim()) {
      updateData.passwordHash = await bcrypt.hash(password.trim(), 12);
      updateData.plainPassword = password.trim();
    }

    const [updated] = await db
      .update(agentsTable)
      .set(updateData)
      .where(eq(agentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث بيانات الوكيل" });
  }
});

// 5. Update agent status (active, frozen, disabled)
router.patch("/agents/:id/status", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: "active" | "frozen" | "disabled" };

    if (!["active", "frozen", "disabled"].includes(status)) {
      res.status(400).json({ error: "حالة غير صحيحة" });
      return;
    }

    const [updated] = await db
      .update(agentsTable)
      .set({ status })
      .where(eq(agentsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تحديث حالة الوكيل" });
  }
});

// 6. Delete agent (unassigns beneficiaries)
router.delete("/agents/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);

    // Unassign all beneficiaries from this agent
    await db
      .update(beneficiariesTable)
      .set({ agentId: null })
      .where(eq(beneficiariesTable.agentId, id));

    const [deleted] = await db.delete(agentsTable).where(eq(agentsTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    res.json({ success: true, id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل حذف الوكيل" });
  }
});

// 7. Assign beneficiaries to agent
router.post("/agents/:id/assign-beneficiaries", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { beneficiaryIds } = req.body as { beneficiaryIds: number[] };

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
    if (!agent) {
      res.status(404).json({ error: "الوكيل غير موجود" });
      return;
    }

    if (Array.isArray(beneficiaryIds) && beneficiaryIds.length > 0) {
      await db
        .update(beneficiariesTable)
        .set({ agentId: id })
        .where(inArray(beneficiariesTable.id, beneficiaryIds));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تعيين المستفيدين للوكيل" });
  }
});

// 8. Agent changes their own password
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

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تغيير كلمة المرور" });
  }
});

export default router;
