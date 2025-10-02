/**
 * Minimal mock server for testing SpellCastDemo
 * No dependencies on sharp or other complex libraries
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock library animation endpoint
app.get('/api/library-animations/:animationId', async (req, res) => {
  try {
    const { animationId } = req.params;
    const animPath = path.join(__dirname, '../../assets/library-animations', animationId);

    // Read metadata
    const metadataPath = path.join(animPath, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // Read frames
    const frames: string[] = [];
    for (let i = 0; i < metadata.frameCount; i++) {
      const framePath = path.join(animPath, `frame-${i}.png`);
      const frameBuffer = await fs.readFile(framePath);
      frames.push(frameBuffer.toString('base64'));
    }

    res.json({
      ...metadata,
      frames
    });
  } catch (error: any) {
    console.error('Error loading animation:', error);
    res.status(404).json({ error: 'Animation not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
});
