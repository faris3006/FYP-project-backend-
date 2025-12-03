# 🔧 Frontend Fix for Network Error

## ❌ Problem
Frontend shows "Network error" when trying to login/register from phone.

## ✅ Solution
The frontend is still pointing to `localhost:5000` instead of your Render backend URL.

## 📋 Steps to Fix

### 1. Find Your Render Backend URL
- Go to Render dashboard: https://dashboard.render.com
- Find your backend service
- Copy the URL (e.g., `https://booking-backend-xxxx.onrender.com`)

### 2. Update Frontend API Configuration

**Find where the API base URL is set in your frontend code:**

Look for files like:
- `src/config/api.js`
- `src/utils/api.js`
- `.env` or `.env.production`
- `src/services/api.ts` or similar

**Change from:**
```javascript
const API_URL = 'http://localhost:5000';
// or
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

**Change to:**
```javascript
const API_URL = 'https://fyp-project-backend.onrender.com';
// or better, use environment variable:
const API_URL = process.env.REACT_APP_API_URL || 'https://fyp-project-backend.onrender.com';
```

### 3. Update Vercel Environment Variables

1. Go to Vercel dashboard: https://vercel.com/dashboard
2. Select your project: `fyp-project-nine-gray`
3. Go to **Settings** → **Environment Variables**
4. Add or update:
   - **Key:** `REACT_APP_API_URL`
   - **Value:** `https://fyp-project-backend.onrender.com`
   - **Environment:** Production, Preview, Development (select all)
5. Click **Save**

### 4. Redeploy Frontend

**Option A: Auto-redeploy (if connected to GitHub)**
- Push your changes to GitHub
- Vercel will auto-deploy

**Option B: Manual redeploy**
- Go to Vercel dashboard → Your project
- Click **Deployments** tab
- Click **Redeploy** on the latest deployment

### 5. Test

1. Wait for deployment to complete
2. Open your Vercel URL on phone: `https://fyp-project-nine-gray.vercel.app`
3. Try to register/login again
4. Network error should be gone!

## 🔍 Quick Test

Test if backend is accessible:
1. Open browser on phone
2. Visit: `https://fyp-project-backend.onrender.com/`
3. Should see: `{ "message": "Backend API is running", "status": "OK" }`

If you see this, backend is working! The issue is just the frontend API URL.

## ⚠️ Important Notes

- **Render Free Tier:** Backend may sleep after 15 min inactivity
- **First Request:** May take 30-60 seconds to wake up
- **Solution:** Consider Render paid plan for always-on service

## 📞 Still Having Issues?

Check:
1. ✅ Backend URL is correct in frontend code
2. ✅ Vercel environment variables are set
3. ✅ Frontend is redeployed after changes
4. ✅ Backend is accessible (test the `/` endpoint)
5. ✅ CORS is configured (already done in backend)

i asking okay, JUST ANSWER IT FIRST NO NEED TO DO EVERTHING JUST ANSWER WITH SIMPLE ANSWER

what is the different with this URL

(https://vercel.com/faris-projects-56742192/fyp-project/4cQTLngKhqvzapve6EjeTX2XN9GF)

(https://fyp-project-nine-gray.vercel.app/)

(https://fyp-project-git-main-faris-projects-56742192.vercel.app/)

(https://fyp-project-3za0fuxmk-faris-projects-56742192.vercel.app/)

(https://fyp-project-git-main-faris-projects-56742192.vercel.app/)

(https://fyp-project-clxxpq480-faris-projects-56742192.vercel.app/)