# 🔧 Fix: "Cannot find module client/package.json" Error

## Problem
React-scripts can't find the package.json even though we're changing directories.

## Solution: Use npm --prefix or ensure proper directory

### Option 1: Use npm --prefix (RECOMMENDED)

**Build Command:**
```
npm install --prefix client && npm run build --prefix client
```

**Publish Directory:**
```
client/build
```

---

### Option 2: Use explicit path with WORKDIR

**Build Command:**
```
cd client && pwd && ls -la && npm install && npm run build
```

This will help debug if the directory is correct.

---

### Option 3: Install and build separately

**Build Command:**
```
npm install --prefix client && cd client && npm run build
```

**Publish Directory:**
```
client/build
```

---

### Option 4: Use full path (Most Reliable)

**Build Command:**
```
cd client && npm install && NODE_ENV=production node_modules/.bin/react-scripts build
```

**Publish Directory:**
```
client/build
```

---

## Recommended: Use Option 1

**In Render Settings:**

```
Build Command: npm install --prefix client && npm run build --prefix client
Publish Directory: client/build
Root Directory: (leave empty)
```

---

## Why This Works

- `npm --prefix client` tells npm to run commands as if you're in the client directory
- This ensures package.json is found correctly
- No need to change directories manually

---

## Alternative: Set Root Directory

If the above doesn't work, try:

1. Set **Root Directory:** `client`
2. Set **Build Command:** `npm install && npm run build`
3. Set **Publish Directory:** `build` (not `client/build`)

---

**Try Option 1 first - it's the most reliable!** ✅

