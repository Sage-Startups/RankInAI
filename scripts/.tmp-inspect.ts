import { PrismaClient } from '@prisma/client';
async function main() {
  const p = new PrismaClient();
  const jobs = await p.auditJob.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
  jobs.forEach((j) => console.log(JSON.stringify({ auditId: j.auditId, status: j.status, attempts: j.attempts, pct: j.progressPercent, msg: j.progressMessage, err: j.errorMessage, code: j.errorCode })));
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
