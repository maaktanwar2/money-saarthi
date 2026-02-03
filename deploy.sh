#!/bin/bash
# ===========================================
# Money Saarthi - Google Cloud Deploy Script
# ===========================================

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-moneysaarthi-prod}"
REGION="asia-south1"
BACKEND_SERVICE="moneysaarthi-backend"

echo "🚀 Money Saarthi Deployment"
echo "=========================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is logged in
if ! gcloud auth print-identity-token &>/dev/null; then
    echo "❌ Not logged in to gcloud. Run: gcloud auth login"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Step 1: Enable APIs
echo "📡 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    containerregistry.googleapis.com \
    --quiet

# Step 2: Build and Deploy Backend
echo ""
echo "📦 Building and deploying backend..."
cd backend

# Check if cloudbuild.yaml exists
if [ -f "cloudbuild.yaml" ]; then
    gcloud builds submit --config=cloudbuild.yaml --quiet
else
    # Direct deploy
    gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE --quiet
    gcloud run deploy $BACKEND_SERVICE \
        --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --quiet
fi

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
    --region=$REGION --format='value(status.url)')

echo ""
echo "✅ Backend deployed: $BACKEND_URL"

# Step 3: Build Frontend
echo ""
echo "📦 Building frontend..."
cd ../frontend

# Update environment
cat > .env.production << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
REACT_APP_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
EOF

npm run build

# Step 4: Deploy Frontend
echo ""
echo "🌐 Deploying frontend to Firebase..."

# Check if firebase is initialized
if [ -f "firebase.json" ]; then
    firebase deploy --only hosting
else
    echo "⚠️ Firebase not initialized. Run: firebase init hosting"
    echo "Or deploy manually to your preferred hosting."
fi

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo "Backend:  $BACKEND_URL"
echo "Frontend: Check Firebase console for URL"
echo ""
echo "📝 Next steps:"
echo "1. Update CORS_ORIGINS in Cloud Run with frontend URL"
echo "2. Test the application"
echo "3. Set up custom domain (optional)"
