# API Keys Setup Guide

This guide will help you obtain and configure the required API keys for the Prompt Builder feature.

---

## Required API Keys

You need two API keys to use the multi-modal Prompt Builder:

1. **PixelLab API Key** - For sprite generation
2. **Anthropic API Key** - For Claude Vision analysis

---

## 1. PixelLab API Key

### How to Get It

1. Visit [PixelLab.ai](https://pixellab.ai)
2. Sign up for an account (or log in if you already have one)
3. Navigate to your dashboard
4. Go to **API Keys** or **Settings** section
5. Generate a new API key or copy your existing key

### Where to Add It

Open `/backend/.env` and update:

```bash
PIXELLAB_API_KEY=your-actual-pixellab-key-here
```

### Pricing (as of 2025)

- **Free Tier**: Usually includes 10-50 generations/month
- **Paid Tiers**: ~$0.10-0.30 per sprite generation
- Check [PixelLab.ai pricing](https://pixellab.ai/pricing) for current rates

---

## 2. Anthropic API Key (Claude Vision)

### How to Get It

1. Visit [Anthropic Console](https://console.anthropic.com)
2. Sign up for an account (or log in)
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Name it (e.g., "Drawn of War - Development")
6. Copy the key immediately (it won't be shown again)

### Where to Add It

Open `/backend/.env` and update:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

### Pricing (as of 2025)

**Claude 3 Sonnet** (recommended for this project):
- **Input**: $3 per million tokens (~$0.003 per 1K tokens)
- **Output**: $15 per million tokens (~$0.015 per 1K tokens)
- **Vision**: ~$0.01-0.015 per image analysis

**Expected Cost for Your Use Case**:
- Each visual generation uses ~500-1000 tokens input + 200-400 tokens output
- **Cost per generation**: ~$0.01-0.02
- **1000 generations/month**: ~$10-20/month

**Budget-Friendly Alternative**: Claude 3 Haiku (~70% cheaper, slightly lower quality)

Check [Anthropic Pricing](https://www.anthropic.com/pricing) for current rates.

---

## 3. Verify Setup

After adding both keys to `/backend/.env`, verify the setup:

### Check .env File

```bash
cd /mnt/c/Users/mhast/Desktop/drawnofwar6/backend
cat .env | grep -E "PIXELLAB_API_KEY|ANTHROPIC_API_KEY"
```

You should see:
```
PIXELLAB_API_KEY=pl_xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

### Test API Keys (After Installation)

Once you've added the keys and installed dependencies, you can test them:

```bash
# From backend directory
pnpm test:api-keys
```

This will verify both APIs are accessible and keys are valid.

---

## 4. Security Best Practices

### ✅ DO:
- Keep `.env` file in `.gitignore` (already configured)
- Never commit API keys to git
- Rotate keys periodically
- Use separate keys for development/production

### ❌ DON'T:
- Share keys in screenshots or messages
- Commit `.env` file to repository
- Use production keys in development
- Hard-code keys in source files

---

## 5. Next Steps

Once you've added both API keys:

1. ✅ Verify `.env` file has both keys
2. ✅ Install dependencies (I'll handle this)
3. ✅ Begin implementation (I'll start with Phase 0)

---

## Troubleshooting

### "Invalid API Key" Errors

**PixelLab**:
- Verify key is copied correctly (no extra spaces)
- Check if key is active in PixelLab dashboard
- Ensure your account has sufficient credits

**Anthropic**:
- Verify key starts with `sk-ant-api03-`
- Check if key was deleted in Anthropic console
- Ensure account has billing enabled (required even for testing)

### Rate Limiting

**PixelLab**:
- Free tier: Limited requests per day
- Solution: Upgrade plan or wait for reset

**Anthropic**:
- New accounts: Lower rate limits initially
- Solution: Contact Anthropic support to increase limits
- Expected: ~5 requests/second is sufficient for MVP

---

## Cost Management

### Monitor Usage

**PixelLab**:
- Dashboard shows generation count
- Set up usage alerts if available

**Anthropic**:
- [Console](https://console.anthropic.com) shows token usage
- Set budget alerts in account settings

### Recommended Budget (MVP)

- **PixelLab**: $20-50/month (200-500 generations)
- **Anthropic**: $10-30/month (500-1500 visual analyses)
- **Total**: $30-80/month for MVP with moderate usage

---

## Need Help?

If you encounter issues:

1. Check [PixelLab Documentation](https://docs.pixellab.ai)
2. Check [Anthropic Documentation](https://docs.anthropic.com)
3. Verify `.env` file format matches `.env.example`
4. Ask me for help debugging!

---

**Created**: 2025-10-01
**Updated**: 2025-10-01
