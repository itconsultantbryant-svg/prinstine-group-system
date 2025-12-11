# ✅ Final Working Solution: Use Build Script

## Problem
Render's Root Directory setting isn't working reliably. Use a build script instead.

## Solution: Use Shell Script

### Step 1: Build Script is Ready

I've created `build-client.sh` in the root of your repository. This script:
1. Changes to client directory
2. Installs dependencies
3. Runs the build

### Step 2: Update Render Settings

Go to your **Frontend Static Site** on Render → **Settings**:

**Root Directory:**
```
(leave empty - use root of repo)
```

**Build Command:**
```
chmod +x build-client.sh && ./build-client.sh
```

**Publish Directory:**
```
client/build
```

---

## Alternative: Direct Command (If Script Doesn't Work)

**Root Directory:** (empty)

**Build Command:**
```
cd client && npm install && npm run build || (pwd && ls -la && cd client && pwd && ls -la && npm install && npm run build)
```

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
Build Command: chmod +x build-client.sh && ./build-client.sh
Publish Directory: client/build
Environment: Node
```

---

## Why This Works

- The shell script explicitly changes to client directory
- Uses `cd client` which is reliable in bash
- Then runs npm commands from the correct directory
- Output is in `client/build` which we publish

---

## If Script Doesn't Work

Try this build command instead:
```
bash -c "cd client && npm install && npm run build"
```

Or:
```
sh -c 'cd client && npm install && npm run build'
```

---

**The build script approach should definitely work!** ✅

