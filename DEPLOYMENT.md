# SyncVeil Production Deployment Guide

## Prerequisites

- Railway account (https://railway.app)
- MongoDB Atlas account (for NoSQL features, optional)
- Brevo (Sendinblue) account (for email)
- PostgreSQL database (provided by Railway)

---

## 🚂 Railway Deployment

### 1. Initial Setup

1. Fork this repository to your GitHub account
2. Sign in to Railway (https://railway.app)
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your forked `syncveil-website` repository
5. Railway will automatically:
   - Detect Python application
   - Use the `Procfile`
   - Provision a PostgreSQL database
   - Assign a public URL

### 2. Configure Environment Variables

Go to your Railway project → **Variables** tab and add:

#### Required Variables

```bash
ENVIRONMENT=production
DATABASE_URL=${PGDATABASE_URL}  # Auto-provided by Railway
JWT_SECRET=<generate-strong-32-char-random-key>
BREVO_API_KEY=<your-brevo-api-key>
SMTP_FROM=<verified-sender@example.com>
EMAIL_FROM=noreply@yourdomain.com
CORS_ORIGINS=*
FRONTEND_URL=https://your-app.railway.app
```

#### Optional Variables (for MongoDB features)

```bash
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=syncveil
```

#### Optional Variables (for Redis)

```bash
REDIS_URL=redis://default:password@host:6379
```

### 3. Deploy

- Railway automatically deploys on every push to `main` branch
- Monitor deployment in Railway dashboard
- Check logs for any errors

### 4. Verify Deployment

```bash
# Health check
curl https://your-app.railway.app/health

# Should return: {"status": "ok"}
```

Visit: `https://your-app.railway.app/docs` for API documentation

---

## 🗄️ Database Setup

### PostgreSQL (Automatic)

Railway automatically provisions PostgreSQL and sets `DATABASE_URL`.

To run migrations:

```bash
# In Railway dashboard, go to your service → Settings → Deploy Triggers
# Add a command to run after deploy:
alembic upgrade head
```

Or manually via Railway CLI:

```bash
railway run alembic upgrade head
```

### MongoDB Atlas (Optional)

1. Create account at https://cloud.mongodb.com/
2. Create a free M0 cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow all)
5. Get connection string (mongodb+srv://...)
6. Add to Railway environment variables as `MONGO_URI`

See [MONGODB_ATLAS_SETUP.md](MONGODB_ATLAS_SETUP.md) for detailed instructions.

---

## 🔐 Security Checklist

Before going to production:

- [ ] Strong `JWT_SECRET` (32+ characters, random)
- [ ] Valid Brevo API key configured
- [ ] CORS_ORIGINS set to your domain (not `*` in production)
- [ ] HTTPS enabled (automatic on Railway)
- [ ] Database using PostgreSQL (not SQLite)
- [ ] MongoDB uses Atlas connection string (if enabled)
- [ ] No `.env` file committed to repository
- [ ] No hardcoded secrets in code

---

## 🔄 Continuous Deployment

Railway automatically deploys on every push to `main`:

1. Push code to GitHub
2. Railway detects changes
3. Builds new image
4. Runs tests (if configured)
5. Deploys to production

To disable auto-deploy:
- Go to Railway project → Settings → uncheck "Auto Deploy"

---

## 📊 Monitoring

### Railway Dashboard

- View real-time logs
- Monitor CPU/Memory usage
- Check deployment history
- View metrics

### Health Check Endpoint

Monitor: `https://your-app.railway.app/health`

Set up external monitoring (UptimeRobot, Pingdom, etc.) to ping this endpoint.

---

## 🐛 Troubleshooting

### App Not Starting

1. Check Railway logs for errors
2. Verify all required environment variables are set
3. Ensure `DATABASE_URL` is configured
4. Check `Procfile` is present and correct

### Database Connection Errors

1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/db`
2. Check PostgreSQL service is running in Railway
3. Run migrations: `railway run alembic upgrade head`

### MongoDB Connection Errors

1. Verify `MONGO_URI` starts with `mongodb+srv://`
2. Check network access allows `0.0.0.0/0` in MongoDB Atlas
3. Verify username/password are correct
4. Check cluster is active (not paused)

### CORS Issues

1. Update `CORS_ORIGINS` in Railway to include your frontend domain
2. Use `*` only for development
3. Multiple origins: `https://domain1.com,https://domain2.com`

---

## 🔄 Updates & Rollbacks

### Deploy New Version

```bash
git add .
git commit -m "Update: description"
git push origin main
```

Railway automatically deploys.

### Rollback

In Railway dashboard:
1. Go to Deployments
2. Find previous successful deployment
3. Click "Redeploy"

---

## 🎯 Performance Optimization

### Enable Redis (Optional)

For session storage and rate limiting:

1. Add Redis service in Railway
2. Copy Redis connection URL
3. Add to environment variables as `REDIS_URL`

### Database Connection Pooling

Already configured in `app/db/session.py`:
- Uses NullPool for serverless (Railway)
- Automatic connection management

---

## 📈 Scaling

Railway offers:
- **Hobby Plan**: $5/month, suitable for small apps
- **Pro Plan**: $20/month, better performance
- **Custom**: Contact Railway for enterprise

To scale:
1. Go to Railway project → Settings
2. Upgrade plan
3. Adjust resources as needed

---

## 🆘 Support

- **Railway**: https://railway.app/help
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
- **SendGrid**: https://docs.sendgrid.com/

---

## 📝 Additional Notes

- Railway provides automatic SSL/TLS certificates
- Environment variables are encrypted at rest
- Logs retained for 7 days (Hobby plan)
- Automatic subdomain: `your-app.railway.app`
- Custom domains supported (add in Railway settings)

---

**Last Updated**: January 2026
