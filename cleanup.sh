#!/bin/bash

set -e

CLUSTER_NAME="${CLUSTER_NAME:-openclaw-kata-aks}"
RESOURCE_GROUP="${CLUSTER_NAME}-rg"

echo "Cleaning up OpenClaw Kata AKS cluster..."
echo "Resource Group: $RESOURCE_GROUP"
echo ""

# Delete Kata test workloads
kubectl delete -f examples/ --ignore-not-found=true || true

# Wait for pods to terminate
echo "Waiting for pods to terminate..."
sleep 30

# Destroy Terraform resources
terraform destroy -auto-approve

# Optionally delete the resource group entirely
read -p "Delete resource group '$RESOURCE_GROUP'? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
  echo "Deleting resource group..."
  az group delete --name "$RESOURCE_GROUP" --yes --no-wait
fi

echo "Cleanup complete!"
