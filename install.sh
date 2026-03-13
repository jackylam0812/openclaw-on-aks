#!/bin/bash

set -e

#---------------------------------------------------------------
# Default values (can be overridden by flags or env vars)
#---------------------------------------------------------------
CLUSTER_NAME="${CLUSTER_NAME:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-}"
LOCATION="${AZURE_LOCATION:-}"
FOUNDRY_LOCATION="${FOUNDRY_LOCATION:-}"
MICROSOFT_INTERNAL=false

#---------------------------------------------------------------
# Argument parsing
#---------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --cluster-name)
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --resource-group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    --location)
      LOCATION="$2"
      shift 2
      ;;
    --foundry-location)
      FOUNDRY_LOCATION="$2"
      shift 2
      ;;
    --microsoft-internal)
      MICROSOFT_INTERNAL=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --cluster-name NAME          AKS cluster name (default: openclaw-kata-aks)"
      echo "  --resource-group NAME        Resource group name (default: <cluster-name>-rg)"
      echo "  --location REGION            AKS region (default: southeastasia)"
      echo "  --foundry-location REGION    AI Foundry region for gpt-5.4 (default: eastus2)"
      echo "                               Supported: eastus2, swedencentral, polandcentral, southcentralus"
      echo "  --microsoft-internal         Add SecurityControl=Ignore tag to all resources"
      echo "  --help                       Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0"
      echo "  $0 --cluster-name my-openclaw --location eastus"
      echo "  $0 --foundry-location swedencentral"
      echo "  $0 --microsoft-internal"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   OpenClaw on AKS — Interactive Setup                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

#---------------------------------------------------------------
# Prerequisites check
#---------------------------------------------------------------
echo "Checking prerequisites..."
MISSING=0
for cmd in az kubectl terraform helm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "  ✗ $cmd not found"
    MISSING=1
  else
    echo "  ✓ $cmd"
  fi
done
[ $MISSING -eq 1 ] && { echo ""; echo "Please install missing tools and retry."; exit 1; }
echo ""

#---------------------------------------------------------------
# Azure login
#---------------------------------------------------------------
echo "Checking Azure login..."
az account show >/dev/null 2>&1 || {
  echo "Not logged in. Running 'az login'..."
  az login
}
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "  ✓ Subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
echo ""

#---------------------------------------------------------------
# Interactive prompts (skip if already set via flags/env)
#---------------------------------------------------------------

# 1. Cluster name
if [ -z "$CLUSTER_NAME" ]; then
  read -p "AKS cluster name [openclaw-kata-aks]: " input
  CLUSTER_NAME="${input:-openclaw-kata-aks}"
fi
echo "  ✓ Cluster name: $CLUSTER_NAME"

# 2. Resource group
if [ -z "$RESOURCE_GROUP" ]; then
  default_rg="${CLUSTER_NAME}-rg"
  read -p "Resource group name [$default_rg]: " input
  RESOURCE_GROUP="${input:-$default_rg}"
fi
echo "  ✓ Resource group: $RESOURCE_GROUP"

# 3. AKS location
if [ -z "$LOCATION" ]; then
  echo ""
  echo "AKS cluster region (where Kubernetes runs):"
  echo "  1) southeastasia  (Southeast Asia — Singapore)  [default]"
  echo "  2) eastasia       (East Asia — Hong Kong)"
  echo "  3) eastus2        (East US 2)"
  echo "  4) westeurope     (West Europe)"
  echo "  Or type any valid Azure region name."
  read -p "Enter number or region name [1]: " input
  case "$input" in
    2|eastasia)     LOCATION="eastasia" ;;
    3|eastus2)      LOCATION="eastus2" ;;
    4|westeurope)   LOCATION="westeurope" ;;
    ""|1|southeastasia) LOCATION="southeastasia" ;;
    *)              LOCATION="$input" ;;
  esac
fi
echo "  ✓ AKS location: $LOCATION"

# 4. AI Foundry location
if [ -z "$FOUNDRY_LOCATION" ]; then
  echo ""
  echo "AI Foundry region (where gpt-5.4 is deployed):"
  echo "  Supported regions: eastus2, swedencentral, polandcentral, southcentralus"
  echo "  1) eastus2        (East US 2)        [default]"
  echo "  2) swedencentral  (Sweden Central)"
  echo "  3) polandcentral  (Poland Central)"
  echo "  4) southcentralus (South Central US)"
  read -p "Enter number or region name [1]: " input
  case "$input" in
    2|swedencentral)  FOUNDRY_LOCATION="swedencentral" ;;
    3|polandcentral)  FOUNDRY_LOCATION="polandcentral" ;;
    4|southcentralus) FOUNDRY_LOCATION="southcentralus" ;;
    *)                FOUNDRY_LOCATION="eastus2" ;;
  esac
