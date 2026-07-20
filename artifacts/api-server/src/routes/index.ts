import { Router, type IRouter } from "express";
import healthRouter from "./health";
import beneficiariesRouter from "./beneficiaries";
import notificationsRouter from "./notifications";
import authRouter from "./auth";
import phasesRouter from "./phases";
import depositRouter from "./deposit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(beneficiariesRouter);
router.use(notificationsRouter);
router.use(phasesRouter);
router.use(depositRouter);

export default router;
