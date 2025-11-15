import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

export default async function handler(req, res) {
  const { fitId } = req.query;
  if (!fitId) return res.status(400).json({ error: 'missing fitId' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  try {
    const { upc, rating, notes, selected } = req.body || {};
    if (!upc) return res.status(400).json({ error: 'upc is required' });

    // normalize UPC to digits
    const rawUpc = String(upc).replace(/\D/g,'');
    if (!rawUpc) return res.status(400).json({ error: 'invalid upc' });

    // ensure fit exists
    const fit = await prisma.fitSession.findUnique({ where: { id: fitId } });
    if (!fit) return res.status(404).json({ error: 'fit not found' });

    // lookup product by UPC
    const product = await prisma.productUPC.findUnique({ where: { upc: rawUpc } });
    if (!product) return res.status(404).json({ error: 'upc not found' });

    // prepare shoe data (use description if modelName missing)
    const shoeData = {
      fitSessionId: fitId,
      shoeModelId: null,
      modelName: product.modelName || product.description || null,
      size: product.size || '',
      width: product.width || '',
      rating: (Number.isInteger(rating) ? rating : (rating ? parseInt(rating,10) : 4)),
      notes: notes || null,
      selected: !!selected
    };

    const created = await prisma.shoeTried.create({ data: shoeData });
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