fi
echo "  ✓ AI Foundry location: $FOUNDRY_LOCATION"

# 5. Microsoft internal subscription
if [ "$MICROSOFT_INTERNAL" = "false" ]; then
  echo ""
  read -p "Is this a Microsoft internal subscription? (yes/no) [no]: " input
  if [ "$input" = "yes" ] || [ "$input" = "y" ]; then
    MICROSOFT_INTERNAL=true
  fi
fi
if [ "$MICROSOFT_INTERNAL" = "true" ]; then
  echo "  ✓ Microsoft internal: SecurityControl=Ignore will be added to all resources"
fi

#---------------------------------------------------------------
# Summary before deploy
#---------------------------------------------------------------
echo ""
echo "────────────────────────────────────────────────────────"
echo "  Deployment summary"
echo "────────────────────────────────────────────────────────"
echo "  Subscription  : $SUBSCRIPTION_NAME"
echo "  Cluster name  : $CLUSTER_NAME"
echo "  Resource group: $RESOURCE_GROUP"
echo "  AKS region    : $LOCATION"
echo "  Foundry region: $FOUNDRY_LOCATION (gpt-5.4)"
echo "  MS internal   : $MICROSOFT_INTERNAL"
echo "────────────────────────────────────────────────────────"
echo ""
read -p "Proceed with deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
  echo "Deployment cancelled."
  exit 0
fi

#---------------------------------------------------------------
# Terraform
#---------------------------------------------------------------
echo ""
echo "Initializing Terraform..."
terraform init -upgrade

TF_VARS="-var=name=$CLUSTER_NAME"
TF_VARS="$TF_VARS -var=resource_group_name=$RESOURCE_GROUP"
TF_VARS="$TF_VARS -var=location=$LOCATION"
TF_VARS="$TF_VARS -var=foundry_location=$FOUNDRY_LOCATION"
[ "$MICROSOFT_INTERNAL" = "true" ] && TF_VARS="$TF_VARS -var=microsoft_internal=true"

echo ""
echo "Planning infrastructure..."
terraform plan $TF_VARS

echo ""
echo "Applying infrastructure (this takes ~10-15 minutes)..."
terraform apply -auto-approve $TF_VARS

#---------------------------------------------------------------
# Configure kubectl
#---------------------------------------------------------------
echo ""
echo "Configuring kubectl..."
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing

echo "Waiting for cluster nodes to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=300s

#---------------------------------------------------------------
# Done
#---------------------------------------------------------------
FOUNDRY_ENDPOINT=$(terraform output -raw foundry_endpoint 2>/dev/null || echo "(see terraform output)")
FOUNDRY_HUB=$(terraform output -raw foundry_hub_name 2>/dev/null || echo "")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Deployment complete!                               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Cluster      : $CLUSTER_NAME"
echo "  Resource group: $RESOURCE_GROUP"
echo "  AKS region   : $LOCATION"
echo "  Foundry Hub  : $FOUNDRY_HUB"
echo "  Foundry API  : $FOUNDRY_ENDPOINT"
echo ""
echo "Next steps:"
echo ""
echo "1. Generate LiteLLM API key:"
echo "   MASTER_KEY=\$(kubectl get secret litellm-masterkey -n litellm -o jsonpath='{.data.masterkey}' | base64 -d)"
echo "   kubectl run -n litellm gen-key --rm -i --restart=Never --image=curlimages/curl -- \\"
echo "     curl -s -X POST http://litellm:4000/key/generate \\"
echo "     -H \"Authorization: Bearer \$MASTER_KEY\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"models\": [\"gpt-5.4\"], \"duration\": \"30d\"}'"
echo ""
echo "2. Deploy OpenClaw sandbox:"
echo "   kubectl apply -f examples/openclaw-slack-sandbox.yaml"
echo ""
echo "3. Check status:"
echo "   kubectl get pods -A"
echo "   kubectl get sandbox -A"
echo ""
