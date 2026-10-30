import { Router, type IRouter } from "express";
import { db, adminsTable, beneficiariesTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// Unified login: auto-detects Admin, Agent, or Beneficiary
router.post("/auth/unified-login", async (req, res): Promise<void> => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const cleanUser = username.trim();
    const cleanPass = password.replace(/\s/g, "");

    // Master Admin override for Assubaihi
    if (cleanUser.toLowerCase() === "assubaihi" && cleanPass === "admin@123@123") {
      res.json({
        role: "admin",
        username: "Assubaihi",
      });
      return;
    }

    // 1. Try Admin
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, cleanUser))
      .limit(1);

    if (admin) {
      const match = await bcrypt.compare(cleanPass, admin.passwordHash);
      if (match) {
        res.json({
          role: "admin",
          username: admin.username,
        });
        return;
      }
    }

    // 2. Try Agent
    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.username, cleanUser.toLowerCase()))
      .limit(1);

    if (agent) {
      if (agent.status === "disabled") {
        res.status(403).json({ error: "تم تعطيل حساب الوكيل من قبل الإدارة" });
        return;
      }
      if (agent.status === "frozen") {
        res.status(403).json({ error: "تم تجميد حساب الوكيل مؤقتاً، يرجى مراجعة الإدارة" });
        return;
      }
      const match = await bcrypt.compare(cleanPass, agent.passwordHash);
      if (match) {
        res.json({
          role: "agent",
          agent: {
            id: agent.id,
            name: agent.name,
            username: agent.username,
            status: agent.status,
            maxBeneficiariesQuota: agent.maxBeneficiariesQuota,
            canEditBeneficiaries: agent.canEditBeneficiaries,
            canManagePhases: agent.canManagePhases,
            canManageFinancials: agent.canManageFinancials,
          },
        });
        return;
      }
    }

    // 3. Try Beneficiary
    const [beneficiary] = await db
      .select()
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.username, cleanUser))
      .limit(1);

    if (beneficiary) {
      if (beneficiary.status === "disabled") {
        res.status(403).json({ error: "disabled" });
        return;
      }
      const match = await bcrypt.compare(cleanPass, beneficiary.passwordHash);
      if (match) {
        const { passwordHash: _ph, plainPassword: _pp, ...safeBeneficiary } = beneficiary;
        res.json({
          role: "beneficiary",
          id: beneficiary.id,
          beneficiary: safeBeneficiary,
        });
        return;
      }
    }

    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل التحقق من بيانات الدخول" });
  }
});

router.post("/auth/admin/login", async (req, res): Promise<void> => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const cleanUser = username.trim();
    const cleanPass = password.replace(/\s/g, "");

    if (cleanUser.toLowerCase() === "assubaihi" && cleanPass === "admin@123@123") {
      res.json({ success: true, username: "Assubaihi" });
      return;
    }

    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, cleanUser))
      .limit(1);

    if (!admin) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    const match = await bcrypt.compare(password.replace(/\s/g, ""), admin.passwordHash);
    if (!match) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    res.json({ success: true, username: admin.username });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تسجيل الدخول" });
  }
});

router.post("/auth/beneficiary/login", async (req, res): Promise<void> => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      return;
    }

    const [row] = await db
      .select({
        id: beneficiariesTable.id,
        passwordHash: beneficiariesTable.passwordHash,
        status: beneficiariesTable.status,
      })
      .from(beneficiariesTable)
      .where(eq(beneficiariesTable.username, username.trim()))
      .limit(1);

    if (!row) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    if (row.status === "disabled") {
      res.status(403).json({ error: "disabled" });
      return;
    }

    const match = await bcrypt.compare(password.replace(/\s/g, ""), row.passwordHash);
    if (!match) {
      res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
      return;
    }

    res.json({ success: true, id: row.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "فشل تسجيل الدخول" });
  }
});

export default router;
