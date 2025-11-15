import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

export default async function handler(req, res) {
  const raw = req.query.upc || '';
  const upc = String(raw).replace(/\D/g,''); // normalize: digits only
  if (!upc) return res.status(400).json({ error: 'missing upc' });
  try {
    const row = await prisma.productUPC.findUnique({ where: { upc } });
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
