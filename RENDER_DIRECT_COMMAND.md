# ✅ Direct Command Solution for Render

## The Issue
The build script might not be executing correctly. Use a direct bash command instead.

## Solution: Use Direct Bash Command

### Update Render Settings

Go to your **Frontend Static Site** on Render → **Settings**:

**Root Directory:**
```
(leave empty)
```

**Build Command:**
```
bash -c "cd client && pwd && ls -la package.json && npm install && npm run build"
```

**Publish Directory:**
```
client/build
```

---

## Simpler Version (If Above Doesn't Work)

**Build Command:**
```
cd client && npm install && npm run build
```

**Publish Directory:**
```
client/build
```

---

## Most Reliable Version

**Build Command:**
```
(cd client && npm install && npm run build)
```

The parentheses create a subshell, ensuring the cd command works.

**Publish Directory:**
```
client/build
```

---

## Alternative: Use && with explicit path

**Build Command:**
```
test -d client && cd client && npm install && npm run build || echo "Client directory not found"
```

This will:
1. Check if client directory exists
2. Change to it
3. Install and build
4. Show error if directory doesn't exist

**Publish Directory:**
```
client/build
```

---

## Recommended Settings

```
Name: prinstine-frontend
Branch: main
Root Directory: (empty)
Build Command: (cd client && npm install && npm run build)
Publish Directory: client/build
Environment: Node
```

---

## Why Parentheses Work

- `(cd client && ...)` creates a subshell
- The cd command is guaranteed to work in the subshell
- Commands run sequentially with &&
- More reliable than scripts on some platforms

---

**Try the parentheses version first - it's the most reliable!** ✅

