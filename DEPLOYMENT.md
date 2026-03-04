# 🚀 Libra — AWS Deployment Guide

Complete guide to deploy Libra from your local machine to AWS.
No prior AWS expertise needed — just follow each section in order.

---

## Architecture Overview

```
Browser (any device)
    │
    ▼
CloudFront (CDN, HTTPS, global)
    │
    ├── Static files ──► S3 Bucket (React frontend)
    │
    └── /api/* ─────────► Elastic Beanstalk (Node.js API)
                               │
                               ▼
                          RDS PostgreSQL (private subnet)
```

**Cost estimate** (AWS free tier + smallest paid instances):
| Service              | Tier         | Cost/month |
|----------------------|--------------|------------|
| S3 + CloudFront      | Free tier    | ~$0–$1     |
| Elastic Beanstalk    | t3.small     | ~$15       |
| RDS PostgreSQL       | db.t3.micro  | ~$15       |
| Data transfer        | —            | ~$1–$2     |
| **Total**            |              | **~$30–35**|

---

## Prerequisites

Install these tools on your machine:

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# Elastic Beanstalk CLI
pip install awsebcli

# Node.js (v18+) and npm
# https://nodejs.org

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g. ap-south-1), output format: json
```

---

## STEP 1 — Deploy Infrastructure (RDS + S3 + CloudFront)

```bash
cd libra/infra

# Deploy the CloudFormation stack (takes ~10 minutes)
aws cloudformation deploy \
  --template-file cloudformation.yml \
  --stack-name libra-infra \
  --parameter-overrides DBPassword=YourStrongPassword123! \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1

# Get the outputs
aws cloudformation describe-stacks \
  --stack-name libra-infra \
  --query "Stacks[0].Outputs" \
  --output table
```

Save the outputs — you'll need:
- `DBEndpoint` → your RDS host
- `FrontendBucketName` → S3 bucket name
- `CloudFrontURL` → your app's public URL

---

## STEP 2 — Configure & Run Database Migrations

```bash
cd libra/backend

# Copy and fill in environment variables
cp .env.example .env
```

Edit `.env`:
```
DB_HOST=<DBEndpoint from Step 1>
DB_PORT=5432
DB_NAME=libra
DB_USER=libra_admin
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=generate_64+_random_chars_here_use_openssl_rand_hex_32
JWT_EXPIRES_IN=7d
PORT=8080
NODE_ENV=production
ALLOWED_ORIGINS=<CloudFrontURL from Step 1>
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run migrations:
```bash
npm install
node src/db/migrate.js
# Should print: ✅ Migrations complete.
```

---

## STEP 3 — Deploy Backend to Elastic Beanstalk

```bash
cd libra/backend

# Initialize EB (first time only)
eb init libra-api \
  --platform node.js-18 \
  --region ap-south-1

# Create environment with environment variables
eb create libra-prod \
  --instance-type t3.small \
  --envvars DB_HOST=<your-rds-endpoint>,DB_PORT=5432,DB_NAME=libra,DB_USER=libra_admin,DB_PASSWORD=<password>,JWT_SECRET=<your-secret>,JWT_EXPIRES_IN=7d,NODE_ENV=production,ALLOWED_ORIGINS=<cloudfront-url>,PORT=8080

# Wait for it to go green (~5 minutes)
eb status

# Get the Elastic Beanstalk URL
eb open
# Copy the URL shown: http://libra-prod.xxxxxx.ap-south-1.elasticbeanstalk.com
```

Test the API:
```bash
curl https://your-eb-url.elasticbeanstalk.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## STEP 4 — Build & Deploy Frontend

```bash
cd libra/frontend

# Update .env.production with your EB URL
echo "VITE_API_URL=https://your-eb-url.elasticbeanstalk.com" > .env.production

npm install
npm run build
# Creates dist/ folder

# Upload to S3
BUCKET=<FrontendBucketName from Step 1>

aws s3 sync dist/ s3://$BUCKET/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable"

# index.html should NOT be cached
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache,no-store,must-revalidate"

# Invalidate CloudFront cache
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Origins.Items[0].DomainName,'$BUCKET')].Id" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

Your app is now live at the `CloudFrontURL` from Step 1! 🎉

---

## STEP 5 — (Optional) Custom Domain + HTTPS

```bash
# 1. Buy/transfer domain to Route 53 (or update nameservers)

# 2. Request ACM certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# 3. In AWS Console:
#    - Add certificate ARN to CloudFront distribution → Alternate Domain Names
#    - Add CNAME in Route 53 pointing to CloudFront domain
#    - Add A record (alias) for your EB environment

# 4. Update ALLOWED_ORIGINS in EB:
eb setenv ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Day-to-Day Operations

### Deploy backend updates
```bash
cd libra/backend
eb deploy
```

### Deploy frontend updates
```bash
cd libra/frontend
npm run build
aws s3 sync dist/ s3://$BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

### View backend logs
```bash
eb logs --all
```

### Connect to RDS for debugging
```bash
# From an EC2 instance in the same VPC, or use AWS RDS proxy
psql -h <DB_HOST> -U libra_admin -d libra
```

### Monitor costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-02-01 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

---

## CI/CD with GitHub Actions (optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Libra

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - name: Deploy to Elastic Beanstalk
        uses: einaregilsson/beanstalk-deploy@v21
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: libra-api
          environment_name: libra-prod
          region: ap-south-1
          deployment_package: backend/

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: npm ci && npm run build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - run: aws s3 sync frontend/dist/ s3://${{ secrets.S3_BUCKET }}/ --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"
```

---

## Security Checklist

- [ ] JWT_SECRET is 64+ chars, never committed to Git
- [ ] RDS is in private subnet, not publicly accessible
- [ ] DB password is 12+ chars with mixed characters
- [ ] ALLOWED_ORIGINS only contains your actual domains
- [ ] Add `.env` to `.gitignore`
- [ ] Enable RDS automated backups (7 days, already in template)
- [ ] Consider enabling Multi-AZ for RDS in production

---

## Troubleshooting

**502 Bad Gateway on EB**: Check logs with `eb logs`. Usually means PORT mismatch or crash on startup.

**CORS errors in browser**: Make sure ALLOWED_ORIGINS on EB exactly matches your CloudFront URL (no trailing slash).

**Cannot connect to RDS**: Ensure EB security group is allowed in RDS security group inbound rules (already configured in CloudFormation).

**Frontend shows blank page after deploy**: Run CloudFront invalidation and hard-refresh the browser.
