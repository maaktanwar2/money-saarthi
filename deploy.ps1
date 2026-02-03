# ===========================================
# Money Saarthi - Google Cloud Deploy Script
# PowerShell version for Windows
# ===========================================

param(
    [string]$ProjectId = "moneysaarthi-prod",
    [string]$Region = "asia-south1"
)

$ErrorActionPreference = "Stop"
$BackendService = "moneysaarthi-backend"

Write-Host "🚀 Money Saarthi Deployment" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host ""

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/install" -ForegroundColor Red
    exit 1
}

# Set project
Write-Host "Setting project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# Step 1: Enable APIs
Write-Host "`n📡 Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable `
    cloudbuild.googleapis.com `
    run.googleapis.com `
    secretmanager.googleapis.com `
    containerregistry.googleapis.com `
    --quiet

# Step 2: Build and Deploy Backend
Write-Host "`n📦 Building and deploying backend..." -ForegroundColor Yellow
Set-Location backend

if (Test-Path "cloudbuild.yaml") {
    gcloud builds submit --config=cloudbuild.yaml --quiet
} else {
    gcloud builds submit --tag "gcr.io/$ProjectId/$BackendService" --quiet
    gcloud run deploy $BackendService `
        --image "gcr.io/$ProjectId/$BackendService" `
        --region $Region `
        --platform managed `
        --allow-unauthenticated `
        --memory 1Gi `
        --cpu 1 `
        --min-instances 0 `
        --max-instances 10 `
        --quiet
}

# Get backend URL
$BackendUrl = gcloud run services describe $BackendService `
    --region=$Region --format='value(status.url)'

Write-Host "`n✅ Backend deployed: $BackendUrl" -ForegroundColor Green

# Step 3: Build Frontend
Write-Host "`n📦 Building frontend..." -ForegroundColor Yellow
Set-Location ../frontend

# Update environment
@"
REACT_APP_BACKEND_URL=$BackendUrl
REACT_APP_GOOGLE_CLIENT_ID=$env:GOOGLE_CLIENT_ID
"@ | Out-File -FilePath ".env.production" -Encoding UTF8

npm run build

# Step 4: Deploy Frontend
Write-Host "`n🌐 Deploying frontend to Firebase..." -ForegroundColor Yellow

if (Test-Path "firebase.json") {
    firebase deploy --only hosting
} else {
    Write-Host "⚠️ Firebase not initialized. Run: firebase init hosting" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Backend:  $BackendUrl"
Write-Host "Frontend: Check Firebase console for URL"
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Update CORS_ORIGINS in Cloud Run with frontend URL"
Write-Host "2. Test the application"
Write-Host "3. Set up custom domain (optional)"

Set-Location ..
