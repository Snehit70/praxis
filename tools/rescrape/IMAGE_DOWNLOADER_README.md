# 🖼️ Image Downloader

## ✅ Ready to Download 26,652 Images!

**CDN Discovered:** `https://saram.blr1.cdn.digitaloceanspaces.com`

---

## 🚀 Quick Start

### Start Downloading
```bash
cd /home/snehit/projects/quiz-scraper
./run-image-downloader.sh
```

### Stop Downloading
```bash
cd /home/snehit/projects/quiz-scraper
touch .stop
```

### Check Progress
```bash
# Count downloaded images
find images -name "*.png" | wc -l

# Check directory size
du -sh images/

# Watch live log
tail -f image-downloader.log
```

---

## 📊 What It Does

**Downloads:**
- 9,186 question images → `images/question_images/`
- 17,466 option images → `images/option_images/`
- **Total: 26,652 images**

**Features:**
- ✅ Resume capability (skips existing images)
- ✅ Polite delays (1-2s between requests)
- ✅ Longer breaks every 50/100 images
- ✅ Auto-restart on crash
- ✅ Graceful stop with `.stop` file
- ✅ Progress tracking
- ✅ ETA calculation

---

## ⏱️ Time Estimates

**With polite delays:**
- Speed: ~1-2 images/second
- Total time: **8-12 hours**
- Storage: **~1GB**

**Breakdown:**
- Question images: ~3-4 hours
- Option images: ~5-8 hours

---

## 📁 Directory Structure

```
quiz-scraper/
├── images/
│   ├── question_images/
│   │   ├── ka4APLO7K9HghPckiz7akEh2NWoRnJOaeoAcRtPWue6aksc0ct.png
│   │   ├── JkYXaIioEi4zax5eteM0UQT06FMvOI1L0tPuAqIrEO88PhfwKO.png
│   │   └── ... (9,186 files)
│   └── option_images/
│       ├── LSLEXIUTeqJYHj0TtxNKDm4JPDSKL1GjR21d942qpzqxgRkyQ4.png
│       ├── wbr4Wwzo3IFekz5GjRFg9xVDFSpUThv3LhTIlaJPiHpboBuh5w.png
│       └── ... (17,466 files)
├── data/ (question papers)
└── image-downloader.log
```

---

## 🔄 Resume Capability

**If stopped/crashed:**
1. Just run `./run-image-downloader.sh` again
2. It will skip all existing images
3. Continue from where it left off

**No data loss, no re-downloads!**

---

## 📊 Progress Monitoring

The downloader shows:
- Downloaded count and percentage
- Skipped count (already exist)
- Failed count
- Download speed (images/sec)
- Elapsed time
- ETA (estimated time remaining)

**Example output:**
```
📊 Progress:
   Downloaded: 1250/26652 (4.7%)
   Skipped: 0 (already exist)
   Failed: 2
   Speed: 1.8 images/sec
   Elapsed: 11m 23s
   ETA: 3h 52m 15s
```

---

## ⚠️ Important Notes

1. **Disk Space:** Ensure ~1.5GB free space
2. **Network:** Stable internet required
3. **Politeness:** Don't reduce delays (respect CDN)
4. **Parallel:** Don't run multiple instances

---

## 🎯 Recommended Workflow

### Option 1: Run Both Scrapers (Recommended)
```bash
# Terminal 1: Paper scraper (already running)
cd /home/snehit/projects/quiz-scraper
./run-scraper.sh

# Terminal 2: Image downloader (new)
cd /home/snehit/projects/quiz-scraper
./run-image-downloader.sh
```

**Both can run simultaneously!**

### Option 2: Images After Papers
Wait for paper scraper to finish, then download images.

---

## 🎉 When Complete

You'll have:
- ✅ ~17,100 question papers (JSON)
- ✅ ~26,652 images (PNG)
- ✅ Complete dataset ready for analysis
- ✅ Can build quiz applications
- ✅ Can create study tools

**Total dataset size:** ~1.5-2GB
