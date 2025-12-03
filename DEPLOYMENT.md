# Backend Deployment Guide for Render

## Prerequisites
- GitHub repository: https://github.com/faris3006/FYP-project-backend-
- MongoDB Atlas connection string: Set as environment variable DB_URI (see below)
- Render account: https://render.com

## Step-by-Step Deployment on Render

### 1. Push Changes to GitHub
Make sure all files are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create New Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** button
3. Select **"Web Service"**
4. Click **"Connect account"** and connect your GitHub account
5. Select repository: **FYP-project-backend-**
6. Click **"Connect"**

### 3. Configure the Service

**Basic Settings:**
- **Name:** `booking-backend` (or any name you prefer)
- **Region:** Choose closest to you (e.g., Singapore, US East)
- **Branch:** `main`
- **Root Directory:** (leave empty)
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### 4. Set Environment Variables

Click **"Advanced"** and add these environment variables (never commit real values to Git):

```
DB_URI=<your-mongodb-connection-string>
JWT_SECRET=<generate_a_strong_random_string>
SENDGRID_API_KEY=<sendgrid_api_key>
EMAIL_FROM=<notification_sender_email>
EMAIL_FROM_NAME=<display_name_for_emails>
BACKEND_URL=<https://your-render-service.onrender.com>
ADMIN_EMAIL=<admin_user_email>
ADMIN_PASSWORD=<admin_user_password>
ADMIN_NAME=<admin_display_name>
ADMIN_PHONE=<admin_phone_number>
PORT=10000
NODE_ENV=production
```

> Tip: use `env.example` as a reference for all required environment variables and create your own `.env` file locally (already gitignored).

**Important:** 
- Change `JWT_SECRET` to a strong random string (e.g., generate one at https://randomkeygen.com/)
- Render uses port 10000 by default, but it will be provided via PORT env var

### 5. Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying your backend
3. Wait for deployment to complete (usually 2-5 minutes)
4. Once deployed, you'll get a URL like: `https://booking-backend-xxxx.onrender.com`

### 6. Test the Deployment

1. Visit your backend URL: `https://your-backend-name.onrender.com`
2. Test an endpoint: `https://your-backend-name.onrender.com/api/auth/login`
3. Check logs in Render dashboard for any errors

### 7. Update Frontend

After deployment, update your frontend's API URL:
- Change from: `https://fyp-project-backend.onrender.com`
- Change to: `https://your-backend-name.onrender.com`

## Troubleshooting

- **Build fails:** Check logs in Render dashboard
- **Database connection fails:** Verify MongoDB Atlas IP whitelist (add 0.0.0.0/0 to allow all IPs)
- **CORS errors:** Verify frontend URL is in CORS settings in server.js

## Notes

- Free tier on Render may spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid plan for always-on service





